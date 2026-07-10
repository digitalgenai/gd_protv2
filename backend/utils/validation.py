import io

from PIL import Image, UnidentifiedImageError

from config import (
    ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, MIN_IMAGE_DIMENSION, MIN_IMAGE_SIZE_BYTES,
)


class ImageValidationError(Exception):
    """Erro de validação de imagem — a mensagem é segura para devolver ao cliente (400)."""


def validate_image(data: bytes, mime_type: str | None) -> None:
    """RF-020 a RF-023: formato, tamanho de arquivo e resolução mínima."""
    if mime_type not in ALLOWED_IMAGE_TYPES:
        raise ImageValidationError("Formato inválido — envie JPEG, PNG ou WEBP.")

    size = len(data)
    if size < MIN_IMAGE_SIZE_BYTES:
        raise ImageValidationError(f"Arquivo muito pequeno ({size} bytes) — mínimo de {MIN_IMAGE_SIZE_BYTES // 1024} KB.")
    if size > MAX_IMAGE_SIZE_BYTES:
        raise ImageValidationError(f"Arquivo muito grande — máximo de {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB.")

    try:
        with Image.open(io.BytesIO(data)) as img:
            width, height = img.size
    except UnidentifiedImageError:
        raise ImageValidationError("Não foi possível ler essa imagem — arquivo corrompido ou inválido.")

    if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
        raise ImageValidationError(
            f"Resolução {width}×{height}px é menor que o mínimo de {MIN_IMAGE_DIMENSION}×{MIN_IMAGE_DIMENSION}px.",
        )

    # RF-023 (qualidade visual / fora de foco) fica fora desta fase — exige um detector
    # de nitidez (ex.: variância do Laplaciano) que não foi pedido ainda.
