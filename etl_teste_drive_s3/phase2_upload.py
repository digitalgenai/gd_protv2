"""
FASE 2 — Upload para o S3
=========================
Lê o relatorio_analise.xlsx já revisado e faz upload das imagens confirmadas
para o S3 na estrutura:  s3://<bucket>/<fornecedor>/<sku>/<imagem>

Apenas linhas com ação == "CONFIRMAR" na aba "Análise Completa" são processadas.

Uso:
    python phase2_upload.py

Pré-requisitos:
    - relatorio_analise.xlsx revisado e salvo com a coluna "ação" preenchida
    - Credenciais AWS configuradas no .env ou no ambiente
"""

import io
import logging
import re
import unicodedata

import boto3
import openpyxl
from botocore.exceptions import ClientError
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from config import (
    CREDENTIALS_PATH,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    S3_BUCKET_NAME,
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
# Autenticação
# ---------------------------------------------------------------------------

def authenticate_google():
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


def authenticate_s3():
    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION,
    )


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """Converte nome para slug seguro para S3: lowercase, sem acentos, hífens."""
    text = str(text).strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def s3_key(supplier: str, sku: str, filename: str) -> str:
    """Monta a chave S3: fornecedor/sku/imagem.ext"""
    return f"{slugify(supplier)}/{slugify(sku)}/{filename}"


def file_exists_in_s3(s3_client, bucket: str, key: str) -> bool:
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


# ---------------------------------------------------------------------------
# Leitura do relatório
# ---------------------------------------------------------------------------

def read_confirmed_rows(report_path: str) -> list[dict]:
    """
    Lê a aba 'Análise Completa' e retorna apenas linhas com ação == CONFIRMAR.
    """
    wb = openpyxl.load_workbook(report_path, read_only=True, data_only=True)

    if "Análise Completa" not in wb.sheetnames:
        log.error("Aba 'Análise Completa' não encontrada no relatório.")
        return []

    ws = wb["Análise Completa"]
    headers = []
    rows = []

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            headers = [str(c).strip().lower() if c else "" for c in row]
            continue
        if not any(row):
            continue
        record = dict(zip(headers, row))
        acao = str(record.get("ação", "")).strip().upper()
        if acao == "CONFIRMAR":
            rows.append(record)

    wb.close()
    log.info(f"{len(rows)} linhas marcadas como CONFIRMAR no relatório.")
    return rows


# ---------------------------------------------------------------------------
# Download do arquivo do Drive
# ---------------------------------------------------------------------------

def download_image(drive_service, file_id: str) -> bytes:
    request = drive_service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()


def find_file_id_by_path(drive_service, path: str) -> str | None:
    """
    Busca o file_id de um arquivo pelo nome exato no Drive.
    Usa o nome do arquivo (última parte do caminho) para busca.
    """
    filename = path.split("/")[-1]
    resp = drive_service.files().list(
        q=f"name='{filename}' and trashed=false",
        fields="files(id, name)",
        pageSize=10,
    ).execute()
    files = resp.get("files", [])
    if not files:
        return None
    return files[0]["id"]


# ---------------------------------------------------------------------------
# Upload para S3
# ---------------------------------------------------------------------------

def upload_image(s3_client, data: bytes, bucket: str, key: str, filename: str):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_types = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "gif": "image/gif",
        "webp": "image/webp", "bmp": "image/bmp",
        "tiff": "image/tiff", "svg": "image/svg+xml",
    }
    content_type = content_types.get(ext, "application/octet-stream")

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log.info("=== FASE 2 — Upload para S3 ===")

    if not S3_BUCKET_NAME:
        log.error("S3_BUCKET_NAME não configurado.")
        return

    rows = read_confirmed_rows(ANALYSIS_REPORT_PATH)
    if not rows:
        log.warning("Nenhuma linha para processar. Preencha a coluna 'ação' no relatório.")
        return

    drive_service = authenticate_google()
    s3_client     = authenticate_s3()

    total    = len(rows)
    success  = 0
    skipped  = 0
    errors   = 0

    for i, row in enumerate(rows, 1):
        filename  = str(row.get("imagem", "")).strip()
        path      = str(row.get("caminho_drive", "")).strip()
        supplier  = str(row.get("fornecedor", "")).strip()
        sku       = str(row.get("sku_match", "")).strip()

        if not filename or not supplier or not sku:
            log.warning(f"[{i}/{total}] Linha incompleta, pulando: {row}")
            errors += 1
            continue

        key = s3_key(supplier, sku, filename)
        log.info(f"[{i}/{total}] {filename} → s3://{S3_BUCKET_NAME}/{key}")

        # Evita reprocessar arquivos já enviados
        if file_exists_in_s3(s3_client, S3_BUCKET_NAME, key):
            log.info(f"  Já existe no S3, pulando.")
            skipped += 1
            continue

        # Busca o file_id pelo caminho registrado no relatório
        file_id = find_file_id_by_path(drive_service, path)
        if not file_id:
            log.error(f"  Arquivo não encontrado no Drive: {filename}")
            errors += 1
            continue

        try:
            data = download_image(drive_service, file_id)
            upload_image(s3_client, data, S3_BUCKET_NAME, key, filename)
            success += 1
        except Exception as e:
            log.error(f"  Erro ao processar {filename}: {e}")
            errors += 1

    log.info("=" * 50)
    log.info(f"Concluído: {success} enviados | {skipped} já existiam | {errors} erros")
    log.info(f"Estrutura no S3: s3://{S3_BUCKET_NAME}/<fornecedor>/<sku>/<imagem>")


if __name__ == "__main__":
    main()
