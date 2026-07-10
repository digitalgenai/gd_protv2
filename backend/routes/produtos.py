from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload

from config import MAX_IMAGES_PER_PRODUCT
from db import get_session
from models import CatalogoProduto, Fornecedor, ProdutoCustomizacao, ProdutoImagem
from utils.s3_storage import delete_image, save_image
from utils.serializers import absolute_image_url, serialize_product
from utils.validation import ImageValidationError, validate_image

bp = Blueprint("produtos", __name__)


def _base_query(session):
    return (
        session.query(CatalogoProduto)
        .options(
            selectinload(CatalogoProduto.fornecedor),
            selectinload(CatalogoProduto.customizacoes),
            selectinload(CatalogoProduto.imagens),
        )
        .filter(CatalogoProduto.ativo.is_(True))
    )


@bp.get("/produtos")
def list_produtos():
    session = get_session()
    query = _base_query(session)

    q = request.args.get("q", "").strip()
    if q:
        query = query.filter(
            or_(CatalogoProduto.produto_nome.ilike(f"%{q}%"), CatalogoProduto.codigo.ilike(f"%{q}%")),
        )

    categorias = request.args.getlist("categoria")
    if categorias:
        query = query.filter(CatalogoProduto.categoria.in_(categorias))

    fornecedores = request.args.getlist("fornecedor")
    if fornecedores:
        query = query.join(Fornecedor).filter(Fornecedor.nome.in_(fornecedores))

    acabamentos = request.args.getlist("acabamento")
    if acabamentos:
        query = query.join(ProdutoCustomizacao).filter(
            ProdutoCustomizacao.ativo.is_(True),
            ProdutoCustomizacao.acabamento.in_(acabamentos),
        )

    if categorias or fornecedores or acabamentos:
        query = query.distinct()

    produtos = query.all()
    serialized = [serialize_product(p) for p in produtos]

    # Faixa de preço e ordenação dependem do preço da customização ativa — aplicadas em
    # Python (dataset pequeno, ~100 produtos) em vez de subquery no SQL.
    faixa = request.args.get("faixa_preco")
    if faixa == "0-3000":
        serialized = [p for p in serialized if p["price"] < 3000]
    elif faixa == "3000-8000":
        serialized = [p for p in serialized if 3000 <= p["price"] < 8000]
    elif faixa == "8000+":
        serialized = [p for p in serialized if p["price"] >= 8000]

    ordenar = request.args.get("ordenar", "relevance")
    if ordenar == "price-asc":
        serialized.sort(key=lambda p: p["price"])
    elif ordenar == "price-desc":
        serialized.sort(key=lambda p: p["price"], reverse=True)
    elif ordenar == "name-asc":
        serialized.sort(key=lambda p: p["name"])

    return jsonify(serialized)


@bp.get("/produtos/filtros")
def get_filtros():
    session = get_session()

    category_counts = (
        session.query(CatalogoProduto.categoria, func.count(CatalogoProduto.id))
        .filter(CatalogoProduto.categoria.isnot(None), CatalogoProduto.ativo.is_(True))
        .group_by(CatalogoProduto.categoria)
        .all()
    )
    fornecedores = (
        session.query(Fornecedor.nome).filter(Fornecedor.ativo.is_(True)).order_by(Fornecedor.nome).all()
    )
    acabamentos = (
        session.query(ProdutoCustomizacao.acabamento)
        .filter(ProdutoCustomizacao.acabamento.isnot(None), ProdutoCustomizacao.ativo.is_(True))
        .distinct()
        .all()
    )

    return jsonify({
        "categories": [{"value": c, "count": n} for c, n in category_counts],
        "suppliers": [row[0] for row in fornecedores],
        "finishes": [row[0] for row in acabamentos],
    })


@bp.patch("/produtos/<codigo>")
def update_produto(codigo):
    session = get_session()
    produto = (
        session.query(CatalogoProduto)
        .options(
            selectinload(CatalogoProduto.fornecedor),
            selectinload(CatalogoProduto.customizacoes),
            selectinload(CatalogoProduto.imagens),
        )
        .filter(CatalogoProduto.codigo == codigo)
        .first()
    )
    if not produto:
        return jsonify({"error": f'Produto "{codigo}" não encontrado.'}), 404

    data = request.get_json(silent=True) or {}

    if "name" in data:
        produto.produto_nome = data["name"]
    if "cat" in data:
        produto.categoria = data["cat"] or None
    if data.get("supplier"):
        fornecedor = session.query(Fornecedor).filter(Fornecedor.nome == data["supplier"]).first()
        if fornecedor:
            produto.fornecedor_id = fornecedor.id

    customizacao = next((c for c in produto.customizacoes if c.ativo), None)
    if customizacao is None:
        customizacao = ProdutoCustomizacao(produto_id=produto.id, ativo=True)
        session.add(customizacao)

    if "finish" in data:
        customizacao.acabamento = data["finish"] or None
    if "dimensions" in data:
        customizacao.dimensoes = data["dimensions"] or None
    if "price" in data:
        customizacao.preco_b2c = data["price"] or None

    session.commit()
    session.refresh(produto)
    return jsonify(serialize_product(produto))


