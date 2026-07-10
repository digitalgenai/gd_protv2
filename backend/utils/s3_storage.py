import mimetypes
import os
import re
import uuid

import boto3

from config import AWS_REGION, AWS_S3_BUCKET, AWS_S3_PREFIX

_s3 = boto3.client("s3", region_name=AWS_REGION)
_PUBLIC_URL_PREFIX = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/"


def _safe_code(codigo: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", codigo).strip("_") or "sem_codigo"


def save_image(codigo: str, original_filename: str, data: bytes) -> tuple[str, str]:
    """
    Envia os bytes para o S3 em <prefix>/<codigo>/<arquivo> e retorna (url_publica, filename).
    Mesma assinatura de utils/image_storage.py (disco local) — troca de storage é só
    mudar o import em routes/produtos.py, sem tocar em nenhuma rota (ver MAPEAMENTO_S3.md).
    """
    safe_code = _safe_code(codigo)
    ext = os.path.splitext(original_filename or "imagem.jpg")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    key = f"{AWS_S3_PREFIX}/{safe_code}/{filename}"

    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    _s3.put_object(Bucket=AWS_S3_BUCKET, Key=key, Body=data, ContentType=content_type)

    return f"{_PUBLIC_URL_PREFIX}{key}", filename


def delete_image(storage_path: str) -> None:
    """Remove o objeto do S3 a partir da URL pública completa."""
    if not storage_path.startswith(_PUBLIC_URL_PREFIX):
        return  # URL de outro bucket/host — não é nosso pra deletar.
    key = storage_path[len(_PUBLIC_URL_PREFIX):]
    try:
        _s3.delete_object(Bucket=AWS_S3_BUCKET, Key=key)
    except Exception:
        pass
