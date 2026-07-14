from flask import Blueprint, jsonify, request
from sqlalchemy.orm import selectinload

from db import get_session
from models import CatalogoProduto, PropostaRascunho, RascunhoItem
from utils.serializers import serialize_product

bp = Blueprint("voz", __name__)


def _serialize_item(item):
    return {
        "codigoExtraido": item.codigo_extraido,
        "produto": serialize_product(item.produto) if item.produto else None,
        "quantidade": float(item.quantidade),
        "desconto": float(item.desconto),
        "status": item.status,
    }


def _serialize_rascunho(r):
    return {
        "id": r.id,
        "transcricaoOriginal": r.transcricao_original,
        "clienteNome": r.cliente_nome,
        "arquiteto": r.arquiteto,
        "vendedorId": str(r.vendedor_id) if r.vendedor_id else None,
        "vendedorNome": r.vendedor.nome if r.vendedor else None,
        "descontoGlobal": (r.dados_extraidos or {}).get("descontoGlobal", 0),
        "criadoEm": r.criado_em.isoformat() if r.criado_em else None,
        "itens": [_serialize_item(i) for i in r.itens],
    }


@bp.get("/rascunhos")
def list_rascunhos():
    """RF-059 — rascunhos de voz chegam aqui via um webhook externo (fora do escopo
    deste app, ainda não implementado); esta tela só lista o que já estiver aguardando
    revisão. Hoje a tabela está vazia porque esse webhook não existe ainda — lista
    real, sem dado inventado (nada a ver com a gravação pelo microfone no navegador,
    que é um fluxo totalmente separado e continua só client-side)."""
    session = get_session()
    rascunhos = (
        session.query(PropostaRascunho)
        .options(
            selectinload(PropostaRascunho.itens).selectinload(RascunhoItem.produto).selectinload(CatalogoProduto.fornecedor),
            selectinload(PropostaRascunho.itens).selectinload(RascunhoItem.produto).selectinload(CatalogoProduto.customizacoes),
            selectinload(PropostaRascunho.itens).selectinload(RascunhoItem.produto).selectinload(CatalogoProduto.imagens),
            selectinload(PropostaRascunho.vendedor),
        )
        .filter(PropostaRascunho.status == "aguardando_revisao")
        .order_by(PropostaRascunho.criado_em.desc())
        .all()
    )
    return jsonify([_serialize_rascunho(r) for r in rascunhos])


@bp.patch("/rascunhos/<int:rascunho_id>")
def update_rascunho_status(rascunho_id):
    session = get_session()
    data = request.get_json(silent=True) or {}
    novo_status = data.get("status")
    if novo_status not in ("confirmado", "descartado"):
        return jsonify({"error": "status deve ser 'confirmado' ou 'descartado'."}), 400

    rascunho = session.query(PropostaRascunho).filter(PropostaRascunho.id == rascunho_id).first()
    if not rascunho:
        return jsonify({"error": "Rascunho não encontrado."}), 404

    rascunho.status = novo_status
    session.commit()
    return jsonify({"ok": True})