@bp.post("/produtos/<codigo>/imagens")
def upload_imagem(codigo):
    session = get_session()
    produto = (
        session.query(CatalogoProduto)
        .options(selectinload(CatalogoProduto.imagens))
        .filter(CatalogoProduto.codigo == codigo)
        .first()
    )
    if not produto:
        return jsonify({"error": f'Produto "{codigo}" não encontrado.'}), 404

    file = request.files.get("imagem")
    if not file:
        return jsonify({"error": "Nenhum arquivo enviado."}), 400

    data = file.read()
    try:
        validate_image(data, file.mimetype)
    except ImageValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    existentes = sorted(produto.imagens, key=lambda i: i.posicao)
    if len(existentes) >= MAX_IMAGES_PER_PRODUCT:
        return jsonify({"error": f"Este produto já tem o máximo de {MAX_IMAGES_PER_PRODUCT} imagens."}), 400

    ocupadas = {img.posicao for img in existentes}
    proxima_posicao = next(p for p in range(1, MAX_IMAGES_PER_PRODUCT + 1) if p not in ocupadas)

    storage_path, filename = save_image(codigo, file.filename or "imagem.jpg", data)

    nova = ProdutoImagem(produto_id=produto.id, storage_path=storage_path, filename=filename, posicao=proxima_posicao)
    session.add(nova)
    session.commit()

    return jsonify({"id": nova.id, "url": absolute_image_url(storage_path), "posicao": nova.posicao}), 201


@bp.delete("/produtos/<codigo>/imagens/<int:image_id>")
def delete_imagem(codigo, image_id):
    session = get_session()
    produto = session.query(CatalogoProduto).filter(CatalogoProduto.codigo == codigo).first()
    if not produto:
        return jsonify({"error": f'Produto "{codigo}" não encontrado.'}), 404

    imagem = (
        session.query(ProdutoImagem)
        .filter(ProdutoImagem.id == image_id, ProdutoImagem.produto_id == produto.id)
        .first()
    )
    if not imagem:
        return jsonify({"error": "Imagem não encontrada."}), 404

    delete_image(imagem.storage_path)
    session.delete(imagem)
    session.commit()

    # RF-027: reordena posições restantes (1,2,3 sem lacunas). Um flush por linha, na
    # ordem ascendente da posição atual, evita colidir com a UNIQUE(produto_id, posicao)
    # (não é DEFERRABLE — a checagem acontece a cada UPDATE, não só no commit).
    restantes = (
        session.query(ProdutoImagem)
        .filter(ProdutoImagem.produto_id == produto.id)
        .order_by(ProdutoImagem.posicao)
        .all()
    )
    for idx, img in enumerate(restantes, start=1):
        if img.posicao != idx:
            img.posicao = idx
            session.flush()
    session.commit()

    return "", 204


@bp.patch("/produtos/<codigo>/imagens/<int:image_id>/posicao")
def reordenar_imagem(codigo, image_id):
    session = get_session()
    produto = (
        session.query(CatalogoProduto)
        .options(selectinload(CatalogoProduto.imagens))
        .filter(CatalogoProduto.codigo == codigo)
        .first()
    )
    if not produto:
        return jsonify({"error": f'Produto "{codigo}" não encontrado.'}), 404

    data = request.get_json(silent=True) or {}
    nova_posicao = data.get("posicao")
    if not isinstance(nova_posicao, int) or not (1 <= nova_posicao <= MAX_IMAGES_PER_PRODUCT):
        return jsonify({"error": f"Informe uma posição entre 1 e {MAX_IMAGES_PER_PRODUCT}."}), 400

    imagem = next((img for img in produto.imagens if img.id == image_id), None)
    if not imagem:
        return jsonify({"error": "Imagem não encontrada."}), 404

    posicao_antiga = imagem.posicao
    if posicao_antiga != nova_posicao:
        ocupante = next((img for img in produto.imagens if img.posicao == nova_posicao and img.id != imagem.id), None)
        if ocupante is None:
            imagem.posicao = nova_posicao
            session.commit()
        else:
            # UNIQUE(produto_id, posicao) não é DEFERRABLE e as 3 posições (1..3) já estão todas
            # ocupadas: não existe valor temporário válido para uma troca em duas etapas. Contorna
            # recriando a linha do ocupante (mesmo storage_path/filename, id novo) na posição antiga
            # da imagem movida — o arquivo em si no S3 não é tocado, só o registro no banco.
            storage_path, filename = ocupante.storage_path, ocupante.filename
            session.delete(ocupante)
            session.flush()
            imagem.posicao = nova_posicao
            session.flush()
            session.add(ProdutoImagem(produto_id=produto.id, storage_path=storage_path, filename=filename, posicao=posicao_antiga))
            session.commit()

    imagens = (
        session.query(ProdutoImagem)
        .filter(ProdutoImagem.produto_id == produto.id)
        .order_by(ProdutoImagem.posicao)
        .all()
    )
    return jsonify([{"id": img.id, "url": absolute_image_url(img.storage_path), "posicao": img.posicao} for img in imagens])
