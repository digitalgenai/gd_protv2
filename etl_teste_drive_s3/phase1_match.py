"""
FASE 1 — Extração, Matching e Relatório de Análise
===================================================
1. Autentica no Google Drive via service account
2. Varre a pasta de planilhas recursivamente, lendo apenas "Tabelas Atuais"
3. Extrai SKUs/nomes de produto de todas as abas de cada planilha
4. Varre a pasta PRODUTOS recursivamente e lista todas as imagens
5. Faz fuzzy matching: cada imagem × todos os SKUs de todos os fornecedores
6. Gera relatorio_analise.xlsx com as associações para revisão humana

Uso:
    python phase1_match.py
"""

import io
import os
import re
import unicodedata
import logging
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
    ANALYSIS_REPORT_PATH,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
]

# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------

def authenticate():
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=SCOPES
    )
    service = build("drive", "v3", credentials=creds)
    return service


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
    return text


def is_skip_tab(tab_name: str) -> bool:
    norm = normalize(tab_name)
    return any(kw in norm for kw in TABS_TO_SKIP_KEYWORDS)


def is_valid_sku(value: str) -> bool:
    """Filtra valores muito curtos, puramente numéricos ou claramente não-SKU."""
    v = str(value).strip()
    if len(v) < 3:
        return False
    if re.match(r"^[\d\s.,]+$", v):
        return False
    return True


# ---------------------------------------------------------------------------
# Google Drive — listagem recursiva
# ---------------------------------------------------------------------------

