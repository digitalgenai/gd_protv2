import unicodedata
import uuid
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from db import get_session
from models import CatalogoProduto, Proposta, PropostaItem, PropostaVersao, Usuario
from utils.crm_client import (
    CrmError,
    create_opportunity as crm_create_opportunity,
    find_account_id_by_nome as crm_find_account_id_by_nome,
    list_arquitetos as crm_list_arquitetos,
    list_opportunities_by_account as crm_list_opportunities_by_account,
)

bp = Blueprint("propostas", __name__)


def _normaliza_nome(nome: str) -> str:
    """Minúsculas, sem espaço nas pontas e sem acento — pra "Ana Rocha" bater com "ana rocha "
    ou "Ana Rôcha" digitado com variação de acento/caixa."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    return " ".join(sem_acento.strip().lower().split())

# Ver backend/seed_usuarios.py — usuário técnico único usado em toda proposta enquanto
# não existe autenticação real. O trigger fn_generate_codigo_base_proposta exige um
# vendedor_id não nulo (grava num contador mensal por vendedor), então não dá pra
# deixar isso vazio.
VENDEDOR_PADRAO_EMAIL = "vendedor.padrao@galpaodesign.local"


def _get_vendedor_padrao_id(session):
    vendedor = session.query(Usuario).filter(Usuario.email == VENDEDOR_PADRAO_EMAIL).first()
    if not vendedor:
        raise RuntimeError(
            f'Usuário padrão "{VENDEDOR_PADRAO_EMAIL}" não encontrado — rode "python seed_usuarios.py" primeiro.',
        )
    return vendedor.id


def _resolve_vendedor_id(session, vendedor_id_raw):
    """Usa o vendedor selecionado no front (id real de `usuarios`) quando válido;
    cai pro vendedor padrão se vier vazio, malformado ou não corresponder a ninguém ativo."""
    if vendedor_id_raw:
        try:
            vendedor_uuid = uuid.UUID(str(vendedor_id_raw))
        except ValueError:
            vendedor_uuid = None
        if vendedor_uuid:
            vendedor = (
                session.query(Usuario)
                .filter(Usuario.id == vendedor_uuid, Usuario.is_active.is_(True))
                .first()
            )
            if vendedor:
                return vendedor.id
    return _get_vendedor_padrao_id(session)

# O enum do banco (status_versao_enum) não bate 1:1 com o ProposalStatus do front —
# "Revisão" não existe como estado de versão no banco (é um fluxo só do front) e
# "recusada" no banco corresponde a "Reprovada" no front.
STATUS_DB_TO_FRONT = {
    "rascunho": "Rascunho",
    "enviada": "Enviada",
    "aprovada": "Aprovada",
    "recusada": "Reprovada",
}


def _map_status(db_status: str) -> str:
    return STATUS_DB_TO_FRONT.get(db_status, "Rascunho")


def _format_date(dt) -> str:
    return dt.strftime("%d/%m/%Y") if dt else ""


@bp.get("/vendedores")
def list_vendedores():
    session = get_session()
    vendedores = (
        session.query(Usuario)
        .filter(Usuario.is_active.is_(True))
        .order_by(Usuario.nome)
        .all()
    )
    return jsonify([
        {"id": str(v.id), "nome": v.nome, "codigoVendedor": v.codigo_vendedor}
        for v in vendedores
    ])


@bp.get("/clientes")
def list_clientes():
    """Diretório agregado de clientes — não existe tabela própria ainda; cada cliente é
    derivado dos nomes já usados em propostas reais (RN combinada com o time)."""
    session = get_session()
    propostas = (
        session.query(Proposta)
        .options(selectinload(Proposta.versoes).selectinload(PropostaVersao.itens))
        .all()
    )

    agregados = {}
    for proposta in propostas:
        if not proposta.versoes:
            continue
        chave = proposta.cliente_nome.strip()
        if not chave:
            continue
        ultima = max(proposta.versoes, key=lambda v: v.versao_numero)
        valor = sum(float(item.valor_total or 0) for item in ultima.itens)

        entrada = agregados.setdefault(chave, {
            "nome": chave, "telefone": None, "endereco": None,
            "propostas": 0, "valorTotal": 0.0, "ultimaProposta": None,
        })
        entrada["telefone"] = proposta.cliente_telefone or entrada["telefone"]
        entrada["endereco"] = proposta.cliente_endereco or entrada["endereco"]
        entrada["propostas"] += 1
        entrada["valorTotal"] += valor
        if not entrada["ultimaProposta"] or proposta.criado_em > entrada["ultimaProposta"]:
            entrada["ultimaProposta"] = proposta.criado_em

    resultado = sorted(
        [{**e, "ultimaProposta": _format_date(e["ultimaProposta"])} for e in agregados.values()],
        key=lambda r: r["nome"].lower(),
    )
    return jsonify(resultado)


def _soma_entrada(entrada, count, valor, data):
    entrada["propostas"] += count
    entrada["valorTotal"] += valor
    if data and (not entrada["ultimaProposta"] or data > entrada["ultimaProposta"]):
        entrada["ultimaProposta"] = data


@bp.get("/arquitetos")
def list_arquitetos():
    """Diretório de arquitetos: a lista em si vem do EngajaCRM (fonte de verdade de quem são
    os arquitetos parceiros). Propostas/valorTotal/últimaProposta somam duas fontes:
    1) negociações (Opportunity) já registradas no CRM, vinculadas por id da Account — conta
       todo estágio, incluindo negócios perdidos, pra refletir o histórico completo; e
    2) propostas criadas aqui no nosso sistema, cruzadas pelo texto livre `arquiteto_nome`
       (não há vínculo por id nessa ponta ainda — só o nome, normalizado)."""
    try:
        arquitetos_crm = crm_list_arquitetos()
        oportunidades_por_account = crm_list_opportunities_by_account()
    except CrmError as exc:
        return jsonify({"error": str(exc)}), 502

    session = get_session()
    propostas = (
        session.query(Proposta)
        .options(selectinload(Proposta.versoes).selectinload(PropostaVersao.itens))
        .all()
    )

    stats_por_nome = {}
    for proposta in propostas:
        if not proposta.versoes:
            continue
        chave = _normaliza_nome(proposta.arquiteto_nome or "")
        if not chave:
            continue
        ultima = max(proposta.versoes, key=lambda v: v.versao_numero)
        valor = sum(float(item.valor_total or 0) for item in ultima.itens)

        # .replace(tzinfo=None): criado_em vem com timezone do banco, mas o createdAt do CRM
        # chega naive (sem tz) — precisam do mesmo tipo pra dar pra comparar com ">" mais abaixo.
        data_criacao = proposta.criado_em.replace(tzinfo=None) if proposta.criado_em else None
        entrada = stats_por_nome.setdefault(chave, {"propostas": 0, "valorTotal": 0.0, "ultimaProposta": None})
        _soma_entrada(entrada, 1, valor, data_criacao)

    resultado = []
    for arquiteto in arquitetos_crm:
        entrada = {"propostas": 0, "valorTotal": 0.0, "ultimaProposta": None}

        for oportunidade in oportunidades_por_account.get(arquiteto["id"], []):
            data = None
            if oportunidade["createdAt"]:
                try:
                    data = datetime.strptime(oportunidade["createdAt"], "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    data = None
            _soma_entrada(entrada, 1, oportunidade["amount"], data)

        stats_locais = stats_por_nome.get(_normaliza_nome(arquiteto["nome"]))
        if stats_locais:
            _soma_entrada(entrada, stats_locais["propostas"], stats_locais["valorTotal"], stats_locais["ultimaProposta"])

        resultado.append({
            "id": arquiteto["id"],
            "nome": arquiteto["nome"],
            "escritorio": arquiteto["escritorio"],
            "propostas": entrada["propostas"],
            "valorTotal": entrada["valorTotal"],
            "ultimaProposta": _format_date(entrada["ultimaProposta"]),
        })

    resultado.sort(key=lambda r: r["nome"].lower())
    return jsonify(resultado)


@bp.get("/propostas")
def list_propostas():
    session = get_session()
    propostas = (
        session.query(Proposta)
        .options(
            selectinload(Proposta.versoes).selectinload(PropostaVersao.itens),
            selectinload(Proposta.vendedor),
        )
        .order_by(Proposta.id.desc())
        .all()
    )

    result = []
    for proposta in propostas:
        if not proposta.versoes:
            continue
        ultima = max(proposta.versoes, key=lambda v: v.versao_numero)
        valor = sum(float(item.valor_total or 0) for item in ultima.itens)
        result.append({
            "code": ultima.codigo_proposta or proposta.codigo_base or f"GD-{proposta.id}",
            "cliente": proposta.cliente_nome,
            "arquiteto": proposta.arquiteto_nome,
            "vendedor": proposta.vendedor.nome if proposta.vendedor else "",
            "valor": valor,
            "data": _format_date(proposta.criado_em),
            "versao": ultima.versao_numero,
            "status": _map_status(ultima.status),
            "pdfGerado": bool(ultima.pdf_path),
        })
    return jsonify(result)


@bp.get("/propostas/<codigo_proposta>")
def get_proposta_detail(codigo_proposta):
    session = get_session()
    versao = (
        session.query(PropostaVersao)
        .options(
            selectinload(PropostaVersao.itens),
            selectinload(PropostaVersao.proposta).selectinload(Proposta.versoes),
            selectinload(PropostaVersao.proposta).selectinload(Proposta.vendedor),
        )
        .filter(PropostaVersao.codigo_proposta == codigo_proposta)
        .first()
    )
    if not versao:
        return jsonify(None), 404

    proposta = versao.proposta
    valor = sum(float(item.valor_total or 0) for item in versao.itens)

    itens = [
        {
            "id": item.id,
            # ambiente e materiais de outros fornecedores não existem no schema real
            # ainda — ficam vazios até uma migration adicionar essas colunas.
            "ambiente": "",
            "code": item.codigo_produto,
            "desc": item.nome_produto,
            "qty": item.quantidade,
            "price": float(item.preco_unitario_snapshot),
            "disc": float(item.desconto_percentual),
            "materiais": [],
        }
        for item in versao.itens
    ]

    versoes = [
        {
            "code": v.codigo_proposta or f"{proposta.codigo_base}.v{v.versao_numero}",
            "versao": v.versao_numero,
            "status": _map_status(v.status),
            "data": _format_date(v.criado_em),
            "pdfGerado": bool(v.pdf_path),
        }
        for v in sorted(proposta.versoes, key=lambda v: v.versao_numero)
    ]

    return jsonify({
        "code": versao.codigo_proposta,
        "cliente": proposta.cliente_nome,
        "arquiteto": proposta.arquiteto_nome,
        "vendedor": proposta.vendedor.nome if proposta.vendedor else "",
        "valor": valor,
        "data": _format_date(proposta.criado_em),
        "versao": versao.versao_numero,
        "status": _map_status(versao.status),
        "pdfGerado": bool(versao.pdf_path),
        # validade/pagamento/ambientes: sem coluna correspondente no banco real ainda
        # (features adicionadas no front antes do backend existir).
        "validade": "",
        "pagamento": "",
        "observacoes": proposta.observacoes or "",
        "telefoneCliente": proposta.cliente_telefone,
        "enderecoCliente": proposta.cliente_endereco,
        "emailCliente": proposta.cliente_email,
        "ambientes": [],
        "itens": itens,
        "versoes": versoes,
    })


@bp.post("/propostas")
def create_proposta():
    session = get_session()
    data = request.get_json(silent=True) or {}

    cliente = (data.get("cliente") or "").strip()
    if not cliente:
        return jsonify({"error": "Cliente é obrigatório."}), 400

    proposta = Proposta(
        cliente_nome=cliente,
        cliente_telefone=data.get("telefoneCliente") or None,
        cliente_endereco=data.get("enderecoCliente") or None,
        cliente_email=data.get("emailCliente") or None,
        arquiteto_nome=data.get("arquiteto") or None,
        desconto_geral=data.get("descontoGlobal") or 0,
        observacoes=data.get("observacoes") or None,
        vendedor_id=_resolve_vendedor_id(session, data.get("vendedor")),
    )
    session.add(proposta)
    session.flush()  # dispara o trigger que gera codigo_base

    versao = PropostaVersao(proposta_id=proposta.id, versao_numero=1, status="rascunho")
    session.add(versao)
    session.flush()  # dispara o trigger que gera codigo_proposta

    for item in data.get("itens", []):
        codigo_produto = (item.get("code") or "").strip()
        produto = None
        customizacao = None
        if codigo_produto:
            produto = (
                session.query(CatalogoProduto)
                .options(selectinload(CatalogoProduto.customizacoes))
                .filter(CatalogoProduto.codigo == codigo_produto)
                .first()
            )
            if produto:
                customizacao = next((c for c in produto.customizacoes if c.ativo), None)

        # chk_customizacao_identificada: se produto_id não é nulo, o banco exige
        # customizacao_id OU customizacao_descricao — sem isso o INSERT é rejeitado.
        session.add(PropostaItem(
            versao_id=versao.id,
            produto_id=produto.id if produto else None,
            customizacao_id=customizacao.id if customizacao else None,
            customizacao_descricao=None if customizacao else (
                (item.get("desc") or "Sem customização cadastrada") if produto else None
            ),
            codigo_produto=codigo_produto or "—",
            nome_produto=item.get("desc") or "",
            preco_unitario_snapshot=item.get("price") or 0,
            quantidade=item.get("qty") or 1,
            desconto_percentual=item.get("disc") or 0,
        ))

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        return jsonify({"error": f"Não foi possível salvar a proposta: {exc.orig}"}), 400

    session.refresh(versao)
    _sync_opportunity_no_crm(session, proposta, versao)
    return jsonify({"codigo": versao.codigo_proposta}), 201


def _sync_opportunity_no_crm(session, proposta, versao):
    """Espelha a proposta recém-criada como uma Opportunity no kanban do EngajaCRM — melhor
    esforço: se o CRM estiver fora do ar ou mal configurado, a proposta já foi salva no nosso
    banco normalmente, só não aparece lá até uma próxima tentativa manual."""
    account_id = None
    if proposta.arquiteto_nome:
        try:
            account_id = crm_find_account_id_by_nome(proposta.arquiteto_nome)
        except CrmError:
            account_id = None

    total = sum(float(item.valor_total or 0) for item in versao.itens)
    try:
        opportunity_id = crm_create_opportunity(
            nome=f"{versao.codigo_proposta} — {proposta.cliente_nome}",
            amount=total,
            status_db=versao.status,
            account_id=account_id,
            # App ainda não persiste validade por proposta — usa +48h (padrão comercial da
            # validade da proposta, ver ProposalDraftContext.tsx) como closeDate no CRM.
            close_date=(datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
        )
        versao.crm_opportunity_id = opportunity_id
        session.commit()
    except CrmError as exc:
        print(f"[crm] Falha ao criar Opportunity no EngajaCRM para {versao.codigo_proposta}: {exc}", flush=True)
