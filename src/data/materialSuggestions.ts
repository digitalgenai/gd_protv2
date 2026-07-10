/**
 * Sugestões de materiais de outros fornecedores por categoria de produto (RF relacionado a
 * "materiais de outros fornecedores" nos itens da proposta) — ex.: estofados sugerem tecidos,
 * cadeiras/mesas sugerem madeiras, armários sugerem puxadores/acabamentos. Dado ilustrativo
 * enquanto não existe um catálogo real de materiais complementares por fornecedor.
 */
export const MATERIAL_SUGGESTIONS_BY_CATEGORY: Record<string, string[]> = {
  Sofás: [
    'Tecido Linho Natural',
    'Tecido Veludo Verde-Musgo',
    'Tecido Bouclê Off-White',
    'Couro Ecológico Caramelo',
    'Chenille Cinza',
  ],
  Cadeiras: [
    'Estofado em Veludo',
    'Estofado em Couro',
    'Madeira Freijó',
    'Madeira Carvalho Natural',
    'Palhinha Natural',
  ],
  Mesas: [
    'Tampo em Mármore Carrara',
    'Tampo em Vidro Temperado',
    'Base em Madeira Freijó',
    'Base em Aço Inox',
  ],
  Armários: [
    'Puxador em Latão',
    'Puxador Preto Fosco',
    'Porta em Vidro Fumê',
    'Acabamento Laqueado Branco',
  ],
  Iluminação: [
    'Cúpula em Linho',
    'Estrutura em Latão Envelhecido',
    'Lâmpada LED Branco Quente 3000K',
  ],
  Acessórios: [
    'Acabamento Personalizado',
    'Cor Personalizada',
  ],
};
