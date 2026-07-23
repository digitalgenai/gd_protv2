/** Somente estas famílias do catálogo representam peças estofadas e aceitam
 * tecido vindo de outro fornecedor na proposta. */
const UPHOLSTERED_CATEGORIES = new Set([
  'estofados',
  'sofas',
  'poltronas',
  'puffs',
  'puffs & chaises',
  'chaises',
]);

function normalizeCategory(category: string) {
  return category
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

export function isUpholsteredCategory(category?: string | null) {
  return Boolean(category && UPHOLSTERED_CATEGORIES.has(normalizeCategory(category)));
}

/** Sugestões de tecidos complementares por família de estofado.
 * Dado ilustrativo enquanto não existe um catálogo real de tecidos por fornecedor. */
export const MATERIAL_SUGGESTIONS_BY_CATEGORY: Record<string, string[]> = {
  Sofás: [
    'Tecido Linho Natural',
    'Tecido Veludo Verde-Musgo',
    'Tecido Bouclê Off-White',
    'Couro Ecológico Caramelo',
    'Chenille Cinza',
  ],
  Poltronas: ['Tecido Linho Natural', 'Tecido Veludo', 'Tecido Bouclê', 'Couro Natural', 'Chenille'],
  Puffs: ['Tecido Linho Natural', 'Tecido Veludo', 'Tecido Bouclê', 'Couro Natural'],
  'Puffs & Chaises': ['Tecido Linho Natural', 'Tecido Veludo', 'Tecido Bouclê', 'Couro Natural'],
  Chaises: ['Tecido Linho Natural', 'Tecido Veludo', 'Tecido Bouclê', 'Couro Natural'],
};
