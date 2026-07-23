from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from db import get_session
from models import Acabamento, Fornecedor, Material
from utils.auth import feature_or_roles_required, login_required, roles_required

bp = Blueprint("materiais", __name__)
CATALOG_MANAGERS = ("Administrador", "Supervisor")
CATALOG_WRITE_FLAG = "vendedores_cadastram_produtos"


def _text(value):
    value = str(value or "").strip()
    return value or None


def _serialize_item(item):
    return {
        "id": str(item.id),
        "fornecedorId": str(item.fornecedor_id),
        "nome": item.nome,
        "categoria": item.categoria,
        "classificacao": item.classificacao,
        "ativo": item.ativo,
    }


def _list_by_fornecedor(model):
    session = get_session()
    try:
        fornecedor_id = int(request.args.get("fornecedor_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "Informe um fornecedor_id válido."}), 400
    items = (
        session.query(model)
        .filter(model.fornecedor_id == fornecedor_id, model.ativo.is_(True))
        .order_by(model.categoria, model.nome)
        .all()
    )
    return jsonify([_serialize_item(i) for i in items])


def _list_gestao(model):
    session = get_session()
    query = session.query(model).options(selectinload(model.fornecedor))

    fornecedor_id = request.args.get("fornecedor_id")
    if fornecedor_id:
        try:
            query = query.filter(model.fornecedor_id == int(fornecedor_id))
        except ValueError:
            return jsonify({"error": "fornecedor_id inválido."}), 400

    q = request.args.get("q", "").strip()
    if q:
        query = query.filter(model.nome.ilike(f"%{q}%"))

    items = query.order_by(model.fornecedor_id, model.categoria, model.nome).all()
    return jsonify([_serialize_item(i) for i in items])


def _create_item(model, resource_label):
    session = get_session()
    data = request.get_json(silent=True) or {}
    nome = _text(data.get("nome"))
    categoria = _text(data.get("categoria"))
    classificacao = _text(data.get("classificacao"))

    if not nome:
        return jsonify({"error": f"Informe o nome do {resource_label}."}), 400
    if not categoria:
        return jsonify({"error": "Informe a categoria."}), 400
    try:
        fornecedor_id = int(data.get("fornecedorId"))
    except (TypeError, ValueError):
        return jsonify({"error": "Selecione um fornecedor válido."}), 400

    fornecedor = (
        session.query(Fornecedor)
        .filter(Fornecedor.id == fornecedor_id, Fornecedor.ativo.is_(True))
        .first()
    )
    if not fornecedor:
        return jsonify({"error": "Fornecedor não encontrado ou inativo."}), 400

    duplicate = (
        session.query(model)
        .filter(
            model.fornecedor_id == fornecedor_id,
            func.lower(model.nome) == nome.lower(),
            func.lower(model.categoria) == categoria.lower(),
        )
        .first()
    )
    if duplicate:
        if duplicate.ativo:
            return jsonify({
                "error": f"Já existe um {resource_label} com esse nome e categoria para este fornecedor.",
            }), 409
        # UNIQUE(nome, categoria, fornecedor_id) não é parcial (não ignora ativo=false) — um
        # INSERT aqui bateria IntegrityError mesmo a linha existente estando "desativada".
        # Reativa a linha existente em vez de tentar criar uma segunda.
        duplicate.ativo = True
        duplicate.classificacao = classificacao
        session.commit()
        session.refresh(duplicate)
        return jsonify(_serialize_item(duplicate)), 200

    item = model(fornecedor_id=fornecedor_id, nome=nome, categoria=categoria, classificacao=classificacao, ativo=True)
    session.add(item)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return jsonify({
            "error": f"Já existe um {resource_label} com esse nome e categoria para este fornecedor.",
        }), 409
    session.refresh(item)
    return jsonify(_serialize_item(item)), 201


def _update_item(model, item_id, resource_label):
    session = get_session()
    item = session.query(model).filter(model.id == item_id).first()
    if not item:
        return jsonify({"error": f"{resource_label.capitalize()} não encontrado."}), 404

    data = request.get_json(silent=True) or {}
    novo_nome = _text(data["nome"]) if "nome" in data else item.nome
    nova_categoria = _text(data["categoria"]) if "categoria" in data else item.categoria
    if "nome" in data and not novo_nome:
        return jsonify({"error": f"Informe o nome do {resource_label}."}), 400
    if "categoria" in data and not nova_categoria:
        return jsonify({"error": "Informe a categoria."}), 400

    if "nome" in data or "categoria" in data:
        duplicate = (
            session.query(model)
            .filter(
                model.fornecedor_id == item.fornecedor_id,
                func.lower(model.nome) == novo_nome.lower(),
                func.lower(model.categoria) == nova_categoria.lower(),
                model.id != item_id,
            )
            .first()
        )
        if duplicate:
            return jsonify({
                "error": f"Já existe um {resource_label} com esse nome e categoria para este fornecedor.",
            }), 409
        item.nome, item.categoria = novo_nome, nova_categoria

    if "classificacao" in data:
        item.classificacao = _text(data.get("classificacao"))
    if "ativo" in data:
        item.ativo = bool(data["ativo"])

    session.commit()
    session.refresh(item)
    return jsonify(_serialize_item(item))


@bp.get("/materiais")
@login_required
def list_materiais():
    return _list_by_fornecedor(Material)


@bp.get("/materiais/gestao")
@roles_required(*CATALOG_MANAGERS)
def list_materiais_gestao():
    return _list_gestao(Material)


@bp.post("/materiais")
@feature_or_roles_required(CATALOG_WRITE_FLAG, *CATALOG_MANAGERS)
def create_material():
    return _create_item(Material, "material")


@bp.patch("/materiais/<int:material_id>")
@roles_required(*CATALOG_MANAGERS)
def update_material(material_id):
    return _update_item(Material, material_id, "material")


@bp.get("/acabamentos")
@login_required
def list_acabamentos():
    return _list_by_fornecedor(Acabamento)


@bp.get("/acabamentos/gestao")
@roles_required(*CATALOG_MANAGERS)
def list_acabamentos_gestao():
    return _list_gestao(Acabamento)


@bp.post("/acabamentos")
@feature_or_roles_required(CATALOG_WRITE_FLAG, *CATALOG_MANAGERS)
def create_acabamento():
    return _create_item(Acabamento, "acabamento")


@bp.patch("/acabamentos/<int:acabamento_id>")
@roles_required(*CATALOG_MANAGERS)
def update_acabamento(acabamento_id):
    return _update_item(Acabamento, acabamento_id, "acabamento")
