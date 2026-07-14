import { apiFetch } from './client';
import type { ArquitetoSummary, ClienteSummary } from '../types';

/** Garante um `id` estável mesmo quando o backend não manda um — usa o nome como chave. */
function withId<T extends { nome: string; id?: string }>(rows: T[]): (T & { id: string })[] {
  return rows.map((r) => ({ ...r, id: r.id || r.nome }));
}

/** Diretório de clientes — agregado das propostas (não existe cadastro próprio ainda).
 * Sem fallback mockado — erro sobe pra quem chamou mostrar. */
export async function fetchClientes(): Promise<ClienteSummary[]> {
  return withId(await apiFetch<ClienteSummary[]>('/clientes'));
}

/** Diretório de arquitetos — agregado das propostas (não existe cadastro próprio ainda).
 * Sem fallback mockado — erro sobe pra quem chamou mostrar. */
export async function fetchArquitetos(): Promise<ArquitetoSummary[]> {
  return withId(await apiFetch<ArquitetoSummary[]>('/arquitetos'));
}
