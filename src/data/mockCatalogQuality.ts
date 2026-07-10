import { MOCK_PRODUCTS } from './mockProducts';
import type { Product } from '../types';

export interface RejectedImage {
  produto: Product;
  motivo: string;
  data: string;
}

export interface DuplicateGroup {
  produtos: Product[];
  motivo: string;
}

export interface ImportError {
  arquivo: string;
  aba: string;
  linha: number;
  mensagem: string;
}

export interface CatalogQualityReport {
  produtosSemImagem: Product[];
  imagensRejeitadas: RejectedImage[];
  duplicados: DuplicateGroup[];
  errosImportacao: ImportError[];
}

const byId = (id: string) => MOCK_PRODUCTS.find((p) => p.id === id)!;

/**
 * Relatório de qualidade do catálogo — dado ilustrativo (RF-009/RF-052/RF-054 do
 * requirements_v2.md) enquanto o worker de ingestão real (Google Drive → banco) não existe.
 */
export const MOCK_CATALOG_QUALITY: CatalogQualityReport = {
  produtosSemImagem: [byId('GD-EST-021'), byId('GD-APA-017')],
  imagensRejeitadas: [
    { produto: byId('GD-CAM-015'), motivo: 'Resolução abaixo de 600×600px', data: 'Ontem · 09:00' },
    { produto: byId('GD-TAP-023'), motivo: 'Imagem fora de foco', data: 'Ontem · 09:00' },
    { produto: byId('GD-POL-011'), motivo: 'Resolução abaixo de 600×600px', data: '03/05/2026' },
  ],
  duplicados: [
    { produtos: [byId('GD-LUM-007'), byId('GD-LUM-019')], motivo: 'Nome e fornecedor muito semelhantes (Punto Luce)' },
  ],
  errosImportacao: [
    { arquivo: 'Catalogo_Maio_2026.xlsx', aba: 'Cadeiras', linha: 14, mensagem: 'Preço não numérico ("R$ --")' },
    { arquivo: 'Catalogo_Maio_2026.xlsx', aba: 'Iluminação', linha: 22, mensagem: 'Código do produto ausente' },
    { arquivo: 'Fornecedor_Dpot_Abril.xlsx', aba: 'Armários', linha: 8, mensagem: 'Dimensões em formato inválido ("200 x x75")' },
  ],
};
