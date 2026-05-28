"""
FASE 1 — Extração, Matching e Relatório de Análise
===================================================
1. Autentica no Google Drive via service account
2. Varre a pasta de planilhas recursivamente, lendo apenas "Tabelas Atuais"
3. Extrai SKUs/nomes de produto de todas as abas de cada planilha
4. Varre a pasta PRODUTOS recursivamente e lista todas as imagens
5. Para cada imagem:
   - Extrai o código do fornecedor do nome do arquivo (ex: "ARBO1 - JAL.jpg" → JAL)
   - Se o código estiver mapeado em SUPPLIER_CODE_MAP com valor != None → mapeamento direto
   - Caso contrário → fuzzy matching contra todos os SKUs de todos os fornecedores
6. Gera relatorio_analise.xlsx com as associações para revisão humana

Uso:
    python phase1_match.py
"""

import io
import os
import re
import unicodedata
import logging
from datetime import datetime
from pathlib import Path

import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
import xlrd
from rapidfuzz import fuzz, process
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from config import (
    CREDENTIALS_PATH,
    DRIVE_IMAGES_FOLDER_ID,
    DRIVE_SPREADSHEETS_FOLDER_ID,
    SIMILARITY_THRESHOLD,
    HIGH_CONFIDENCE_THRESHOLD,
    MEDIUM_CONFIDENCE_THRESHOLD,
    AMBIGUITY_GAP,
    IMAGE_EXTENSIONS,
    SKU_COLUMN_NAMES,
    TABS_TO_SKIP_KEYWORDS,
    CURRENT_TABLE_KEYWORD,
    SUPPLIER_CODE_MAP,
    ANALYSIS_REPORT_PATH,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


# ---------------------------------------------------------------------------
# Versionamento de relatórios
# ---------------------------------------------------------------------------

def get_versioned_path(base_path: str) -> tuple[str, str, int]:
    """
    A partir de 'relatorio_analise.xlsx', calcula:
      - versioned_path → 'relatorio_analise_v001.xlsx'  (próximo disponível)
      - latest_path    → 'relatorio_analise_LATEST.xlsx' (sempre sobrescrito)
      - version_num    → número inteiro da versão atual

    Procura arquivos existentes do padrão base_vNNN.xlsx para determinar o
    próximo número a usar.
    """
    p = Path(base_path)
    stem   = p.stem   # e.g. "relatorio_analise"
    suffix = p.suffix  # e.g. ".xlsx"
    parent = p.parent

    pattern = re.compile(rf"^{re.escape(stem)}_v(\d+){re.escape(suffix)}$", re.IGNORECASE)
    existing_versions = []
    for f in parent.glob(f"{stem}_v*{suffix}"):
        m = pattern.match(f.name)
        if m:
            existing_versions.append(int(m.group(1)))

    version_num   = (max(existing_versions) + 1) if existing_versions else 1
    versioned_path = str(parent / f"{stem}_v{version_num:03d}{suffix}")
    latest_path    = str(parent / f"{stem}_LATEST{suffix}")

    return versioned_path, latest_path, version_num


def load_previous_stats(latest_path: str) -> dict | None:
    """
    Lê o arquivo LATEST (se existir) e extrai os totais da aba 'Resumo da Versão'.
    Retorna um dict com as chaves: total, direto, alta, media, baixa, sem_match, version.
    Retorna None se o arquivo não existir ou não tiver a aba esperada.
    """
    p = Path(latest_path)
    if not p.exists():
        return None

    try:
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        if "Resumo da Versão" not in wb.sheetnames:
            wb.close()
            return None

        ws = wb["Resumo da Versão"]
        stats = {}
        for row in ws.iter_rows(min_row=2, values_only=True):
            if row[0] and row[1] is not None:
                stats[str(row[0]).strip()] = row[1]
        wb.close()
        return stats if stats else None
    except Exception as e:
        log.warning(f"Não foi possível ler stats da versão anterior: {e}")
        return None

# MIME types aceitos para planilhas — todos em minúsculas (como o Drive retorna)
SPREADSHEET_MIMES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "application/vnd.ms-excel",                                            # .xls
    "application/vnd.ms-excel.sheet.macroenabled.12",                     # .xlsm (lowercase!)
    "application/vnd.google-apps.spreadsheet",                            # Google Sheets nativo
}


# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------

def authenticate():
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


# ---------------------------------------------------------------------------
# Utilitários de texto
# ---------------------------------------------------------------------------

def normalize(text: str) -> str:
    """Remove acentos, converte para minúsculas e comprime espaços."""
    text = str(text).strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[_\-/\\]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_skip_tab(tab_name: str) -> bool:
    norm = normalize(tab_name)
    return any(kw in norm for kw in TABS_TO_SKIP_KEYWORDS)


def is_valid_sku(value: str) -> bool:
    v = str(value).strip()
    if len(v) < 3:
        return False
    if re.match(r"^[\d\s.,]+$", v):
        return False
    return True


# ---------------------------------------------------------------------------
# Parse do nome da imagem
# ---------------------------------------------------------------------------

def parse_image_name(filename: str) -> tuple[str, str | None]:
    """
    Extrai (nome_produto_limpo, codigo_fornecedor) do nome do arquivo.

    Padrão esperado: "PRODUTO[N] - CODIGO.ext"
    Exemplos:
        "ARBO1 - JAL.jpg"            → ("ARBO", "JAL")
        "AIR SUSPENSO1 - JAL.jpg"    → ("AIR SUSPENSO", "JAL")
        "CAJU 1 - FEE.jpg"           → ("CAJU", "FEE")
        "CLASS 25 1 - GRH.avif"      → ("CLASS 25", "GRH")
        "BOWL1 - LINA BO BARDI - ARPER.jpeg" → ("BOWL", "ARPER")
        "foto_produto.jpg"           → ("foto produto", None)
    """
    stem = Path(filename).stem

    # Divide no último " - " e verifica se a parte final é um código (2–5 letras maiúsculas)
    parts = stem.rsplit(" - ", 1)
    code = None
    product_raw = stem

    if len(parts) == 2 and re.match(r"^[A-Z]{2,5}$", parts[1].strip()):
        code = parts[1].strip()
        product_raw = parts[0]

    # Remove número de sequência ao final: "ARBO1" → "ARBO", "CAJU 1" → "CAJU"
    product = re.sub(r"\s*\d+$", "", product_raw).strip()

    return product, code


# ---------------------------------------------------------------------------
# Google Drive — listagem recursiva com caminho completo
# ---------------------------------------------------------------------------

def list_folder_recursive(service, folder_id: str, path: str = "") -> list[dict]:
    """
    Retorna lista de dicts de arquivos (não pastas) com caminho completo em 'path'.
    """
    items = []
    page_token = None

    while True:
        resp = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="nextPageToken, files(id, name, mimeType)",
            pageToken=page_token,
            pageSize=1000,
        ).execute()

        for f in resp.get("files", []):
            current_path = f"{path}/{f['name']}" if path else f["name"]

            if f["mimeType"] == "application/vnd.google-apps.folder":
                items.extend(list_folder_recursive(service, f["id"], current_path))
            else:
                items.append({
                    "id":       f["id"],
                    "name":     f["name"],
                    "mimeType": f["mimeType"],
                    "path":     current_path,
                })

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return items


# ---------------------------------------------------------------------------
# Download de arquivo do Drive em memória
# ---------------------------------------------------------------------------

def download_file(service, file_id: str, mime_type: str) -> bytes:
    if mime_type == "application/vnd.google-apps.spreadsheet":
        export_mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        request = service.files().export_media(fileId=file_id, mimeType=export_mime)
    else:
        request = service.files().get_media(fileId=file_id)

    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Extração de SKUs das planilhas
# ---------------------------------------------------------------------------

def find_sku_column(rows_sample: list, is_xlsx: bool = True) -> int | None:
    """
    Tenta identificar a coluna de SKU/produto olhando os primeiros valores.
    Retorna o índice da coluna ou None se não encontrar.
    """
    # Busca por cabeçalho conhecido
    for row in rows_sample[:10]:
        for idx, cell in enumerate(row):
            if cell and normalize(str(cell)) in SKU_COLUMN_NAMES:
                return idx

    # Fallback: primeira coluna com strings longas
    for row in rows_sample[:20]:
        for idx, cell in enumerate(row):
            if cell and isinstance(cell, str) and len(cell.strip()) > 4:
                return idx

    return None


