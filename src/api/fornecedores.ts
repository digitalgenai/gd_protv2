import { apiFetch } from './client';
import type { FornecedorSummary } from '../types';

/** Fornecedores cadastrados no banco (tabela `fornecedores`) — logo/site/contato ainda não têm coluna própria.
 * Sem fallback mockado — erro sobe pra quem chamou mostrar. */
export function fetchFornecedores(): Promise<FornecedorSummary[]> {
  return apiFetch<FornecedorSummary[]>('/fornecedores');
}
