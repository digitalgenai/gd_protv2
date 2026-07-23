import { apiFetch } from './client';
import type { FilterState, Product } from '../types';

export interface CatalogFacets {
  categories: { value: string; count: number }[];
  suppliers: string[];
  finishes: string[];
  materials: string[];
  units: string[];
}

export interface CreateProductPayload {
  name: string;
  supplierId: string;
  cat: string;
  finish: string;
  material: string;
  dimensions: string;
  unit: string;
  salePrice: number;
  finalPrice: number;
  active: boolean;
}

export interface CatalogMaterial {
  id: string;
  type: string;
  name: string;
  reference: string | null;
  supplierId: string;
  supplier: string;
  displayName: string;
}

export interface CreateCatalogMaterialPayload {
  name: string;
  reference: string;
  supplierId: string;
}

export interface ProductAnalyticsProposal {
  code: string;
  cliente: string;
  qty: number;
  status: string;
}

export interface ProductAnalytics {
  timesSold: number;
  revenue: number;
  proposals: ProductAnalyticsProposal[];
}

/** RF-012 a RF-015: listagem, busca textual e filtros de catálogo. Sem fallback mockado —
 * se o backend estiver fora do ar, o erro sobe pra quem chamou mostrar. */
export async function fetchProducts(filters: Partial<FilterState> = {}): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  filters.categories?.forEach((c) => params.append('categoria', c));
  filters.suppliers?.forEach((s) => params.append('fornecedor', s));
  filters.finishes?.forEach((f) => params.append('acabamento', f));
  if (filters.priceRange && filters.priceRange !== 'all') params.set('faixa_preco', filters.priceRange);
  if (filters.sort) params.set('ordenar', filters.sort);

  return apiFetch<Product[]>(`/produtos?${params.toString()}`);
}

/** RF-015: valores disponíveis para cada filtro. */
export async function fetchCatalogFacets(): Promise<CatalogFacets> {
  return apiFetch<CatalogFacets>('/produtos/filtros');
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  return apiFetch<Product>('/produtos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createCatalogMaterial(payload: CreateCatalogMaterialPayload): Promise<CatalogMaterial> {
  return apiFetch<CatalogMaterial>('/materiais-catalogo', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** RF-017: edição dos dados cadastrados de um produto (nome, categoria, fornecedor, acabamento, preço). */
export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  return apiFetch<Product>(`/produtos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Aba Analytics do produto — quantas vezes apareceu em propostas reais e em quais. */
export async function fetchProductAnalytics(id: string): Promise<ProductAnalytics> {
  return apiFetch<ProductAnalytics>(`/produtos/${encodeURIComponent(id)}/analytics`);
}

export function filterProductsLocally(products: Product[], filters: Partial<FilterState>): Product[] {
  const search = (filters.search || '').toLowerCase();
  const { categories = [], suppliers = [], finishes = [], priceRange = 'all', sort = 'relevance' } = filters;

  let filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search) && !p.id.toLowerCase().includes(search)) return false;
    if (categories.length && !categories.includes(p.cat)) return false;
    if (suppliers.length && !suppliers.includes(p.supplier)) return false;
    if (finishes.length && !finishes.some((f) => p.finish.includes(f))) return false;
    if (priceRange === '0-3000' && p.price >= 3000) return false;
    if (priceRange === '3000-8000' && (p.price < 3000 || p.price >= 8000)) return false;
    if (priceRange === '8000+' && p.price < 8000) return false;
    return true;
  });

  filtered = [...filtered];
  if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  if (sort === 'name-asc') filtered.sort((a, b) => a.name.localeCompare(b.name));

  return filtered;
}
