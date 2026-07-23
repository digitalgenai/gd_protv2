from config import PUBLIC_BASE_URL
from models import CatalogoProduto


def absolute_image_url(storage_path: str) -> str:
    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        return storage_path
    return f"{PUBLIC_BASE_URL}{storage_path}"


def _preco_produto(customizacao) -> float:
    """preco_final é o campo editável pela tela de produto (RF-...), mas a importação em
    massa das tabelas de fornecedor só preencheu preco_venda (11872 de 11963 linhas —
    preco_final tinha só 1). Prioriza um preco_final editado manualmente; cai pro preco_venda
    importado quando não há edição, em vez de mostrar "sem preço" pra quase tudo."""
    if not customizacao:
        return 0
    valor = customizacao.preco_final if customizacao.preco_final is not None else customizacao.preco_venda
    return float(valor) if valor is not None else 0


def _selecionar_customizacao(produto: CatalogoProduto):
    """Quando um produto tem mais de uma variante ativa (cores/acabamentos diferentes),
    prioriza uma que tenha preço cadastrado — sem isso, pegar sempre a primeira variante
    fazia mostrar "sem preço" em produtos que na verdade têm preço em outra variante."""
    ativas = [c for c in produto.customizacoes if c.ativo]
    com_preco = next((c for c in ativas if c.preco_final is not None or c.preco_venda is not None), None)
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
        "databaseId": str(produto.id),
        "fileId": str(produto.arquivo_id) if produto.arquivo_id is not None else None,
        "name": produto.produto_nome or "",
        "cat": produto.categoria or "",
        "supplier": produto.fornecedor.nome if produto.fornecedor else "",
        "supplierId": str(produto.fornecedor_id) if produto.fornecedor_id is not None else "",
        "finish": customizacao.acabamento if customizacao and customizacao.acabamento else "",
        "material": customizacao.material if customizacao and customizacao.material else "",
        "price": _preco_produto(customizacao),
        "salePrice": float(customizacao.preco_venda) if customizacao and customizacao.preco_venda is not None else 0,
        "salePriceText": customizacao.preco_venda_txt if customizacao else None,
        "finalPrice": float(customizacao.preco_final) if customizacao and customizacao.preco_final is not None else 0,
        "unit": customizacao.unidade if customizacao and customizacao.unidade else "",
        "customizationId": str(customizacao.id) if customizacao else None,
        "customizationActive": bool(customizacao.ativo) if customizacao else False,
        "customizationCreatedAt": customizacao.criado_em.isoformat() if customizacao and customizacao.criado_em else None,
        "customizationUpdatedAt": customizacao.atualizado_em.isoformat() if customizacao and customizacao.atualizado_em else None,
        "dimensions": customizacao.dimensoes if customizacao and customizacao.dimensoes else "",
        "active": bool(produto.ativo),
        "source": "Importação" if produto.arquivo_id is not None else "Cadastro manual",
        "createdAt": produto.criado_em.isoformat() if produto.criado_em else None,
        "updatedAt": produto.atualizado_em.isoformat() if produto.atualizado_em else None,
        "img": absolute_image_url(imagens[0].storage_path) if imagens else "",
        "images": [
            {"id": img.id, "url": absolute_image_url(img.storage_path), "posicao": img.posicao}
            for img in imagens
        ],
    }
