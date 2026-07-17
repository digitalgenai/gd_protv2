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
