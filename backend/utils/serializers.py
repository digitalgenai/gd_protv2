from config import PUBLIC_BASE_URL
from models import CatalogoProduto


def absolute_image_url(storage_path: str) -> str:
    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        return storage_path
    return f"{PUBLIC_BASE_URL}{storage_path}"


def _preco_produto(customizacao) -> float:
    """preco_b2c é o campo editável pela tela de produto (RF-...), mas a importação em
    massa das tabelas de fornecedor só preencheu preco_b2b (11872 de 11963 linhas —
    preco_b2c tinha só 1). Prioriza um preco_b2c editado manualmente; cai pro b2b
    importado quando não há edição, em vez de mostrar "sem preço" pra quase tudo."""
    if not customizacao:
        return 0
    valor = customizacao.preco_b2c if customizacao.preco_b2c is not None else customizacao.preco_b2b
    return float(valor) if valor is not None else 0


def _selecionar_customizacao(produto: CatalogoProduto):
    """Quando um produto tem mais de uma variante ativa (cores/acabamentos diferentes),
    prioriza uma que tenha preço cadastrado — sem isso, pegar sempre a primeira variante
    fazia mostrar "sem preço" em produtos que na verdade têm preço em outra variante."""
    ativas = [c for c in produto.customizacoes if c.ativo]
    com_preco = next((c for c in ativas if c.preco_b2c is not None or c.preco_b2b is not None), None)
    return com_preco or (ativas[0] if ativas else None)


def serialize_product(produto: CatalogoProduto) -> dict:
    """
    Mapeia CatalogoProduto (+ join implícito com fornecedor/customização ativa/imagens)
    para o shape `Product` que o front-end já espera (src/types/index.ts). Campos que
    não existem ainda no banco real (categoria, acabamento, dimensões — ver
    Contexto do plano) voltam como string vazia / 0, nunca inventados.
    """
    customizacao = _selecionar_customizacao(produto)
    imagens = sorted(produto.imagens, key=lambda i: i.posicao)

    return {
        "id": produto.codigo or f"GD-{produto.id}",
        "name": produto.produto_nome or "",
        "cat": produto.categoria or "",
        "supplier": produto.fornecedor.nome if produto.fornecedor else "",
        "finish": customizacao.acabamento if customizacao and customizacao.acabamento else "",
        "price": _preco_produto(customizacao),
        "dimensions": customizacao.dimensoes if customizacao and customizacao.dimensoes else "",
        "img": absolute_image_url(imagens[0].storage_path) if imagens else "",
        "images": [
            {"id": img.id, "url": absolute_image_url(img.storage_path), "posicao": img.posicao}
            for img in imagens
        ],
    }
