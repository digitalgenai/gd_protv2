import { apiFetch, ApiUnavailableError } from './client';
import { MOCK_PROPOSALS, MOCK_PROPOSAL_DETAILS } from '../data/mockProposals';
import type { ProposalDetail, ProposalRow, ProposalSummary } from '../types';

/** RF-053/3.4: histórico de propostas. */
export async function fetchProposals(): Promise<ProposalSummary[]> {
  try {
    return await apiFetch<ProposalSummary[]>('/propostas');
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    return MOCK_PROPOSALS;
  }
}

/** Detalhe completo de uma proposta (tela de gerenciamento: resumo, PDF e versões). */
export async function fetchProposalDetail(code: string): Promise<ProposalDetail | null> {
  try {
    return await apiFetch<ProposalDetail>(`/propostas/${encodeURIComponent(code)}`);
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    return MOCK_PROPOSAL_DETAILS[code] ?? null;
  }
}

export interface CreateProposalPayload {
  cliente: string;
  arquiteto: string | null;
  vendedor: string;
  validade: string;
  pagamento: string;
  versao: number;
  observacoes: string;
  descontoGlobal: number;
  vendaDireta: boolean;
  itens: ProposalRow[];
}

/** RF-028 a RF-042: criação de proposta. */
export async function createProposal(payload: CreateProposalPayload): Promise<{ codigo: string }> {
  try {
    return await apiFetch<{ codigo: string }>('/propostas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    // Backend ainda não disponível: gera um código local só para a UI seguir o fluxo.
    return { codigo: buildLocalProposalCode(payload) };
  }
}

function buildLocalProposalCode(payload: CreateProposalPayload): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(2);
  const cli = payload.cliente.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 8) || 'CLIENTE';
  return `GD-${mm}.${yy}.${payload.vendedor || '---'}.001.v${payload.versao}.${cli}`;
}
