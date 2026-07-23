from flask import Blueprint, jsonify, request
from sqlalchemy import text

from db import get_session
from models import Usuario
from utils.auth import admin_required, get_current_usuario

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
def update_usuario(usuario_id):
    session = get_session()
    data = request.get_json(silent=True) or {}
    if "isActive" not in data and "perfil" not in data:
        return jsonify({"error": "Informe 'isActive' ou 'perfil' para atualizar o usuário."}), 400

    usuario = session.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        return jsonify({"error": "Usuário não encontrado."}), 404

    usuario_logado = get_current_usuario(session)
    novo_perfil = data.get("perfil")
    novo_status = bool(data["isActive"]) if "isActive" in data else usuario.is_active

    if novo_perfil is not None and novo_perfil not in PERFIS_VALIDOS:
        return jsonify({"error": f"Perfil deve ser um de: {', '.join(PERFIS_VALIDOS)}."}), 400

    # Evita o administrador remover o próprio acesso e ficar sem conseguir corrigir a ação.
    if usuario_logado and usuario.id == usuario_logado.id:
        if novo_perfil is not None and novo_perfil != "Administrador":
            return jsonify({"error": "Você não pode alterar o seu próprio nível de acesso."}), 400
        if not novo_status:
            return jsonify({"error": "Você não pode desativar o seu próprio usuário."}), 400

    # Também impede que o sistema fique sem nenhum administrador ativo.
    removendo_admin = usuario.perfil == "Administrador" and (
        (novo_perfil is not None and novo_perfil != "Administrador") or not novo_status
    )
    if removendo_admin:
        admins_ativos = (
            session.query(Usuario)
            .filter(Usuario.perfil == "Administrador", Usuario.is_active.is_(True))
            .count()
        )
        if admins_ativos <= 1:
            return jsonify({"error": "O sistema precisa manter pelo menos um administrador ativo."}), 400

    if novo_perfil is not None:
        usuario.perfil = novo_perfil
    if "isActive" in data:
        usuario.is_active = novo_status

    session.commit()
    return jsonify(_serialize(usuario))


@bp.patch("/usuarios/<uuid:usuario_id>/senha")
@admin_required
def reset_senha_usuario(usuario_id):
    """Reset de senha pelo administrador — diferente de POST /auth/change-password (o usuário
    trocando a própria senha, que exige a senha atual): aqui é um admin definindo uma senha
    nova pra outra pessoa, sem precisar saber a antiga."""
    session = get_session()
    data = request.get_json(silent=True) or {}
    nova_senha = data.get("novaSenha") or ""
    if len(nova_senha) < 4:
        return jsonify({"error": "A nova senha deve ter pelo menos 4 caracteres."}), 400

    usuario = session.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        return jsonify({"error": "Usuário não encontrado."}), 404

    session.execute(
        text("UPDATE usuarios SET senha_hash = crypt(:senha, gen_salt('bf')) WHERE id = :id"),
        {"senha": nova_senha, "id": usuario_id},
    )
    session.commit()
    return jsonify({"ok": True})