def extract_skus_from_xlsx(data: bytes, supplier: str) -> list[tuple]:
    skus = []
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as e:
        log.warning(f"  Não foi possível abrir xlsx: {e}")
        return skus

    for sheet_name in wb.sheetnames:
        if is_skip_tab(sheet_name):
            continue

        ws = wb[sheet_name]
        all_rows = list(ws.iter_rows(min_row=1, max_row=500, values_only=True))
        if not all_rows:
            continue

        sku_col = find_sku_column(all_rows)
        if sku_col is None:
            log.debug(f"  Aba '{sheet_name}': coluna SKU não identificada, pulando.")
            continue

        count = 0
        for row in all_rows[1:]:
            if sku_col < len(row) and row[sku_col]:
                val = str(row[sku_col]).strip()
                if is_valid_sku(val):
                    skus.append((normalize(val), val, supplier))
                    count += 1

        if count:
            log.info(f"  Aba '{sheet_name}': {count} SKUs (col {sku_col})")

    wb.close()
    return skus


def extract_skus_from_xls(data: bytes, supplier: str) -> list[tuple]:
    skus = []
    try:
        wb = xlrd.open_workbook(file_contents=data)
    except Exception as e:
        log.warning(f"  Não foi possível abrir xls (talvez criptografado): {e}")
        return skus

    for sheet_name in wb.sheet_names():
        if is_skip_tab(sheet_name):
            continue

        ws = wb.sheet_by_name(sheet_name)
        sample = [
            [ws.cell_value(r, c) for c in range(ws.ncols)]
            for r in range(min(20, ws.nrows))
        ]
        sku_col = find_sku_column(sample)
        if sku_col is None:
            continue

        count = 0
        for r in range(1, ws.nrows):
            val = ws.cell_value(r, sku_col)
            if val and is_valid_sku(str(val)):
                skus.append((normalize(str(val)), str(val).strip(), supplier))
                count += 1

        if count:
            log.info(f"  Aba '{sheet_name}': {count} SKUs (col {sku_col})")

    return skus


# ---------------------------------------------------------------------------
# Carrega todas as planilhas e constrói o dicionário de SKUs
# ---------------------------------------------------------------------------

def load_all_skus(service) -> list[tuple]:
    """Retorna lista de (sku_normalizado, sku_original, fornecedor)."""
    if not DRIVE_SPREADSHEETS_FOLDER_ID:
        log.error("DRIVE_SPREADSHEETS_FOLDER_ID não configurado no .env")
        return []

    log.info("Listando arquivos de planilhas no Drive...")
    all_files = list_folder_recursive(service, DRIVE_SPREADSHEETS_FOLDER_ID)
    log.info(f"Total de arquivos encontrados: {len(all_files)}")

    all_skus = []
    processed = set()

    for f in all_files:
        mime = f["mimeType"].lower()
        if mime not in SPREADSHEET_MIMES:
            continue

        path = f["path"]
        if CURRENT_TABLE_KEYWORD not in path.lower():
            continue

        if f["id"] in processed:
            continue
        processed.add(f["id"])

        # Extrai nome do fornecedor da primeira pasta do caminho
        supplier = path.split("/")[0]
        supplier = re.sub(r"\s*-\s*\d+\s*$", "", supplier).strip()

        log.info(f"Processando [{supplier}]: {f['name']}")
        try:
            data = download_file(service, f["id"], f["mimeType"])
        except Exception as e:
            log.error(f"  Erro ao baixar {f['name']}: {e}")
            continue

        name_lower = f["name"].lower()
        if name_lower.endswith(".xls") and not name_lower.endswith(".xlsx"):
            skus = extract_skus_from_xls(data, supplier)
        else:
            skus = extract_skus_from_xlsx(data, supplier)

        all_skus.extend(skus)

    log.info(f"SKUs totais extraídos: {len(all_skus)}")
    return all_skus


# ---------------------------------------------------------------------------
# Carrega todas as imagens do Drive
# ---------------------------------------------------------------------------

