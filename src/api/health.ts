import { apiFetch, ApiUnavailableError } from './client';

interface HealthResponse {
  status: string;
  database: boolean;
}

/** RF-051: health check do backend — usado só para exibir status real na tela de Integrações. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await apiFetch<HealthResponse>('/health');
    return res.database;
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    return false;
  }
}
