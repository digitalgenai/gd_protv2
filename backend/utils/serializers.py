from config import PUBLIC_BASE_URL
from models import CatalogoProduto


def absolute_image_url(storage_path: str) -> str:
    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        return storage_path
    return f"{PUBLIC_BASE_URL}{storage_path}"


def serialize_product(produto: CatalogoProduto) -> dict:
    """
    Mapeia CatalogoProduto (+ join implícito com fornecedor/customização ativa/imagens)
    para o shape `Product` que o front-end já espera (src/types/index.ts). Campos que
    não existem ainda no banco real (categoria, preço, acabamento, dimensões — ver
    Contexto do plano) voltam como string vazia / 0, nunca inventados.
    """
    customizacao = next((c for c in produto.customizacoes if c.ativo), None)
    imagens = sorted(produto.imagens, key=lambda i: i.posicao)

    return {
        "id": produto.codigo or f"GD-{produto.id}",
        "name": produto.produto_nome or "",
        "cat": produto.categoria or "",
        "supplier": produto.fornecedor.nome if produto.fornecedor else "",
        "finish": customizacao.acabamento if customizacao and customizacao.acabamento else "",
        "price": float(customizacao.preco_b2c) if customizacao and customizacao.preco_b2c is not None else 0,
        "dimensions": customizacao.dimensoes if customizacao and customizacao.dimensoes else "",
        "img": absolute_image_url(imagens[0].storage_path) if imagens else "",
        "images": [
            {"id": img.id, "url": absolute_image_url(img.storage_path), "posicao": img.posicao}
            for img in imagens
        ],
    }