def load_all_images(service) -> list[dict]:
    log.info("Listando imagens na pasta PRODUTOS...")
    all_files = list_folder_recursive(service, DRIVE_IMAGES_FOLDER_ID)

    images = []
    for f in all_files:
        ext = Path(f["name"]).suffix.lower()
        if ext not in IMAGE_EXTENSIONS:
            continue

        product, code = parse_image_name(f["name"])
        images.append({
            "id":           f["id"],
            "name":         f["name"],
            "path":         f["path"],
            "product_name": product,
            "product_norm": normalize(product),
            "supplier_code": code,
        })

    log.info(f"Total de imagens encontradas: {len(images)}")
    return images


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------

def confidence_label(score: int) -> str:
    if score >= HIGH_CONFIDENCE_THRESHOLD:
        return "Alta"
    if score >= MEDIUM_CONFIDENCE_THRESHOLD:
        return "Média"
    return "Baixa"


def match_images_to_skus(images: list[dict], skus: list[tuple]) -> list[dict]:
    """
    Para cada imagem:
    1. Se o código do arquivo está mapeado (SUPPLIER_CODE_MAP com valor != None):
       → mapeamento direto de fornecedor + fuzzy match só contra SKUs desse fornecedor
    2. Se o código é desconhecido ou não tem código:
       → fuzzy match contra todos os SKUs
    """
    if not skus:
        log.error("Lista de SKUs vazia.")
        return []

    sku_norms     = [s[0] for s in skus]
    sku_originals = [s[1] for s in skus]
    sku_suppliers = [s[2] for s in skus]

    # Índices por fornecedor para restringir busca no mapeamento direto
    supplier_indices: dict[str, list[int]] = {}
    for idx, (_, _, sup) in enumerate(skus):
        supplier_indices.setdefault(sup, []).append(idx)

    results = []
    total = len(images)
    direct_count = 0
    fuzzy_count  = 0

    for i, img in enumerate(images, 1):
        if i % 100 == 0:
            log.info(f"  Matching {i}/{total}...")

        code         = img.get("supplier_code")
        product_norm = img["product_norm"]
        mapped_supplier = SUPPLIER_CODE_MAP.get(code) if code else None

        # --- Mapeamento direto ---
        if mapped_supplier:
            indices = supplier_indices.get(mapped_supplier, [])
            if indices:
                candidate_norms = [sku_norms[j] for j in indices]
                matches = process.extract(
                    product_norm, candidate_norms,
                    scorer=fuzz.token_sort_ratio, limit=2
                )
                best_norm, best_score, best_local_idx = matches[0]
                best_idx     = indices[best_local_idx]
                best_sku     = sku_originals[best_idx]
                best_supplier = mapped_supplier

                second_sku = second_supplier = ""
                second_score = 0
                if len(matches) > 1:
                    _, second_score, second_local_idx = matches[1]
                    second_idx      = indices[second_local_idx]
                    second_sku      = sku_originals[second_idx]
                    second_supplier = mapped_supplier

                method = "direto"
                direct_count += 1
            else:
                # Fornecedor mapeado mas sem SKUs na planilha → fuzzy geral
                best_sku = best_supplier = ""
                best_score = 0
                second_sku = second_supplier = ""
                second_score = 0
                method = "sem_skus"

        # --- Fuzzy geral ---
        else:
            matches = process.extract(
                product_norm, sku_norms,
                scorer=fuzz.token_sort_ratio, limit=2
            )
            if not matches:
                results.append({**img, "above_threshold": False})
                continue

            best_norm, best_score, best_idx = matches[0]
            best_sku      = sku_originals[best_idx]
            best_supplier = sku_suppliers[best_idx]

            second_sku = second_supplier = ""
            second_score = 0
            if len(matches) > 1:
                _, second_score, second_idx = matches[1]
                second_sku      = sku_originals[second_idx]
                second_supplier = sku_suppliers[second_idx]

            method = "fuzzy"
            fuzzy_count += 1

        conf      = confidence_label(best_score)
        ambiguous = (best_score - second_score) < AMBIGUITY_GAP and bool(second_sku)

        results.append({
            **img,
            "fornecedor":       best_supplier,
            "sku_match":        best_sku,
            "score":            best_score,
            "confidence":       conf,
            "second_candidate": f"{second_sku} — {second_supplier}" if second_sku else "",
            "second_score":     second_score,
            "ambiguous":        ambiguous,
            "method":           method,
            "above_threshold":  best_score >= SIMILARITY_THRESHOLD or method == "direto",
        })

    log.info(f"Matching concluído: {direct_count} diretos | {fuzzy_count} fuzzy")
    return results


