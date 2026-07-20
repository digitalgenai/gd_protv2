from flask import Blueprint, jsonify, request
from sqlalchemy import or_, text
from sqlalchemy.orm import selectinload

from config import DB_SCHEMA, PROPOSTA_VOZ_WEBHOOK_SECRET
from db import get_session
from models import CatalogoProduto, PropostaRascunho, RascunhoItem, Usuario
from utils.auth import login_required
from utils.openai_client import extrair_dados_proposta, transcrever_audio
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
@login_required
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
@login_required
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


@bp.post("/webhook/proposta-voz")
def webhook_proposta_voz():
    """RF-059 — recebido de um sistema externo de transcrição de voz (Whisper/OpenAI), fora
    deste app. Contrato definido por nós (ainda não integrado de verdade — ajustar aqui se o
    formato real divergir):

    Header: X-Webhook-Secret: <PROPOSTA_VOZ_WEBHOOK_SECRET>
    Body:
    {
      "transcricao": "texto bruto da fala" (obrigatório),
      "vendedor": "email ou nome do vendedor" (opcional — fica NULL se não bater com ninguém),
      "cliente": "nome do cliente" (opcional),
      "arquiteto": "nome do arquiteto" (opcional),
      "descontoGlobal": 10 (opcional, %),
      "itens": [{"codigo": "GD-0001", "quantidade": 2, "desconto": 0}, ...] (opcional)
    }

    Cria a linha em `proposta_rascunhos` (status inicial "aguardando_revisao") + uma em
    `rascunho_itens` por item, casando `codigo` com `catalogo_produtos.codigo` pra marcar
    encontrado/não encontrado — mesma lógica que a tela "Rascunhos de Voz" já espera.
    """
    if not PROPOSTA_VOZ_WEBHOOK_SECRET or request.headers.get("X-Webhook-Secret") != PROPOSTA_VOZ_WEBHOOK_SECRET:
        return jsonify({"error": "Não autorizado."}), 401

    data = request.get_json(silent=True) or {}
    transcricao = (data.get("transcricao") or "").strip()
    if not transcricao:
        return jsonify({"error": "Campo 'transcricao' é obrigatório."}), 400

    session = get_session()

    vendedor_id = None
    vendedor_ref = (data.get("vendedor") or "").strip()
    if vendedor_ref:
        vendedor = (
            session.query(Usuario)
            .filter(or_(Usuario.email == vendedor_ref, Usuario.nome.ilike(vendedor_ref)))
            .first()
        )
        if vendedor:
            vendedor_id = vendedor.id

    rascunho = PropostaRascunho(
        transcricao_original=transcricao,
        cliente_nome=(data.get("cliente") or "").strip() or None,
        arquiteto=(data.get("arquiteto") or "").strip() or None,
        vendedor_id=vendedor_id,
        dados_extraidos={"descontoGlobal": data.get("descontoGlobal") or 0},
    )
    session.add(rascunho)
    session.flush()  # garante rascunho.id pros itens abaixo

    for item in data.get("itens", []):
        codigo = (item.get("codigo") or "").strip()
        produto = (
            session.query(CatalogoProduto)
            .filter(CatalogoProduto.codigo.ilike(codigo), CatalogoProduto.ativo.is_(True))
            .first()
            if codigo else None
        )
        session.add(RascunhoItem(
            rascunho_id=rascunho.id,
            codigo_extraido=codigo or "—",
            produto_id=produto.id if produto else None,
            quantidade=item.get("quantidade") or 1,
            desconto=item.get("desconto") or 0,
            status="encontrado" if produto else "nao_encontrado",
        ))

    session.commit()
    return jsonify({"id": rascunho.id}), 201


def _buscar_produto_similar(session, descricao: str):
    """Casa a descrição extraída pelo GPT (ex.: "poltrona bege redonda") com o produto real
    mais parecido por nome, usando pg_trgm (já instalado no banco) — sem precisar de embedding/
    pgvector, que ainda não está disponível (ver utils/openai_client.py)."""
    descricao = (descricao or "").strip()
    if not descricao:
        return None
    row = session.execute(
        text(f"""
            SELECT id FROM {DB_SCHEMA}.catalogo_produtos
            WHERE ativo = true AND similarity(produto_nome, :busca) > 0.15
            ORDER BY similarity(produto_nome, :busca) DESC
            LIMIT 1
        """),
        {"busca": descricao},
    ).first()
    if not row:
        return None
    return (
        session.query(CatalogoProduto)
        .options(
            selectinload(CatalogoProduto.fornecedor),
            selectinload(CatalogoProduto.customizacoes),
            selectinload(CatalogoProduto.imagens),
        )
        .filter(CatalogoProduto.id == row.id)
        .first()
    )


@bp.post("/voz/transcrever")
@login_required
def transcrever_e_extrair():
    """Gravação feita direto no navegador (MediaRecorder) → Whisper (transcrição) → GPT
    (extração de cliente/arquiteto/desconto/itens) → cada item é casado com um produto real
    do catálogo por similaridade de texto (pg_trgm). Não persiste nada — o vendedor ainda
    revisa e confirma antes de virar proposta (mesmo fluxo de sempre)."""
    audio_file = request.files.get("audio")
    if not audio_file or not audio_file.filename:
        return jsonify({"error": "Nenhum áudio enviado."}), 400

    audio_bytes = audio_file.read()
    if not audio_bytes:
        return jsonify({"error": "Áudio vazio."}), 400
    print(f"[voz] audio recebido: {audio_file.filename}, {len(audio_bytes)} bytes, mimetype={audio_file.mimetype}", flush=True)

    try:
        transcricao = transcrever_audio(audio_bytes, audio_file.filename)
        extraido = (
            extrair_dados_proposta(transcricao)
            if transcricao
            else {
                "cliente": None, "telefoneCliente": None, "emailCliente": None, "enderecoCliente": None,
                "arquiteto": None, "descontoGlobal": 0, "itens": [],
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Falha na transcrição/extração por IA: {exc}"}), 502

    session = get_session()
    itens_resultado = []
    for item in extraido["itens"]:
        produto = _buscar_produto_similar(session, item["descricao"])
        itens_resultado.append({
            "descricaoOriginal": item["descricao"],
            "quantidade": item["quantidade"],
            "desconto": item["desconto"],
            "ambiente": item["ambiente"],
            "produto": serialize_product(produto) if produto else None,
        })

    return jsonify({
        "transcricao": transcricao,
        "semFalaDetectada": not transcricao,
        "cliente": extraido["cliente"],
        "telefoneCliente": extraido["telefoneCliente"],
        "emailCliente": extraido["emailCliente"],
        "enderecoCliente": extraido["enderecoCliente"],
        "arquiteto": extraido["arquiteto"],
        "descontoGlobal": extraido["descontoGlobal"],
        "itens": itens_resultado,
    })
