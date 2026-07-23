from flask import Blueprint, jsonify, request

from db import get_session
from models import ConfiguracaoSistema
from utils.auth import admin_required, login_required

bp = Blueprint("configuracoes", __name__)

VENDEDORES_CATALOGO_KEY = "vendedores_cadastram_produtos"


def _get_flag(session):
    config = (
        session.query(ConfiguracaoSistema)
        .filter(ConfiguracaoSistema.chave == VENDEDORES_CATALOGO_KEY)
        .first()
    )
    return True if config is None else bool(config.valor)


@bp.get("/configuracoes/catalogo")
@login_required
def get_catalogo_config():
    return jsonify({"vendedoresPodemCadastrarProdutos": _get_flag(get_session())})


@bp.patch("/configuracoes/catalogo")
@admin_required
def update_catalogo_config():
    session = get_session()
    data = request.get_json(silent=True) or {}
    enabled = data.get("vendedoresPodemCadastrarProdutos")
    if not isinstance(enabled, bool):
        return jsonify({"error": "Informe um valor verdadeiro ou falso."}), 400

    config = (
        session.query(ConfiguracaoSistema)
        .filter(ConfiguracaoSistema.chave == VENDEDORES_CATALOGO_KEY)
        .first()
    )
    if config is None:
        config = ConfiguracaoSistema(
            chave=VENDEDORES_CATALOGO_KEY,
            descricao="Permite que vendedores cadastrem e editem produtos.",
            valor=enabled,
        )
        session.add(config)
    else:
        config.valor = enabled
    session.commit()
    return jsonify({"vendedoresPodemCadastrarProdutos": enabled})
