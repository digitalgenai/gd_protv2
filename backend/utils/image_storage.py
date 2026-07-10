import os
import re
import uuid

from config import UPLOADS_DIR

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_code(codigo: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", codigo).strip("_") or "sem_codigo"


def _safe_filename(base: str, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("_") or "imagem"
    return f"{base}-{uuid.uuid4().hex[:8]}{ext}"


def save_image(codigo: str, original_filename: str, data: bytes) -> tuple[str, str]:
    """
    Salva os bytes em backend/uploads/<codigo>/<arquivo>.
    Retorna (storage_path, filename) — storage_path é o caminho público servido
    por GET /images/<codigo>/<arquivo>. Isolado aqui de propósito: trocar para S3
    depois (ver MAPEAMENTO_S3.md) é só substituir este arquivo por utils/s3_storage.py
    com a mesma assinatura, sem tocar nas rotas.
    """
    safe_code = _safe_code(codigo)
    base, ext = os.path.splitext(original_filename or "imagem")
    ext = (ext or ".jpg").lower()
    filename = _safe_filename(base, ext)

    folder = UPLOADS_DIR / safe_code
    folder.mkdir(parents=True, exist_ok=True)
    (folder / filename).write_bytes(data)

    return f"/images/{safe_code}/{filename}", filename


def delete_image(storage_path: str) -> None:
    """Remove o arquivo referenciado por um storage_path no formato /images/<codigo>/<arquivo>."""
    match = re.match(r"^/images/([^/]+)/([^/]+)$", storage_path or "")
    if not match:
        return
    safe_code, filename = match.groups()
    path = UPLOADS_DIR / safe_code / filename
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
