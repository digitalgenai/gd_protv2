from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload

from config import MAX_IMAGES_PER_PRODUCT, MAX_TOTAL_IMAGES_PER_PRODUCT
from db import get_session
from models import CatalogoProduto, Fornecedor, ProdutoCustomizacao, ProdutoImagem, Proposta, PropostaVersao
from utils.auth import feature_or_roles_required, login_required, roles_required
from utils.s3_storage import delete_image, save_image
from utils.serializers import absolute_image_url, serialize_product
from utils.validation import ImageValidationError, validate_image

bp = Blueprint("produtos", __name__)
CATALOG_MANAGERS = ("Administrador", "Supervisor")
CATALOG_WRITE_FLAG = "vendedores_cadastram_produtos"


def _text(value):
    value = str(value or "").strip()
    return value or None


def _decimal(value, field_name):
    if value in (None, ""):
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f'Campo "{field_name}" inválido.')
    if parsed < 0:
        raise ValueError(f'Campo "{field_name}" não pode ser negativo.')
    return parsed.quantize(Decimal("0.01"))


def _brl_text(value):
    if value is None:
        return None
    formatted = f"{value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"R$ {formatted}"


def _serialize_fornecedor(fornecedor):
    return {
        "id": str(fornecedor.id),
        "nome": fornecedor.nome,
        "logoUrl": None,
        "site": fornecedor.site,
        "contato": fornecedor.contato,
    }


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
@login_required
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
@login_required
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
    materiais = (
        session.query(ProdutoCustomizacao.material)
        .filter(ProdutoCustomizacao.material.isnot(None), ProdutoCustomizacao.ativo.is_(True))
        .distinct()
        .all()
    )
    unidades = (
        session.query(ProdutoCustomizacao.unidade)
        .filter(ProdutoCustomizacao.unidade.isnot(None), ProdutoCustomizacao.ativo.is_(True))
        .distinct()
        .order_by(ProdutoCustomizacao.unidade)
        .all()
    )

    return jsonify({
        "categories": [{"value": c, "count": n} for c, n in category_counts],
        "suppliers": [row[0] for row in fornecedores],
        "finishes": [row[0] for row in acabamentos],
        "materials": sorted({row[0] for row in materiais if row[0]}),
        "units": [row[0] for row in unidades if row[0]],
    })


@bp.get("/fornecedores")
@login_required
def list_fornecedores():
    session = get_session()
    fornecedores = (
        session.query(Fornecedor).filter(Fornecedor.ativo.is_(True)).order_by(Fornecedor.nome).all()
    )
    return jsonify([_serialize_fornecedor(f) for f in fornecedores])


@bp.post("/fornecedores")
@roles_required(*CATALOG_MANAGERS)
def create_fornecedor():
    session = get_session()
    data = request.get_json(silent=True) or {}
    nome = _text(data.get("nome"))
    if not nome:
        return jsonify({"error": "Informe o nome do fornecedor."}), 400
    duplicate = session.query(Fornecedor).filter(func.lower(Fornecedor.nome) == nome.lower()).first()
    if duplicate:
        return jsonify({"error": "Já existe um fornecedor com esse nome."}), 409

    fornecedor = Fornecedor(
        nome=nome,
        site=_text(data.get("site")),
        contato=_text(data.get("contato")),
        ativo=True,
    )
    session.add(fornecedor)
    session.commit()
    session.refresh(fornecedor)
    return jsonify(_serialize_fornecedor(fornecedor)), 201


@bp.patch("/fornecedores/<int:fornecedor_id>")
@roles_required(*CATALOG_MANAGERS)
def update_fornecedor(fornecedor_id):
    session = get_session()
    fornecedor = session.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        return jsonify({"error": "Fornecedor não encontrado."}), 404

    data = request.get_json(silent=True) or {}
    if "nome" in data:
        nome = _text(data.get("nome"))
        if not nome:
            return jsonify({"error": "Informe o nome do fornecedor."}), 400
        duplicate = (
            session.query(Fornecedor)
            .filter(func.lower(Fornecedor.nome) == nome.lower(), Fornecedor.id != fornecedor_id)
            .first()
        )
        if duplicate:
            return jsonify({"error": "Já existe um fornecedor com esse nome."}), 409
        fornecedor.nome = nome
    if "site" in data:
        fornecedor.site = _text(data.get("site"))
    if "contato" in data:
        fornecedor.contato = _text(data.get("contato"))

    session.commit()
    session.refresh(fornecedor)
    return jsonify(_serialize_fornecedor(fornecedor))


