from flask import Blueprint, jsonify
from sqlalchemy.orm import selectinload

from db import get_session
from models import ErroImportacao
from utils.auth import login_required

bp = Blueprint("catalogo_qualidade", __name__)


@bp.get("/catalogo/qualidade")
@login_required
def get_qualidade():
    """RF-009/052/054 — só "erros de importação" tem tabela real (erros_importacao);
    hoje está vazia porque nenhuma das 14 importações já feitas falhou. "Imagens
    rejeitadas" não existe no schema real (não há conceito de rejeição de imagem no
    banco) — removida em vez de inventada. "Duplicados" é calculado no front a partir
    do catálogo real (nome/fornecedor), não precisa de tabela própria."""
    session = get_session()
    erros = (
        session.query(ErroImportacao)
        .options(selectinload(ErroImportacao.arquivo))
        .order_by(ErroImportacao.criado_em.desc())
        .all()
    )
    return jsonify({
        "errosImportacao": [
            {
                "arquivo": e.arquivo.nome if e.arquivo else "—",
                "aba": e.aba or "",
                "linha": e.linha,
                "mensagem": e.mensagem,
            }
            for e in erros
        ],
    })