# ---------------------------------------------------------------------------
# Geração do relatório Excel
# ---------------------------------------------------------------------------

GREEN_FILL  = PatternFill("solid", fgColor="EAF3DE")
YELLOW_FILL = PatternFill("solid", fgColor="FAEEDA")
RED_FILL    = PatternFill("solid", fgColor="FCEBEB")
BLUE_FILL   = PatternFill("solid", fgColor="E6F1FB")
HEADER_FILL = PatternFill("solid", fgColor="D3D1C7")
THIN_BORDER = Border(
    left=Side(style="thin", color="CCCCCC"),
    right=Side(style="thin", color="CCCCCC"),
    top=Side(style="thin", color="CCCCCC"),
    bottom=Side(style="thin", color="CCCCCC"),
)


def style_header(ws, row_num: int, col_count: int):
    for col in range(1, col_count + 1):
        cell = ws.cell(row=row_num, column=col)
        cell.fill = HEADER_FILL
        cell.font = Font(bold=True, size=10)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
    ws.row_dimensions[row_num].height = 28


def row_fill_for(confidence: str, ambiguous: bool, method: str) -> PatternFill:
    if method == "direto":
        return BLUE_FILL
    if ambiguous:
        return YELLOW_FILL
    if confidence == "Alta":
        return GREEN_FILL
    if confidence == "Média":
        return YELLOW_FILL
    return RED_FILL


def write_data_rows(ws, rows_data, headers):
    for r in rows_data:
        conf     = r.get("confidence", "Sem match")
        method   = r.get("method", "fuzzy")
        ambig    = r.get("ambiguous", False)
        fill     = row_fill_for(conf, ambig, method)
        above    = r.get("above_threshold", False)

        default_action = "CONFIRMAR" if above and conf == "Alta" and not ambig else ""

        row = [
            r["name"],
            r["path"],
            r.get("supplier_code", ""),
            r.get("method", ""),
            r.get("fornecedor", ""),
            r.get("sku_match", ""),
            r.get("score", 0),
            conf if above else "Sem match",
            r.get("second_candidate", ""),
            r.get("second_score", 0),
            "Sim" if ambig else "Não",
            default_action,
        ]
        ws.append(row)
        for col in range(1, len(headers) + 1):
            cell = ws.cell(row=ws.max_row, column=col)
            cell.fill = fill
            cell.font = Font(size=10)
            cell.alignment = Alignment(vertical="center")
            cell.border = THIN_BORDER


HEADERS = [
    "imagem", "caminho_drive", "codigo_fornecedor", "metodo",
    "fornecedor", "sku_match", "score", "confiança",
    "2º candidato", "score_2º", "ambíguo", "ação",
]
COL_WIDTHS = [28, 45, 16, 10, 22, 30, 8, 10, 40, 9, 9, 14]


