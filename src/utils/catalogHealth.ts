import type { CatalogQualityReport } from '../data/mockCatalogQuality';
import type { Product } from '../types';

export interface CatalogHealthProblem {
  id: string;
  problema: string;
  badgeClass: string;
  produto: string;
  fornecedor: string;
  impacto: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface CatalogHealthSummary {
  semImagem: Product[];
  semPreco: Product[];
  imagensRejeitadas: CatalogQualityReport['imagensRejeitadas'];
  duplicados: CatalogQualityReport['duplicados'];
  errosImportacao: CatalogQualityReport['errosImportacao'];
}

/**
 * "Sem imagem" e "sem preço" são calculados a partir do catálogo real (via useProducts) —
 * agora que o backend Flask/Postgres está no ar, essas duas dimensões não precisam mais de
 * mock. "Imagens rejeitadas", "Duplicados" e "Erros de importação" continuam vindo do
 * relatório mockado (fetchCatalogQuality) até existir a lógica real por trás (RF-009/010/023).
 */
export function buildCatalogHealthSummary(products: Product[], report: CatalogQualityReport | null): CatalogHealthSummary {
  return {
    semImagem: products.filter((p) => !p.img),
    semPreco: products.filter((p) => !p.price),
    imagensRejeitadas: report?.imagensRejeitadas ?? [],
    duplicados: report?.duplicados ?? [],
    errosImportacao: report?.errosImportacao ?? [],
  };
}

export function buildCatalogHealthProblems(
  summary: CatalogHealthSummary,
  onFix: (product: Product, tab: 'info' | 'imagens') => void,
): CatalogHealthProblem[] {
  const problems: CatalogHealthProblem[] = [];

  summary.semImagem.forEach((p) => {
    problems.push({
      id: `sem-imagem-${p.id}`,
      problema: 'Sem imagem',
      badgeClass: 'badge-warning',
      produto: p.name,
      fornecedor: p.supplier,
      impacto: 'Alto — oculto em propostas',
      actionLabel: 'Adicionar imagem →',
      onAction: () => onFix(p, 'imagens'),
    });
  });

  summary.semPreco.forEach((p) => {
    problems.push({
      id: `sem-preco-${p.id}`,
      problema: 'Sem preço',
      badgeClass: 'badge-error',
      produto: p.name,
      fornecedor: p.supplier,
      impacto: 'Alto — não pode ser cotado',
      actionLabel: 'Cadastrar preço →',
      onAction: () => onFix(p, 'info'),
    });
  });

  summary.imagensRejeitadas.forEach((r, i) => {
    problems.push({
      id: `img-rejeitada-${r.produto.id}-${i}`,
      problema: 'Imagem rejeitada',
      badgeClass: 'badge-error',
      produto: r.produto.name,
      fornecedor: r.produto.supplier,
      impacto: r.motivo,
      actionLabel: 'Corrigir →',
      onAction: () => onFix(r.produto, 'imagens'),
    });
  });

  summary.duplicados.forEach((group, i) => {
    problems.push({
      id: `duplicado-${i}`,
      problema: 'Duplicado',
      badgeClass: 'badge-gold',
      produto: group.produtos.map((p) => p.name).join(' · '),
      fornecedor: group.produtos[0]?.supplier ?? '',
      impacto: group.motivo,
    });
  });

  summary.errosImportacao.forEach((e, i) => {
    problems.push({
      id: `erro-importacao-${i}`,
      problema: 'Erro de importação',
      badgeClass: 'badge-error',
      produto: e.arquivo,
      fornecedor: `${e.aba} · linha ${e.linha}`,
      impacto: e.mensagem,
    });
  });

  return problems;
}
