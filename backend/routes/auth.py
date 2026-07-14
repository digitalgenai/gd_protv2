from flask import Blueprint, jsonify, request
from flask import session as flask_session
from sqlalchemy import text

from db import get_session
from models import Usuario
from routes.usuarios import _serialize

bp = Blueprint("auth", __name__)


def _current_usuario(db_session):
    """Usuário da sessão atual, ou None (sessão ausente/expirada/usuário desativado depois do login)."""
    user_id = flask_session.get("user_id")
    if not user_id:
        return None
    usuario = db_session.query(Usuario).filter(Usuario.id == user_id, Usuario.is_active.is_(True)).first()
    if not usuario:
        flask_session.clear()
        return None
    return usuario


@bp.post("/auth/login")
def login():
    """Verifica a senha via pgcrypto (crypt com o salt já embutido no hash salvo) — a senha em
    texto puro nunca é armazenada nem comparada diretamente, só via essa função do Postgres."""
    db_session = get_session()
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    senha = data.get("senha") or ""

    if not email or not senha:
        return jsonify({"error": "Informe e-mail e senha."}), 400

    usuario = db_session.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        return jsonify({"error": "E-mail ou senha inválidos."}), 401
    if not usuario.is_active:
        return jsonify({"error": "Este usuário está inativo. Fale com um administrador."}), 403

    senha_ok = db_session.execute(
        text("SELECT senha_hash = crypt(:senha, senha_hash) FROM usuarios WHERE id = :id"),
        {"senha": senha, "id": usuario.id},
    ).scalar()
    if not senha_ok:
        return jsonify({"error": "E-mail ou senha inválidos."}), 401

    flask_session.clear()
    flask_session["user_id"] = str(usuario.id)
    return jsonify(_serialize(usuario))


@bp.get("/auth/me")
def me():
    db_session = get_session()
    usuario = _current_usuario(db_session)
    if not usuario:
        return jsonify({"error": "Não autenticado."}), 401
    return jsonify(_serialize(usuario))


@bp.post("/auth/logout")
def logout():
    flask_session.clear()
    return jsonify({"ok": True})


@bp.patch("/auth/me")
def update_me():
    db_session = get_session()
    usuario = _current_usuario(db_session)
    if not usuario:
        return jsonify({"error": "Não autenticado."}), 401

    data = request.get_json(silent=True) or {}
    nome = (data.get("nome") or "").strip()
    email = (data.get("email") or "").strip().lower()
    setor = (data.get("setor") or "").strip()

    if not nome:
        return jsonify({"error": "Nome é obrigatório."}), 400
    if not email:
        return jsonify({"error": "E-mail é obrigatório."}), 400

    if email != usuario.email:
        existente = db_session.query(Usuario).filter(Usuario.email == email).first()
        if existente:
            return jsonify({"error": "Já existe um usuário com esse e-mail."}), 409

    usuario.nome = nome
    usuario.email = email
    if setor:
        usuario.setor = setor
    db_session.commit()
    return jsonify(_serialize(usuario))


@bp.post("/auth/change-password")
def change_password():
    db_session = get_session()
    usuario = _current_usuario(db_session)
    if not usuario:
        return jsonify({"error": "Não autenticado."}), 401

    data = request.get_json(silent=True) or {}
    senha_atual = data.get("senhaAtual") or ""
    nova_senha = data.get("novaSenha") or ""

    if len(nova_senha) < 4:
        return jsonify({"error": "A nova senha deve ter pelo menos 4 caracteres."}), 400

    senha_ok = db_session.execute(
        text("SELECT senha_hash = crypt(:senha, senha_hash) FROM usuarios WHERE id = :id"),
        {"senha": senha_atual, "id": usuario.id},
    ).scalar()
    if not senha_ok:
        return jsonify({"error": "Senha atual incorreta."}), 400

    db_session.execute(
        text("UPDATE usuarios SET senha_hash = crypt(:senha, gen_salt('bf')) WHERE id = :id"),
        {"senha": nova_senha, "id": usuario.id},
    )
    db_session.commit()
    return jsonify({"ok": True})
