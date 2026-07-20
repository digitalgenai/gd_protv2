from flask import Blueprint, jsonify, request
from sqlalchemy import text

from db import get_session
from models import Usuario
from utils.auth import admin_required

bp = Blueprint("usuarios", __name__)

PERFIS_VALIDOS = ("Administrador", "Supervisor", "Vendedor")


def _serialize(u: Usuario) -> dict:
    return {
        "id": str(u.id),
        "nome": u.nome,
        "codigoVendedor": u.codigo_vendedor,
        "email": u.email,
        "perfil": u.perfil,
        "setor": u.setor,
        "isActive": u.is_active,
    }


@bp.get("/usuarios")
@admin_required
def list_usuarios():
    session = get_session()
    usuarios = session.query(Usuario).order_by(Usuario.nome).all()
    return jsonify([_serialize(u) for u in usuarios])


@bp.post("/usuarios")
@admin_required
def create_usuario():
    """RF-044 — cadastro real de usuário. Senha vira hash via pgcrypto (crypt +
    gen_salt('bf')), igual ao padrão usado em seed_usuarios.py; nunca fica em texto puro."""
    session = get_session()
    data = request.get_json(silent=True) or {}

    nome = (data.get("nome") or "").strip()
    email = (data.get("email") or "").strip().lower()
    senha = data.get("senha") or ""
    perfil = data.get("perfil") or "Vendedor"
    setor = (data.get("setor") or "").strip() or "Vendas"

    if not nome:
        return jsonify({"error": "Nome é obrigatório."}), 400
    if not email:
        return jsonify({"error": "E-mail é obrigatório."}), 400
    if len(senha) < 4:
        return jsonify({"error": "Senha deve ter pelo menos 4 caracteres."}), 400
    if perfil not in PERFIS_VALIDOS:
        return jsonify({"error": f"Perfil deve ser um de: {', '.join(PERFIS_VALIDOS)}."}), 400

    existente = session.query(Usuario).filter(Usuario.email == email).first()
    if existente:
        return jsonify({"error": "Já existe um usuário com esse e-mail."}), 409

    resultado = session.execute(
        text("""
            INSERT INTO usuarios (nome, email, senha_hash, perfil, setor)
            VALUES (:nome, :email, crypt(:senha, gen_salt('bf')), :perfil, :setor)
            RETURNING id
        """),
        {"nome": nome, "email": email, "senha": senha, "perfil": perfil, "setor": setor},
    )
    novo_id = resultado.scalar()
    session.commit()

    criado = session.query(Usuario).filter(Usuario.id == novo_id).first()
    return jsonify(_serialize(criado)), 201


@bp.patch("/usuarios/<uuid:usuario_id>")
@admin_required
def update_usuario_status(usuario_id):
    session = get_session()
    data = request.get_json(silent=True) or {}
    if "isActive" not in data:
        return jsonify({"error": "Campo 'isActive' é obrigatório."}), 400

    usuario = session.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        return jsonify({"error": "Usuário não encontrado."}), 404

    usuario.is_active = bool(data["isActive"])
    session.commit()
    return jsonify(_serialize(usuario))
