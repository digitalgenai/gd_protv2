import { apiFetch } from './client';
import type { RascunhoVoz } from '../types';

/** RF-059: rascunhos pendentes de revisão gerados por um webhook externo de voz (ainda não
 * implementado) — lista real, costuma vir vazia até esse webhook existir. Sem fallback mockado. */
export function fetchRascunhos(): Promise<RascunhoVoz[]> {
  return apiFetch<RascunhoVoz[]>('/rascunhos');
}

/** RF-061: marca um rascunho como confirmado (virou proposta) ou descartado. */
export function updateRascunhoStatus(id: number, status: 'confirmado' | 'descartado'): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/rascunhos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
