import type { ProposalStatus } from '../types';

export const STATUS_BADGE: Record<ProposalStatus, string> = {
  Aprovada: 'badge-success',
  Enviada: 'badge-info',
  Rascunho: 'badge-draft',
  Reprovada: 'badge-error',
  Revisão: 'badge-warning',
};

export function statusBadgeLabel(status: ProposalStatus): string {
  return status === 'Revisão' ? 'Em Revisão' : status;
}
