import { apiFetch, ApiError } from './client';
import type { ProposalDetail, ProposalRow, ProposalSummary } from '../types';

/** RF-053/3.4: histórico de propostas. Sem fallback mockado — erro sobe pra quem chamou mostrar. */
export async function fetchProposals(): Promise<ProposalSummary[]> {
  return apiFetch<ProposalSummary[]>('/propostas');
}

/**
 * Detalhe completo de uma proposta (tela de gerenciamento: resumo, PDF e versões).
 * 404 real do backend (proposta não existe) volta como `null` — qualquer outro erro
 * (rede caiu, 5xx) sobe pra quem chamou mostrar um estado de erro, não "não encontrada".
 */
export async function fetchProposalDetail(code: string): Promise<ProposalDetail | null> {
  try {
    return await apiFetch<ProposalDetail>(`/propostas/${encodeURIComponent(code)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export interface CreateProposalPayload {
  cliente: string;
  telefoneCliente: string | null;
  enderecoCliente: string | null;
  emailCliente: string | null;
  arquiteto: string | null;
  vendedor: string;
  validade: string;
  pagamento: string;
  versao: number;
  observacoes: string;
  descontoGlobal: number;
  itens: ProposalRow[];
}

/** RF-028 a RF-042: criação de proposta. Sem fallback — se falhar, o usuário precisa saber
 * que NÃO foi salva, nunca mostrar um código de sucesso falso. */
export async function createProposal(payload: CreateProposalPayload): Promise<{ codigo: string }> {
  return apiFetch<{ codigo: string }>('/propostas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
