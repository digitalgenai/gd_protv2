/** Iniciais (primeiro + último nome) para exibir em avatares, ex.: "Ranyer Paiva" → "RP". */
export function initials(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

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

/**
 * Máscara de telefone BR conforme o usuário digita — só aceita dígitos, formata
 * progressivamente e distingue fixo (10 dígitos, "(11) 3456-7890") de celular
 * (11 dígitos, "(11) 98765-4321") pela quantidade de números.
 */
export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  const len = digits.length;
  if (len === 0) return '';
  if (len <= 2) return `(${digits}`;
  if (len <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
