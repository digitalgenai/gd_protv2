from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify
from sqlalchemy.orm import selectinload

from db import get_session
from models import ArquivoDrive, CatalogoProduto, Proposta, PropostaVersao

bp = Blueprint("dashboard", __name__)


def _mesmo_mes(dt, ref) -> bool:
    return dt is not None and dt.year == ref.year and dt.month == ref.month


def _mes_anterior(ref):
    primeiro_dia = ref.replace(day=1)
    return (primeiro_dia - timedelta(days=1)).replace(day=1)


@bp.get("/dashboard/kpis")
def dashboard_kpis():
    """Agregados reais do dashboard (RF-051). Sem contador de eventos histórico no banco —
    "enviada" usa o status atual da última versão + updated_at do mês como proxy de
    "saiu do rascunho este mês" (é uma aproximação: não existe timestamp dedicado de envio)."""
    session = get_session()
    agora = datetime.now(timezone.utc)
    mes_anterior_ref = _mes_anterior(agora)

    propostas = (
        session.query(Proposta)
        .options(selectinload(Proposta.versoes).selectinload(PropostaVersao.itens))
        .all()
    )

    faturamento_mes = 0.0
    faturamento_mes_anterior = 0.0
    enviadas_mes = 0
    enviadas_mes_anterior = 0
    aprovadas_mes = 0
    aprovadas_mes_anterior = 0
    recusadas_mes = 0
    recusadas_mes_anterior = 0
    rascunho_atual = 0
    enviada_atual = 0

    for proposta in propostas:
        if not proposta.versoes:
            continue
        ultima = max(proposta.versoes, key=lambda v: v.versao_numero)
        ref = ultima.updated_at or ultima.criado_em
        valor = sum(float(item.valor_total or 0) for item in ultima.itens)

        if ultima.status == "rascunho":
            rascunho_atual += 1
        elif ultima.status == "enviada":
            enviada_atual += 1

        if ultima.status != "rascunho":
            if _mesmo_mes(ref, agora):
                enviadas_mes += 1
            elif _mesmo_mes(ref, mes_anterior_ref):
                enviadas_mes_anterior += 1

        if ultima.status == "aprovada":
            if _mesmo_mes(ref, agora):
                aprovadas_mes += 1
                faturamento_mes += valor
            elif _mesmo_mes(ref, mes_anterior_ref):
                aprovadas_mes_anterior += 1
                faturamento_mes_anterior += valor
        elif ultima.status == "recusada":
            if _mesmo_mes(ref, agora):
                recusadas_mes += 1
            elif _mesmo_mes(ref, mes_anterior_ref):
                recusadas_mes_anterior += 1

    decididas_mes = aprovadas_mes + recusadas_mes
    decididas_mes_anterior = aprovadas_mes_anterior + recusadas_mes_anterior
    taxa_conversao_mes = (aprovadas_mes / decididas_mes * 100) if decididas_mes else 0.0
    taxa_conversao_mes_anterior = (
        (aprovadas_mes_anterior / decididas_mes_anterior * 100) if decididas_mes_anterior else 0.0
    )

    uma_semana_atras = agora - timedelta(days=7)
    produtos_ativos_query = session.query(CatalogoProduto).filter(CatalogoProduto.ativo.is_(True))
    produtos_catalogo = produtos_ativos_query.count()
    produtos_novos_semana = produtos_ativos_query.filter(
        CatalogoProduto.criado_em >= uma_semana_atras,
    ).count()

    ultimo_arquivo = (
        session.query(ArquivoDrive)
        .options(selectinload(ArquivoDrive.fornecedor))
        .order_by(ArquivoDrive.processado_em.desc())
        .first()
    )
    ultimo_import = None
    if ultimo_arquivo:
        ultimo_import = {
            "nome": ultimo_arquivo.nome,
            "fornecedor": ultimo_arquivo.fornecedor.nome if ultimo_arquivo.fornecedor else None,
            "status": ultimo_arquivo.status,
            "processadoEm": ultimo_arquivo.processado_em.isoformat() if ultimo_arquivo.processado_em else None,
        }

    return jsonify({
        "faturamentoMes": round(faturamento_mes, 2),
        "faturamentoMesAnterior": round(faturamento_mes_anterior, 2),
        "propostasEnviadasMes": enviadas_mes,
        "propostasEnviadasMesAnterior": enviadas_mes_anterior,
        "taxaConversaoMes": round(taxa_conversao_mes, 1),
        "taxaConversaoMesAnterior": round(taxa_conversao_mes_anterior, 1),
        "produtosCatalogo": produtos_catalogo,
        "produtosNovosSemana": produtos_novos_semana,
        "pipeline": {
            "rascunho": rascunho_atual,
            "enviada": enviada_atual,
            "aprovadaMes": aprovadas_mes,
        },
        "ultimoImport": ultimo_import,
    })
