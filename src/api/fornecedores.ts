import { apiFetch } from './client';
import type { FornecedorSummary } from '../types';

export function fetchFornecedores(): Promise<FornecedorSummary[]> {
  return apiFetch<FornecedorSummary[]>('/fornecedores');
}

export interface FornecedorPayload {
  nome: string;
  site: string | null;
  contato: string | null;
}

export function createFornecedor(payload: FornecedorPayload): Promise<FornecedorSummary> {
  return apiFetch<FornecedorSummary>('/fornecedores', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateFornecedor(id: string, payload: FornecedorPayload): Promise<FornecedorSummary> {
  return apiFetch<FornecedorSummary>(`/fornecedores/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