def setup_sheet_columns(ws):
    for i, w in enumerate(COL_WIDTHS, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    ws.freeze_panes = "A2"


def generate_report(results: list[dict], output_path: str,
                    version_num: int = 1, prev_stats: dict | None = None):
    wb = openpyxl.Workbook()

    all_valid  = [r for r in results if r.get("above_threshold")]
    for_review = [r for r in results if r.get("above_threshold") and
                  (r.get("confidence") != "Alta" or r.get("ambiguous"))]
    no_match   = [r for r in results if not r.get("above_threshold")]

    # --- Aba 1: Análise Completa ---
    ws1 = wb.active
    ws1.title = "Análise Completa"
    ws1.append(HEADERS)
    style_header(ws1, 1, len(HEADERS))
    setup_sheet_columns(ws1)
    write_data_rows(ws1, sorted(results, key=lambda x: x.get("score", 0), reverse=True), HEADERS)

    # --- Aba 2: Para Revisão ---
    ws2 = wb.create_sheet("Para Revisão")
    ws2.append(HEADERS)
    style_header(ws2, 1, len(HEADERS))
    setup_sheet_columns(ws2)
    write_data_rows(ws2, sorted(for_review, key=lambda x: x.get("score", 0), reverse=True), HEADERS)

    # --- Aba 3: Sem Match ---
    ws3 = wb.create_sheet("Sem Match")
    no_match_headers = ["imagem", "caminho_drive", "codigo_fornecedor", "melhor_candidato", "score", "ação"]
    ws3.append(no_match_headers)
    style_header(ws3, 1, len(no_match_headers))
    for w, col in zip([30, 50, 16, 35, 8, 14], range(1, 7)):
        ws3.column_dimensions[openpyxl.utils.get_column_letter(col)].width = w
    ws3.freeze_panes = "A2"
    for r in no_match:
        ws3.append([
            r["name"], r["path"], r.get("supplier_code", ""),
            r.get("sku_match", ""), r.get("score", 0), "",
        ])
        for col in range(1, 7):
            cell = ws3.cell(row=ws3.max_row, column=col)
            cell.fill = RED_FILL
            cell.font = Font(size=10)
            cell.border = THIN_BORDER
    ws3.freeze_panes = "A2"

    # --- Aba 4: Resumo por Fornecedor ---
    ws4 = wb.create_sheet("Resumo por Fornecedor")
    ws4.append(["fornecedor", "total", "direto", "alta", "média", "baixa", "sem_match"])
    style_header(ws4, 1, 7)
    for col in range(1, 8):
        ws4.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 18
    ws4.freeze_panes = "A2"

    from collections import defaultdict
    summary = defaultdict(lambda: {"total": 0, "direto": 0, "Alta": 0, "Média": 0, "Baixa": 0, "sem_match": 0})
    for r in results:
        s = r.get("fornecedor") or "Sem fornecedor"
        summary[s]["total"] += 1
        if not r.get("above_threshold"):
            summary[s]["sem_match"] += 1
        else:
            if r.get("method") == "direto":
                summary[s]["direto"] += 1
            summary[s][r.get("confidence", "Baixa")] += 1

    for supplier, data in sorted(summary.items()):
        ws4.append([supplier, data["total"], data["direto"],
                    data["Alta"], data["Média"], data["Baixa"], data["sem_match"]])
        for col in range(1, 8):
            cell = ws4.cell(row=ws4.max_row, column=col)
            cell.font = Font(size=10)
            cell.border = THIN_BORDER

    # --- Aba 5: Legenda de Códigos ---
    ws5 = wb.create_sheet("Legenda Códigos")
    ws5.append(["codigo", "fornecedor_mapeado", "qtd_imagens", "status"])
    style_header(ws5, 1, 4)
    for col, w in zip(range(1, 5), [12, 28, 14, 22]):
        ws5.column_dimensions[openpyxl.utils.get_column_letter(col)].width = w
    ws5.freeze_panes = "A2"

    from collections import Counter
    code_counts = Counter(r.get("supplier_code") for r in results if r.get("supplier_code"))
    from config import SUPPLIER_CODE_MAP as CODE_MAP
    for code, count in sorted(code_counts.items()):
        mapped = CODE_MAP.get(code)
        status = "Mapeado" if mapped else "Pendente — preencha o fornecedor"
        ws5.append([code, mapped or "", count, status])
        fill = GREEN_FILL if mapped else YELLOW_FILL
        for col in range(1, 5):
            cell = ws5.cell(row=ws5.max_row, column=col)
            cell.fill = fill
            cell.font = Font(size=10)
            cell.border = THIN_BORDER

    # --- Aba 6: Resumo da Versão ---
    ws6 = wb.create_sheet("Resumo da Versão")
    ws6.column_dimensions["A"].width = 30
    ws6.column_dimensions["B"].width = 18
    ws6.column_dimensions["C"].width = 20
    ws6.column_dimensions["D"].width = 30

    # Calcula stats desta execução
    total      = len(results)
    direto     = sum(1 for r in results if r.get("method") == "direto")
    alta       = sum(1 for r in results if r.get("confidence") == "Alta" and r.get("above_threshold"))
    media      = sum(1 for r in results if r.get("confidence") == "Média" and r.get("above_threshold"))
    baixa      = sum(1 for r in results if r.get("confidence") == "Baixa" and r.get("above_threshold"))
    sem_match  = sum(1 for r in results if not r.get("above_threshold"))
    ambiguous  = sum(1 for r in results if r.get("ambiguous"))
    run_ts     = datetime.now().strftime("%Y-%m-%d %H:%M")

    current_stats = {
        "versao":    version_num,
        "data_hora": run_ts,
        "total":     total,
        "direto":    direto,
        "alta":      alta,
        "media":     media,
        "baixa":     baixa,
        "sem_match": sem_match,
        "ambiguos":  ambiguous,
    }

    # Cabeçalho
    ws6.append(["métrica", "valor_atual", "valor_anterior", "delta"])
    style_header(ws6, 1, 4)
    ws6.freeze_panes = "A2"

    def delta_str(key, current_val):
        if prev_stats is None:
            return "—"
        prev_val = prev_stats.get(key)
        if prev_val is None:
            return "—"
        try:
            diff = int(current_val) - int(prev_val)
            if diff > 0:
                return f"+{diff}"
            return str(diff)
        except (ValueError, TypeError):
            return "—"

    def delta_fill(key, current_val, good_direction="up"):
        """Colorir delta: verde se melhorou, vermelho se piorou."""
        if prev_stats is None:
            return None
        prev_val = prev_stats.get(key)
        if prev_val is None:
            return None
        try:
            diff = int(current_val) - int(prev_val)
            if diff == 0:
                return None
            improved = diff > 0 if good_direction == "up" else diff < 0
            return GREEN_FILL if improved else RED_FILL
        except (ValueError, TypeError):
            return None

    metrics = [
        ("versão",         "versao",    version_num,  None),
        ("data / hora",    "data_hora", run_ts,       None),
        ("total imagens",  "total",     total,        None),
        ("mapeam. direto", "direto",    direto,       "up"),
        ("confiança Alta", "alta",      alta,         "up"),
        ("confiança Média","media",     media,        None),
        ("confiança Baixa","baixa",     baixa,        "down"),
        ("sem match",      "sem_match", sem_match,    "down"),
        ("ambíguos",       "ambiguos",  ambiguous,    "down"),
    ]

    for label, key, val, direction in metrics:
        prev_val = (prev_stats or {}).get(key, "—")
        d_str  = delta_str(key, val) if direction else "—"
        ws6.append([label, val, prev_val, d_str])

        row_idx = ws6.max_row
        # Colorir delta
        if direction:
            fill = delta_fill(key, val, direction)
            if fill:
                ws6.cell(row=row_idx, column=4).fill = fill

        for col in range(1, 5):
            cell = ws6.cell(row=row_idx, column=col)
            cell.font = Font(size=10)
            cell.border = THIN_BORDER

    wb.save(output_path)
    log.info(f"Relatório salvo em: {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log.info("=== FASE 1 — Extração, Matching e Relatório ===")

    service = authenticate()
    log.info("Autenticado no Google Drive.")

    skus   = load_all_skus(service)
    images = load_all_images(service)

    if not skus:
        log.error("Nenhum SKU extraído. Verifique DRIVE_SPREADSHEETS_FOLDER_ID e as planilhas.")
        return
    if not images:
        log.error("Nenhuma imagem encontrada. Verifique DRIVE_IMAGES_FOLDER_ID.")
        return

    log.info(f"Iniciando matching: {len(images)} imagens × {len(skus)} SKUs...")
    results = match_images_to_skus(images, skus)

    # --- Versionamento ---
    versioned_path, latest_path, version_num = get_versioned_path(ANALYSIS_REPORT_PATH)
    prev_stats = load_previous_stats(latest_path)

    if prev_stats:
        log.info(f"Versão anterior encontrada (v{int(prev_stats.get('versao', 0)):03d}). Calculando delta...")
    else:
        log.info("Nenhuma versão anterior encontrada. Esta é a v001.")

    log.info(f"Salvando relatório como versão v{version_num:03d}...")
    generate_report(results, versioned_path, version_num=version_num, prev_stats=prev_stats)

    # Sobrescreve o LATEST com uma cópia
    import shutil
    shutil.copy2(versioned_path, latest_path)
    log.info(f"LATEST atualizado: {latest_path}")

    direct = sum(1 for r in results if r.get("method") == "direto")
    high   = sum(1 for r in results if r.get("confidence") == "Alta")
    above  = sum(1 for r in results if r.get("above_threshold"))
    log.info(f"Resultado: {above}/{len(results)} com match | {direct} mapeamento direto | {high} alta confiança")
    log.info(f"Relatório versionado : {versioned_path}")
    log.info(f"Relatório LATEST     : {latest_path}")


if __name__ == "__main__":
    main()
