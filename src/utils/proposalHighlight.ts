import type { AmbienteGroup } from './groupByAmbiente';
import type { Product, ProposalRow } from '../types';

export interface HighlightItem {
  row: ProposalRow;
  product: Product | undefined;
  img: NonNullable<Product['images']>[number];
}

/**
 * `highlightImageId` do row: `undefined` = escolhe automaticamente a primeira foto de ambiente
 * (posição > 1); `null` = vendedor optou por não destacar este item; número = imagem escolhida
 * manualmente pelo vendedor (ver ProposalItemRow).
 */
function resolveHighlightImage(row: ProposalRow, product: Product | undefined) {
  if (row.highlightImageId === null) return null;
  if (row.highlightImageId != null) {
    return product?.images?.find((img) => img.id === row.highlightImageId) ?? null;
  }
  return product?.images?.find((img) => img.posicao > 1) ?? null;
}

/** Agrupa por ambiente (mesma ordem da tabela principal) os itens que devem aparecer na página "Itens em Destaque" do PDF. */
export function buildHighlightGroups(groups: AmbienteGroup<ProposalRow>[], products: Product[]): AmbienteGroup<HighlightItem>[] {
  return groups
    .map((g) => ({
      ambiente: g.ambiente,
      items: g.items
        .map((row) => {
          const product = products.find((p) => p.id === row.code);
          const img = resolveHighlightImage(row, product);
          return img ? { row, product, img } : null;
        })
        .filter((item): item is HighlightItem => item !== null),
    }))
    .filter((g) => g.items.length > 0);
}
