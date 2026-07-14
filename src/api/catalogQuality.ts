import { apiFetch } from './client';

export interface ImportError {
  arquivo: string;
  aba: string;
  linha: number | null;
  mensagem: string;
}

export interface CatalogQualityReport {
  errosImportacao: ImportError[];
}

/** RF-009/RF-052/RF-054: erros de importação reais (tabela `erros_importacao`).
 * Sem fallback mockado — costuma vir vazio até que uma importação falhe de verdade. */
export function fetchCatalogQuality(): Promise<CatalogQualityReport> {
  return apiFetch<CatalogQualityReport>('/catalogo/qualidade');
}
