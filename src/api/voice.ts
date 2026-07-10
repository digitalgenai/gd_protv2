import { apiFetch, ApiUnavailableError } from './client';
import { MOCK_VOICE_DRAFTS } from '../data/mockProposals';
import type { VoiceDraft } from '../types';

/** RF-059: rascunhos pendentes de revisão gerados pelo webhook de voz. */
export async function fetchVoiceDrafts(): Promise<VoiceDraft[]> {
  try {
    return await apiFetch<VoiceDraft[]>('/proposta-rascunhos');
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    return MOCK_VOICE_DRAFTS;
  }
}

/** RF-061: confirma o rascunho revisado, convertendo-o em proposta. */
export async function confirmVoiceDraft(draftId: number): Promise<{ codigo: string }> {
  try {
    return await apiFetch<{ codigo: string }>(`/proposta-rascunhos/${draftId}/confirmar`, { method: 'POST' });
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    return { codigo: 'GD-RASCUNHO-LOCAL' };
  }
}
