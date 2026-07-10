export function formatCurrency(n: number): string {
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrencyRounded(n: number): string {
  return 'R$ ' + Math.round(Number(n)).toLocaleString('pt-BR');
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Converte texto de input numérico com limites; NaN vira o mínimo. */
export function parseClamped(raw: string, min: number, max: number): number {
  const n = parseFloat(raw);
  return Number.isNaN(n) ? min : clamp(n, min, max);
}
