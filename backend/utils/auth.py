"""Autenticação/autorização por sessão (ver routes/auth.py pro login em si). Qualquer rota
que devolve dado real do sistema precisa de @login_required — sem isso, a rota fica acessível
sem login nenhum via chamada direta à API (o RequireAuth do React só esconde a tela)."""
from functools import wraps

from flask import jsonify
from flask import session as flask_session

from db import get_session
from models import Usuario


def get_current_usuario(db_session):
    """Usuário da sessão atual, ou None (sessão ausente/expirada/usuário desativado depois do login)."""
    user_id = flask_session.get("user_id")
    if not user_id:
        return None
    usuario = db_session.query(Usuario).filter(Usuario.id == user_id, Usuario.is_active.is_(True)).first()
    if not usuario:
        flask_session.clear()
        return None
    return usuario


def login_required(fn):
    """Exige uma sessão válida (qualquer perfil) — 401 sem ela."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if get_current_usuario(get_session()) is None:
            return jsonify({"error": "Não autenticado."}), 401
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    """Exige sessão válida com perfil Administrador — 401 sem sessão, 403 com sessão mas perfil errado."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        usuario = get_current_usuario(get_session())
        if usuario is None:
            return jsonify({"error": "Não autenticado."}), 401
        if usuario.perfil != "Administrador":
            return jsonify({"error": "Acesso restrito a administradores."}), 403
        return fn(*args, **kwargs)
    return wrapper
