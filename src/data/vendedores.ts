export interface VendedorOption {
  value: string;
  label: string;
}

export const VENDEDOR_OPTIONS: VendedorOption[] = [
  { value: 'MES', label: 'Marcos E. Silva (MES)' },
  { value: 'CAR', label: 'Carolina A. Rocha (CAR)' },
  { value: 'ROD', label: 'Rodrigo Santos (ROD)' },
  { value: 'ANA', label: 'Ana Paula Melo (ANA)' },
];

export const VENDEDOR_LABELS: Record<string, string> = Object.fromEntries(
  VENDEDOR_OPTIONS.map((v) => [v.value, v.label]),
);

/** Código do vendedor (ex.: "MES") → rótulo completo, ou "—" se vazio. */
export function vendedorLabel(code: string): string {
  return code ? VENDEDOR_LABELS[code] || code : '—';
}

/**
 * Nome curto exibido nas listagens mock (`ProposalSummary.vendedor`, ex.: "Marcos E.") → código
 * do vendedor. Usado só ao carregar um histórico mock de volta no rascunho ("Editar como nova
 * versão"), já que o formulário de Nova Proposta trabalha com código, não nome de exibição.
 */
export const VENDEDOR_CODE_BY_DISPLAY_NAME: Record<string, string> = {
  'Marcos E.': 'MES',
  'Carolina R.': 'CAR',
  'Rodrigo S.': 'ROD',
  'Ana Paula M.': 'ANA',
};
