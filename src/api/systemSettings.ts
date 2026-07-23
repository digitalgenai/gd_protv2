import { apiFetch } from './client';

export interface CatalogSystemSettings {
  vendedoresPodemCadastrarProdutos: boolean;
}

export function fetchCatalogSystemSettings(): Promise<CatalogSystemSettings> {
  return apiFetch<CatalogSystemSettings>('/configuracoes/catalogo');
}

export function updateCatalogSystemSettings(enabled: boolean): Promise<CatalogSystemSettings> {
  return apiFetch<CatalogSystemSettings>('/configuracoes/catalogo', {
    method: 'PATCH',
    body: JSON.stringify({ vendedoresPodemCadastrarProdutos: enabled }),
  });
}
