import { apiFetch } from './client';
import type { AcabamentoSummary } from '../types';

export interface AcabamentoPayload {
  fornecedorId: string;
  nome: string;
  categoria: string;
  classificacao: string | null;
}

export function fetchAcabamentosByFornecedor(fornecedorId: string): Promise<AcabamentoSummary[]> {
  return apiFetch<AcabamentoSummary[]>(`/acabamentos?fornecedor_id=${encodeURIComponent(fornecedorId)}`);
}

export function fetchAcabamentosGestao(): Promise<AcabamentoSummary[]> {
  return apiFetch<AcabamentoSummary[]>('/acabamentos/gestao');
}

export function createAcabamento(payload: AcabamentoPayload): Promise<AcabamentoSummary> {
  return apiFetch<AcabamentoSummary>('/acabamentos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAcabamento(id: string, payload: Partial<AcabamentoPayload> & { ativo?: boolean }): Promise<AcabamentoSummary> {
  return apiFetch<AcabamentoSummary>(`/acabamentos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
