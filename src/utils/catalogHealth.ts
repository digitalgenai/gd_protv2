import type { CatalogQualityReport } from '../api/catalogQuality';
import type { Product } from '../types';

export interface DuplicateGroup {
  produtos: Product[];
  motivo: string;
}

export interface CatalogHealthSummary {
  semImagem: Product[];
  semPreco: Product[];
  duplicados: DuplicateGroup[];
  errosImportacao: CatalogQualityReport['errosImportacao'];
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Duplicatas = mesmo nome (normalizado) + mesmo fornecedor entre produtos reais do catálogo.
 * Heurística conservadora (nome idêntico após normalizar acentos/caixa), calculada aqui porque
 * o banco não tem tabela/flag própria pra isso — os dados de entrada (nome, fornecedor) são
 * reais, só a comparação é código novo.
 */
function findDuplicates(products: Product[]): DuplicateGroup[] {
  const groups = new Map<string, Product[]>();
  products.forEach((p) => {
    if (!p.name.trim()) return;
    const key = `${normalizeName(p.name)}::${p.supplier}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  });
  return Array.from(groups.values())
    .filter((arr) => arr.length > 1)
    .map((produtos) => ({ produtos, motivo: `Mesmo nome e fornecedor (${produtos[0].supplier})` }));
}

/**
 * "Sem imagem" e "sem preço" vêm do catálogo real (useProducts). "Duplicados" é calculado
 * aqui a partir do catálogo real. "Erros de importação" vem do relatório real
 * (fetchCatalogQuality) — não existe mais "imagens rejeitadas": não há coluna/tabela de
 * rejeição de imagem no banco, então essa dimensão foi removida em vez de inventada.
 */
export function buildCatalogHealthSummary(products: Product[], report: CatalogQualityReport | null): CatalogHealthSummary {
  return {
    semImagem: products.filter((p) => !p.img),
    semPreco: products.filter((p) => !p.price),
    duplicados: findDuplicates(products),
    errosImportacao: report?.errosImportacao ?? [],
  };
}

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
      fornecedor: e.aba ? `${e.aba}${e.linha ? ` · linha ${e.linha}` : ''}` : '',
      impacto: e.mensagem,
    });
  });

  return problems;
}