def list_folder_recursive(service, folder_id: str, path: str = "") -> list[dict]:
    """
    Retorna lista de dicts com info de cada arquivo (não-pasta) encontrado
    recursivamente, incluindo o caminho de pastas até o arquivo.
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
            f["path"] = f"{path}/{f['name']}" if path else f["name"]
            if f["mimeType"] == "application/vnd.google-apps.folder":
                items.extend(list_folder_recursive(service, f["id"], f["path"]))
            else:
                items.append(f)

        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return items


def build_folder_map(service, folder_id: str) -> dict[str, dict]:
    """
    Monta um mapa {folder_id: {name, parent_id}} para rastrear hierarquia.
    """
    folder_map = {}
    page_token = None
    while True:
        resp = service.files().list(
            q=f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken, files(id, name)",
            pageToken=page_token,
            pageSize=1000,
        ).execute()
        for f in resp.get("files", []):
            folder_map[f["id"]] = {"name": f["name"], "parent_id": folder_id}
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return folder_map


# ---------------------------------------------------------------------------
# Download de arquivo do Drive em memória
# ---------------------------------------------------------------------------

def download_file(service, file_id: str, mime_type: str) -> bytes:
    """
    Baixa um arquivo do Drive em memória.
    Para Google Sheets nativos, exporta como xlsx.
    """
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

def extract_skus_from_xlsx(data: bytes, supplier: str) -> list[tuple[str, str]]:
    """
    Retorna lista de (sku_normalizado, fornecedor) extraídos de todas as abas.
    """
    skus = []
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as e:
        log.warning(f"  Não foi possível abrir xlsx: {e}")
        return skus

    for sheet_name in wb.sheetnames:
        if is_skip_tab(sheet_name):
            log.debug(f"  Pulando aba: {sheet_name}")
            continue

        ws = wb[sheet_name]
        sku_col_idx = None
        headers = []

        for row in ws.iter_rows(min_row=1, max_row=10, values_only=True):
            for idx, cell in enumerate(row):
                if cell and normalize(str(cell)) in SKU_COLUMN_NAMES:
                    sku_col_idx = idx
                    break
            if sku_col_idx is not None:
                break

        if sku_col_idx is None:
            # Fallback: usa a primeira coluna com strings longas o suficiente
            for row in ws.iter_rows(min_row=1, max_row=20, values_only=True):
                for idx, cell in enumerate(row):
                    if cell and isinstance(cell, str) and len(cell.strip()) > 4:
                        sku_col_idx = idx
                        break
                if sku_col_idx is not None:
                    break

        if sku_col_idx is None:
            log.debug(f"  Aba '{sheet_name}': coluna SKU não identificada, pulando.")
            continue

        count = 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            if sku_col_idx < len(row):
                val = row[sku_col_idx]
                if val and is_valid_sku(str(val)):
                    skus.append((normalize(str(val)), str(val).strip(), supplier))
                    count += 1

        log.info(f"  Aba '{sheet_name}': {count} SKUs extraídos (coluna {sku_col_idx})")

    wb.close()
    return skus


def extract_skus_from_xls(data: bytes, supplier: str) -> list[tuple[str, str, str]]:
    """Mesmo que extract_skus_from_xlsx mas para formato .xls antigo."""
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
        sku_col_idx = None

        for r in range(min(10, ws.nrows)):
            for c in range(ws.ncols):
                val = ws.cell_value(r, c)
                if val and normalize(str(val)) in SKU_COLUMN_NAMES:
                    sku_col_idx = c
                    break
            if sku_col_idx is not None:
                break

        if sku_col_idx is None:
            for r in range(min(20, ws.nrows)):
                for c in range(ws.ncols):
                    val = ws.cell_value(r, c)
                    if val and isinstance(val, str) and len(val.strip()) > 4:
                        sku_col_idx = c
                        break
                if sku_col_idx is not None:
                    break

        if sku_col_idx is None:
            continue

        count = 0
        for r in range(1, ws.nrows):
            val = ws.cell_value(r, sku_col_idx)
            if val and is_valid_sku(str(val)):
                skus.append((normalize(str(val)), str(val).strip(), supplier))
                count += 1

        log.info(f"  Aba '{sheet_name}': {count} SKUs extraídos (coluna {sku_col_idx})")

    return skus


# ---------------------------------------------------------------------------
# Carrega todas as planilhas e constrói o dicionário de SKUs
# ---------------------------------------------------------------------------

SPREADSHEET_MIMES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.google-apps.spreadsheet",
}


def load_all_skus(service) -> list[tuple[str, str, str]]:
    """
    Retorna lista de (sku_normalizado, sku_original, fornecedor).
    """
    if not DRIVE_SPREADSHEETS_FOLDER_ID:
        log.error("DRIVE_SPREADSHEETS_FOLDER_ID não configurado em config.py / .env")
        return []

    log.info("Listando arquivos de planilhas no Drive...")
    all_files = list_folder_recursive(service, DRIVE_SPREADSHEETS_FOLDER_ID)
    log.info(f"Total de arquivos encontrados: {len(all_files)}")

    all_skus = []
    processed = set()

    for f in all_files:
        if f["mimeType"] not in SPREADSHEET_MIMES:
            continue

        path = f.get("path", "")

        # Só processa arquivos dentro de pastas "Tabelas Atuais"
        path_lower = path.lower()
        if CURRENT_TABLE_KEYWORD not in path_lower:
            continue

        # Extrai nome do fornecedor: primeira pasta do caminho
        parts = path.split("/")
        supplier = parts[0] if parts else "Desconhecido"
        # Remove sufixo numérico tipo " - 01"
        supplier = re.sub(r"\s*-\s*\d+$", "", supplier).strip()

        if f["id"] in processed:
            continue
        processed.add(f["id"])

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
        log.info(f"  Total acumulado até agora: {len(all_skus)} SKUs")

    log.info(f"SKUs totais extraídos de todas as planilhas: {len(all_skus)}")
    return all_skus


# ---------------------------------------------------------------------------
# Carrega todas as imagens do Drive
# ---------------------------------------------------------------------------

def load_all_images(service) -> list[dict]:
    """
    Retorna lista de dicts com {id, name, path, stem (nome sem extensão)}.
    """
    log.info("Listando imagens na pasta PRODUTOS...")
    all_files = list_folder_recursive(service, DRIVE_IMAGES_FOLDER_ID)
    images = []
    for f in all_files:
        stem = Path(f["name"]).stem
        ext = Path(f["name"]).suffix.lower()
        if ext in IMAGE_EXTENSIONS:
            images.append({
                "id": f["id"],
                "name": f["name"],
                "path": f.get("path", f["name"]),
                "stem": stem,
                "stem_norm": normalize(stem),
            })
    log.info(f"Total de imagens encontradas: {len(images)}")
    return images


# ---------------------------------------------------------------------------
# Fuzzy Matching
# ---------------------------------------------------------------------------

def match_images_to_skus(images: list[dict], skus: list[tuple]) -> list[dict]:
    """
    Para cada imagem, encontra o SKU mais similar.
    Retorna lista de resultados com scores e metadados.
    """
    if not skus:
        log.error("Lista de SKUs vazia — verifique o DRIVE_SPREADSHEETS_FOLDER_ID.")
        return []

    # Cria lista de chaves normalizadas para o process.extract
    sku_norms   = [s[0] for s in skus]
    sku_originals = [s[1] for s in skus]
    sku_suppliers = [s[2] for s in skus]

    results = []
    total = len(images)

    for i, img in enumerate(images, 1):
        if i % 50 == 0:
            log.info(f"Matching {i}/{total}...")

        # Busca os 2 melhores matches
        matches = process.extract(
            img["stem_norm"],
            sku_norms,
            scorer=fuzz.token_sort_ratio,
            limit=2,
        )

        if not matches:
            results.append({**img, "match": None})
            continue

        best_norm, best_score, best_idx = matches[0]
        best_sku      = sku_originals[best_idx]
        best_supplier = sku_suppliers[best_idx]

        second_sku      = ""
        second_supplier = ""
        second_score    = 0
        ambiguous       = False

        if len(matches) > 1:
            _, second_score, second_idx = matches[1]
            second_sku      = sku_originals[second_idx]
            second_supplier = sku_suppliers[second_idx]
            ambiguous = (best_score - second_score) < AMBIGUITY_GAP

        # Nível de confiança
        if best_score >= HIGH_CONFIDENCE_THRESHOLD:
            confidence = "Alta"
        elif best_score >= MEDIUM_CONFIDENCE_THRESHOLD:
            confidence = "Média"
        else:
            confidence = "Baixa"

        results.append({
            **img,
            "fornecedor":        best_supplier,
            "sku_match":         best_sku,
            "score":             best_score,
            "confidence":        confidence,
            "second_candidate":  f"{second_sku} — {second_supplier}" if second_sku else "",
            "second_score":      second_score,
            "ambiguous":         ambiguous,
            "above_threshold":   best_score >= SIMILARITY_THRESHOLD,
        })

    return results


# ---------------------------------------------------------------------------
# Geração do relatório Excel
# ---------------------------------------------------------------------------

# Paleta de cores
GREEN_FILL  = PatternFill("solid", fgColor="EAF3DE")
YELLOW_FILL = PatternFill("solid", fgColor="FAEEDA")
RED_FILL    = PatternFill("solid", fgColor="FCEBEB")
HEADER_FILL = PatternFill("solid", fgColor="F1EFE8")
GRAY_FILL   = PatternFill("solid", fgColor="E8E8E8")

THIN_BORDER = Border(
    left=Side(style="thin", color="CCCCCC"),
    right=Side(style="thin", color="CCCCCC"),
    top=Side(style="thin", color="CCCCCC"),
    bottom=Side(style="thin", color="CCCCCC"),
)


def style_header_row(ws, row_num: int, col_count: int):
    for col in range(1, col_count + 1):
        cell = ws.cell(row=row_num, column=col)
        cell.fill = HEADER_FILL
        cell.font = Font(bold=True, size=10)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER


def row_fill(confidence: str, ambiguous: bool) -> PatternFill:
    if ambiguous:
        return YELLOW_FILL
    if confidence == "Alta":
        return GREEN_FILL
    if confidence == "Média":
        return YELLOW_FILL
    return RED_FILL


def generate_report(results: list[dict], output_path: str):
    wb = openpyxl.Workbook()

    all_valid   = [r for r in results if r.get("above_threshold")]
    for_review  = [r for r in results if r.get("above_threshold") and (r.get("confidence") != "Alta" or r.get("ambiguous"))]
    no_match    = [r for r in results if not r.get("above_threshold")]

    # -----------------------------------------------------------------------
    # Aba 1 — Análise Completa
    # -----------------------------------------------------------------------
    ws1 = wb.active
    ws1.title = "Análise Completa"

    headers = [
        "imagem", "caminho_drive", "fornecedor", "sku_match",
        "score", "confiança", "2º candidato", "score_2º",
        "ambíguo", "ação",
    ]
    col_widths = [28, 45, 18, 30, 8, 10, 40, 9, 9, 14]

    ws1.append(headers)
    style_header_row(ws1, 1, len(headers))
    for i, w in enumerate(col_widths, 1):
        ws1.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    ws1.row_dimensions[1].height = 30

    for r in sorted(results, key=lambda x: x.get("score", 0), reverse=True):
        if not r.get("above_threshold"):
            conf = "Sem match"
            fill = RED_FILL
        else:
            conf = r.get("confidence", "")
            fill = row_fill(conf, r.get("ambiguous", False))

        row = [
            r["name"],
            r["path"],
            r.get("fornecedor", ""),
            r.get("sku_match", ""),
            r.get("score", 0),
            conf,
            r.get("second_candidate", ""),
            r.get("second_score", 0),
            "Sim" if r.get("ambiguous") else "Não",
            "CONFIRMAR" if r.get("above_threshold") and conf == "Alta" and not r.get("ambiguous") else "",
        ]
        ws1.append(row)
        for col in range(1, len(headers) + 1):
            cell = ws1.cell(row=ws1.max_row, column=col)
            cell.fill = fill
            cell.font = Font(size=10)
            cell.alignment = Alignment(vertical="center")
            cell.border = THIN_BORDER

    ws1.freeze_panes = "A2"

    # -----------------------------------------------------------------------
    # Aba 2 — Para Revisão
    # -----------------------------------------------------------------------
    ws2 = wb.create_sheet("Para Revisão")
    ws2.append(headers)
    style_header_row(ws2, 1, len(headers))
    for i, w in enumerate(col_widths, 1):
        ws2.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

    for r in sorted(for_review, key=lambda x: x.get("score", 0), reverse=True):
        fill = row_fill(r.get("confidence", ""), r.get("ambiguous", False))
        row = [
            r["name"], r["path"], r.get("fornecedor", ""), r.get("sku_match", ""),
            r.get("score", 0), r.get("confidence", ""),
            r.get("second_candidate", ""), r.get("second_score", 0),
            "Sim" if r.get("ambiguous") else "Não", "",
        ]
        ws2.append(row)
        for col in range(1, len(headers) + 1):
            cell = ws2.cell(row=ws2.max_row, column=col)
            cell.fill = fill
            cell.font = Font(size=10)
            cell.border = THIN_BORDER
    ws2.freeze_panes = "A2"

    # -----------------------------------------------------------------------
    # Aba 3 — Sem Match
    # -----------------------------------------------------------------------
    ws3 = wb.create_sheet("Sem Match")
    ws3.append(["imagem", "caminho_drive", "melhor_candidato", "score", "ação"])
    style_header_row(ws3, 1, 5)
    ws3.column_dimensions["A"].width = 30
    ws3.column_dimensions["B"].width = 50
    ws3.column_dimensions["C"].width = 35
    ws3.column_dimensions["D"].width = 8
    ws3.column_dimensions["E"].width = 14

    for r in no_match:
        ws3.append([
            r["name"], r["path"],
            r.get("sku_match", ""), r.get("score", 0), "",
        ])
        for col in range(1, 6):
            cell = ws3.cell(row=ws3.max_row, column=col)
            cell.fill = RED_FILL
            cell.font = Font(size=10)
            cell.border = THIN_BORDER
    ws3.freeze_panes = "A2"

    # -----------------------------------------------------------------------
    # Aba 4 — Resumo por Fornecedor
    # -----------------------------------------------------------------------
    ws4 = wb.create_sheet("Resumo por Fornecedor")
    ws4.append(["fornecedor", "total_imagens", "alta", "média", "baixa", "sem_match"])
    style_header_row(ws4, 1, 6)
    ws4.column_dimensions["A"].width = 25
    for col in "BCDEF":
        ws4.column_dimensions[col].width = 14

    from collections import defaultdict
    summary = defaultdict(lambda: {"total": 0, "Alta": 0, "Média": 0, "Baixa": 0, "sem_match": 0})
    for r in results:
        s = r.get("fornecedor", "Sem match") or "Sem match"
        summary[s]["total"] += 1
        if not r.get("above_threshold"):
            summary[s]["sem_match"] += 1
        else:
            summary[s][r.get("confidence", "Baixa")] += 1

    for supplier, data in sorted(summary.items()):
        ws4.append([
            supplier, data["total"],
            data["Alta"], data["Média"], data["Baixa"], data["sem_match"],
        ])
        for col in range(1, 7):
            cell = ws4.cell(row=ws4.max_row, column=col)
            cell.font = Font(size=10)
            cell.border = THIN_BORDER
    ws4.freeze_panes = "A2"

    wb.save(output_path)
    log.info(f"Relatório salvo em: {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log.info("=== FASE 1 — Extração, Matching e Relatório ===")

    service = authenticate()
    log.info("Autenticado no Google Drive.")

    skus    = load_all_skus(service)
    images  = load_all_images(service)

    if not skus:
        log.error("Nenhum SKU extraído. Verifique DRIVE_SPREADSHEETS_FOLDER_ID e as planilhas.")
        return
    if not images:
        log.error("Nenhuma imagem encontrada. Verifique DRIVE_IMAGES_FOLDER_ID.")
        return

    log.info(f"Iniciando matching: {len(images)} imagens × {len(skus)} SKUs...")
    results = match_images_to_skus(images, skus)

    generate_report(results, ANALYSIS_REPORT_PATH)

    above = sum(1 for r in results if r.get("above_threshold"))
    high  = sum(1 for r in results if r.get("confidence") == "Alta")
    log.info(f"Concluído. {above}/{len(results)} com match. {high} de alta confiança.")
    log.info(f"Abra '{ANALYSIS_REPORT_PATH}' para revisar as associações.")


if __name__ == "__main__":
    main()
