import { apiFetch, ApiUnavailableError } from './client';
import { MOCK_CATALOG_QUALITY, type CatalogQualityReport } from '../data/mockCatalogQuality';

/** RF-009/RF-052/RF-054: monitoramento da qualidade do catálogo e erros de importação. */
export async function fetchCatalogQuality(): Promise<CatalogQualityReport> {
  try {
    return await apiFetch<CatalogQualityReport>('/catalogo/qualidade');
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    return MOCK_CATALOG_QUALITY;
  }
}
