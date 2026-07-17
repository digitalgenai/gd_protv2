/**
 * Cliente mínimo pra API REST do EspoCRM (base do EngajaCRM). Autenticação via API Key
 * (header X-Api-Key) — criada em Administração → API Users no próprio EspoCRM, com o
 * papel/permissões de quem a API pode enxergar e alterar.
 * Docs: https://docs.espocrm.com/development/api/
 */

export interface WhereClause {
  type: string;
  attribute?: string;
  value?: unknown;
}

export interface ListParams {
  select?: string;
  maxSize?: number;
  offset?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
  textFilter?: string;
  where?: WhereClause[];
}

function getConfig() {
  const baseUrl = process.env.ESPOCRM_BASE_URL;
  const apiKey = process.env.ESPOCRM_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      'ESPOCRM_BASE_URL e ESPOCRM_API_KEY precisam estar definidos (arquivo .env em mcp-engajacrm/ ou variáveis de ambiente).',
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

function buildQueryString(params: ListParams): string {
  const qs = new URLSearchParams();
  if (params.select) qs.set('select', params.select);
  if (params.maxSize !== undefined) qs.set('maxSize', String(params.maxSize));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.orderBy) qs.set('orderBy', params.orderBy);
  if (params.order) qs.set('order', params.order);
  if (params.textFilter) qs.set('textFilter', params.textFilter);
  (params.where ?? []).forEach((clause, i) => {
    qs.set(`where[${i}][type]`, clause.type);
    if (clause.attribute !== undefined) qs.set(`where[${i}][attribute]`, clause.attribute);
    if (clause.value !== undefined) {
      qs.set(`where[${i}][value]`, typeof clause.value === 'string' ? clause.value : JSON.stringify(clause.value));
    }
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
}

async function espoFetch(path: string, init: RequestInit = {}) {
  const { baseUrl, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EspoCRM API respondeu ${res.status} ${res.statusText} em ${path}: ${body}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function listRecords(entityType: string, params: ListParams = {}) {
  return espoFetch(`/${encodeURIComponent(entityType)}${buildQueryString(params)}`);
}

export function getRecord(entityType: string, id: string) {
  return espoFetch(`/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`);
}

export function createRecord(entityType: string, attributes: Record<string, unknown>) {
  return espoFetch(`/${encodeURIComponent(entityType)}`, {
    method: 'POST',
    body: JSON.stringify(attributes),
  });
}

export function updateRecord(entityType: string, id: string, attributes: Record<string, unknown>) {
  return espoFetch(`/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(attributes),
  });
}

/** EspoCRM faz soft-delete (registro vai pra lixeira, recuperável pela administração) — não é exclusão definitiva. */
export function deleteRecord(entityType: string, id: string) {
  return espoFetch(`/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
