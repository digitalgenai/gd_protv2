import { apiFetch } from './client';

export interface UltimoImportDrive {
  nome: string | null;
  fornecedor: string | null;
  status: 'ok' | 'processando' | 'erro';
  processadoEm: string | null;
}

export interface DashboardKpis {
  faturamentoMes: number;
  faturamentoMesAnterior: number;
  propostasEnviadasMes: number;
  propostasEnviadasMesAnterior: number;
  taxaConversaoMes: number;
  taxaConversaoMesAnterior: number;
  produtosCatalogo: number;
  produtosNovosSemana: number;
  pipeline: {
    rascunho: number;
    enviada: number;
    aprovadaMes: number;
  };
  ultimoImport: UltimoImportDrive | null;
}

/** Agregados reais do dashboard (RF-051). Sem fallback mockado. */
export function fetchDashboardKpis(): Promise<DashboardKpis> {
  return apiFetch<DashboardKpis>('/dashboard/kpis');
}
