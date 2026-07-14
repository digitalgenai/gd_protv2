import { apiFetch } from './client';

export interface VendedorSummary {
  id: string;
  nome: string;
  codigoVendedor: number | null;
}

/** Vendedores reais (usuários ativos da tabela `usuarios`). Sem fallback mockado. */
export function fetchVendedores(): Promise<VendedorSummary[]> {
  return apiFetch<VendedorSummary[]>('/vendedores');
}
