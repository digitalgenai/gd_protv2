"""Cliente mínimo para a API REST do EngajaCRM (EspoCRM). Arquitetos são a entidade
"Account" de lá (campos customizados cEscritrio/cComissao só fazem sentido pra escritório
de arquitetura) — ver mcp-engajacrm/README.md para o mapeamento completo descoberto."""
import requests

from config import ESPOCRM_API_KEY, ESPOCRM_BASE_URL


class CrmError(Exception):
    """Erro de comunicação com o EngajaCRM (indisponível, credencial inválida, etc.)."""


def _get(path: str, params: dict | None = None) -> dict:
    if not ESPOCRM_BASE_URL or not ESPOCRM_API_KEY:
        raise CrmError("ESPOCRM_BASE_URL/ESPOCRM_API_KEY não configurados no .env.")
    try:
        resp = requests.get(
            f"{ESPOCRM_BASE_URL}/api/v1{path}",
            headers={"X-Api-Key": ESPOCRM_API_KEY},
            params=params or {},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        raise CrmError(f"Falha ao consultar o EngajaCRM: {exc}") from exc


def _post_or_put(method: str, path: str, payload: dict) -> dict:
    if not ESPOCRM_BASE_URL or not ESPOCRM_API_KEY:
        raise CrmError("ESPOCRM_BASE_URL/ESPOCRM_API_KEY não configurados no .env.")
    try:
        resp = requests.request(
            method,
            f"{ESPOCRM_BASE_URL}/api/v1{path}",
            headers={"X-Api-Key": ESPOCRM_API_KEY},
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        raise CrmError(f"Falha ao gravar no EngajaCRM: {exc}") from exc


# Valores reais do campo "stage" (Opportunity) nesta instância do EngajaCRM — confirmados via
# GET /Metadata (entityDefs.Opportunity.fields.stage.options), não são o enum padrão do EspoCRM.
ESTAGIO_POR_STATUS = {
    "rascunho": "Proposta em Desenvolvimento",
    "enviada": "Proposta Enviada",
    "aprovada": "Proposta Fechada",
    "recusada": "Cliente Perdido",
}


def _normaliza_nome(nome: str) -> str:
    import unicodedata
    sem_acento = unicodedata.normalize("NFKD", nome or "").encode("ascii", "ignore").decode("ascii")
    return " ".join(sem_acento.strip().lower().split())


def find_account_id_by_nome(nome_arquiteto: str) -> str | None:
    """Casa o nome livre do arquiteto (digitado na proposta) com uma Account já cadastrada no
    CRM, pra vincular a Opportunity a ela. Sem correspondência, a Opportunity fica sem accountId
    (continua aparecendo no kanban, só não fica associada a nenhum escritório)."""
    if not nome_arquiteto or not nome_arquiteto.strip():
        return None
    alvo = _normaliza_nome(nome_arquiteto)
    for arquiteto in list_arquitetos():
        if _normaliza_nome(arquiteto["nome"]) == alvo:
            return arquiteto["id"]
    return None


_assigned_user_id_cache: str | None = None


def _get_integration_user_id() -> str:
    """Id do próprio usuário de API (ver mcp-engajacrm/README.md — "Usuário de API" chamado
    integracao-propostas) — usado como assignedUser padrão nas Opportunities criadas por aqui,
    já que essa instância do EspoCRM exige um responsável em toda Opportunity."""
    global _assigned_user_id_cache
    if _assigned_user_id_cache is None:
        _assigned_user_id_cache = _get("/App/user")["user"]["id"]
    return _assigned_user_id_cache


def create_opportunity(*, nome: str, amount: float, status_db: str, account_id: str | None, close_date: str) -> str:
    """Cria a Opportunity no CRM que representa esta proposta (RF — 'alimentar o kanban deles com
    as nossas propostas'). Retorna o id criado, pra ser guardado em
    propostas_versoes.crm_opportunity_id e permitir atualizar o mesmo card depois.
    `close_date` é obrigatório nesta instância (campo "closeDate", formato AAAA-MM-DD) — nosso
    app ainda não persiste uma data de validade por proposta, então o chamador manda um default."""
    payload = {
        "name": nome,
        "amount": amount,
        "stage": ESTAGIO_POR_STATUS.get(status_db, ESTAGIO_POR_STATUS["rascunho"]),
        "closeDate": close_date,
        "assignedUserId": _get_integration_user_id(),
    }
    if account_id:
        payload["accountId"] = account_id
    data = _post_or_put("POST", "/Opportunity", payload)
    return data["id"]


def update_opportunity(opportunity_id: str, *, amount: float | None = None, status_db: str | None = None) -> None:
    """Atualiza o mesmo card já criado (valor e/ou estágio) em vez de duplicar no kanban."""
    payload: dict = {}
    if amount is not None:
        payload["amount"] = amount
    if status_db is not None:
        payload["stage"] = ESTAGIO_POR_STATUS.get(status_db, ESTAGIO_POR_STATUS["rascunho"])
    if not payload:
        return
    _post_or_put("PUT", f"/Opportunity/{opportunity_id}", payload)


def list_arquitetos() -> list[dict]:
    """Lista os escritórios/arquitetos cadastrados no CRM (entidade Account)."""
    data = _get("/Account", {"select": "id,name,cEscritrio", "maxSize": 200, "orderBy": "name"})
    return [
        {"id": row["id"], "nome": row["name"], "escritorio": row.get("cEscritrio") or None}
        for row in data.get("list", [])
    ]


def list_opportunities_by_account() -> dict[str, list[dict]]:
    """Negociações/propostas (entidade Opportunity) já registradas no CRM, agrupadas pelo id da
    Account (arquiteto) — vínculo direto por id, não por nome. Conta todo estágio, incluindo
    negócios perdidos: reflete o histórico completo de relacionamento com o arquiteto."""
    data = _get("/Opportunity", {"select": "id,accountId,amount,createdAt", "maxSize": 200})
    agrupado: dict[str, list[dict]] = {}
    for row in data.get("list", []):
        account_id = row.get("accountId")
        if not account_id:
            continue
        agrupado.setdefault(account_id, []).append({
            "amount": float(row.get("amount") or 0),
            "createdAt": row.get("createdAt"),
        })
    return agrupado