@bp.post("/produtos")
@feature_or_roles_required(CATALOG_WRITE_FLAG, *CATALOG_MANAGERS)
def create_produto():
    """Cria o registro principal e sua primeira configuração comercial numa transação."""
    session = get_session()
    data = request.get_json(silent=True) or {}
    nome = _text(data.get("name"))
    categoria = _text(data.get("cat"))
    fornecedor_id = data.get("supplierId")

    if not nome:
        return jsonify({"error": "Informe o nome do produto."}), 400
    if not categoria:
        return jsonify({"error": "Selecione a categoria do produto."}), 400
    try:
        fornecedor_id = int(fornecedor_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Selecione um fornecedor válido."}), 400

    fornecedor = (
        session.query(Fornecedor)
        .filter(Fornecedor.id == fornecedor_id, Fornecedor.ativo.is_(True))
        .first()
    )
    if not fornecedor:
        return jsonify({"error": "Fornecedor não encontrado ou inativo."}), 400

    try:
        preco_venda = _decimal(data.get("salePrice"), "Preço de venda")
        preco_final = _decimal(data.get("finalPrice"), "Preço final")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    produto = CatalogoProduto(
        fornecedor_id=fornecedor.id,
        arquivo_id=None,
        categoria=categoria,
        produto_nome=nome,
        ativo=bool(data.get("active", True)),
    )
    session.add(produto)
    session.flush()

    customizacao = ProdutoCustomizacao(
        produto_id=produto.id,
        acabamento=_text(data.get("finish")),
        material=_text(data.get("material")),
        dimensoes=_text(data.get("dimensions")),
        unidade=_text(data.get("unit")),
        preco_venda=preco_venda,
        preco_venda_txt=_brl_text(preco_venda),
        # Na interface, R$ 0,00 significa "usar o preço de venda"; guardar NULL mantém
        # exatamente essa semântica no serializer e nas consultas legadas.
        preco_final=(preco_final if preco_final and preco_final > 0 else None),
        ativo=True,
    )
    session.add(customizacao)
    session.commit()

    produto = _base_query(session).filter(CatalogoProduto.id == produto.id).first()
    return jsonify(serialize_product(produto)), 201


@bp.patch("/produtos/<codigo>")
@feature_or_roles_required(CATALOG_WRITE_FLAG, *CATALOG_MANAGERS)
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
    if "material" in data:
        customizacao.material = data["material"] or None
    if "dimensions" in data:
        customizacao.dimensoes = data["dimensions"] or None
    if "price" in data:
        customizacao.preco_final = data["price"] or None

    session.commit()
    session.refresh(produto)
    return jsonify(serialize_product(produto))


@bp.post("/produtos/<codigo>/imagens")
@feature_or_roles_required(CATALOG_WRITE_FLAG, *CATALOG_MANAGERS)
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
    if len(existentes) >= MAX_TOTAL_IMAGES_PER_PRODUCT:
        return jsonify({"error": f"Este produto já tem o máximo de {MAX_TOTAL_IMAGES_PER_PRODUCT} imagens."}), 400

    # As 3 primeiras posições ficam reservadas pros slots curados (grade principal);
    # a partir da 4ª, são as imagens extras enviadas pelo botão "Adicionar mais imagens".
    ocupadas = {img.posicao for img in existentes}
    proxima_posicao = next(p for p in range(1, MAX_TOTAL_IMAGES_PER_PRODUCT + 1) if p not in ocupadas)

    storage_path, filename = save_image(codigo, file.filename or "imagem.jpg", data)

    nova = ProdutoImagem(produto_id=produto.id, storage_path=storage_path, filename=filename, posicao=proxima_posicao)
    session.add(nova)
    session.commit()

    return jsonify({"id": nova.id, "url": absolute_image_url(storage_path), "posicao": nova.posicao}), 201


@bp.delete("/produtos/<codigo>/imagens/<int:image_id>")
@feature_or_roles_required(CATALOG_WRITE_FLAG, *CATALOG_MANAGERS)
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
@feature_or_roles_required(CATALOG_WRITE_FLAG, *CATALOG_MANAGERS)
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


# Mesmo mapeamento de STATUS_DB_TO_FRONT em routes/propostas.py — copiado aqui (só 4 entradas)
# em vez de importar de outro blueprint, pra não acoplar os dois módulos por causa disso.
_STATUS_DB_TO_FRONT = {"rascunho": "Rascunho", "enviada": "Enviada", "aprovada": "Aprovada", "recusada": "Reprovada"}


@bp.get("/produtos/<codigo>/analytics")
@login_required
def get_produto_analytics(codigo):
    """Quantas vezes este produto apareceu em propostas reais e em quais — antes computado no
    front a partir de um mock (src/data/mockProposals.ts), que nunca batia com os códigos do
    catálogo real (por isso sempre aparecia vazio). Varre só a versão mais recente de cada
    proposta, pra não contar a mesma negociação duas vezes conforme ela evolui de versão."""
    session = get_session()
    propostas = (
        session.query(Proposta)
        .options(selectinload(Proposta.versoes).selectinload(PropostaVersao.itens))
        .all()
    )

    times_sold = 0
    revenue = 0.0
    proposals = []
    for proposta in propostas:
        if not proposta.versoes:
            continue
        ultima = max(proposta.versoes, key=lambda v: v.versao_numero)
        for item in ultima.itens:
            if item.codigo_produto != codigo:
                continue
            times_sold += item.quantidade
            revenue += float(item.valor_total or 0)
            proposals.append({
                "code": ultima.codigo_proposta or proposta.codigo_base,
                "cliente": proposta.cliente_nome,
                "qty": item.quantidade,
                "status": _STATUS_DB_TO_FRONT.get(ultima.status, "Rascunho"),
            })

    return jsonify({"timesSold": times_sold, "revenue": revenue, "proposals": proposals})
