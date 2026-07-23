import { apiFetch } from './client';
import type { MaterialSummary } from '../types';

export interface MaterialPayload {
  fornecedorId: string;
  nome: string;
  categoria: string;
  classificacao: string | null;
}

export function fetchMateriaisByFornecedor(fornecedorId: string): Promise<MaterialSummary[]> {
  return apiFetch<MaterialSummary[]>(`/materiais?fornecedor_id=${encodeURIComponent(fornecedorId)}`);
}

export function fetchMateriaisGestao(): Promise<MaterialSummary[]> {
  return apiFetch<MaterialSummary[]>('/materiais/gestao');
}

export function createMaterial(payload: MaterialPayload): Promise<MaterialSummary> {
  return apiFetch<MaterialSummary>('/materiais', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMaterial(id: string, payload: Partial<MaterialPayload> & { ativo?: boolean }): Promise<MaterialSummary> {
  return apiFetch<MaterialSummary>(`/materiais/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
