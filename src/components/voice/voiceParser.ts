import type { ParsedVoiceResult, Product } from '../../types';

const DIGITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15,
  vinte: 20, trinta: 30,
};

/** Substantivos de móveis usados para detectar itens citados na fala que não bateram com nenhum produto do catálogo. */
const FURNITURE_NOUNS = [
  'cadeira', 'cadeiras', 'mesa', 'mesas', 'sofa', 'sofas', 'poltrona', 'poltronas',
  'luminaria', 'luminarias', 'tapete', 'tapetes', 'estante', 'estantes', 'aparador', 'aparadores',
  'banco', 'bancos', 'cama', 'camas', 'rack', 'racks', 'buffet', 'espelho', 'espelhos',
  'vaso', 'vasos', 'almofada', 'almofadas', 'painel', 'paineis',
];

function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function wordToNumber(word: string): number | null {
  return DIGITS[stripDiacritics(word).toLowerCase()] ?? null;
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function productKeywords(name: string): string[] {
  return stripDiacritics(name.toLowerCase()).split(' ').filter((w) => w.length > 3);
}

/** Detecta trechos com substantivo de móvel que não bateram com nenhum item já encontrado, sugerindo o produto mais próximo por palavras em comum. */
function findUnmatchedMentions(text: string, products: Product[], foundProducts: Product[]) {
  const chunks = text.split(/,| e (?=\S)/i).map((c) => c.trim()).filter(Boolean);
  const notFound: ParsedVoiceResult['notFound'] = [];
  const seenPhrases = new Set<string>();

  chunks.forEach((rawChunk) => {
    const chunk = stripDiacritics(rawChunk.toLowerCase());
    if (!FURNITURE_NOUNS.some((noun) => chunk.split(/\s+/).includes(noun))) return;

    const alreadyFound = foundProducts.some((p) => productKeywords(p.name).some((kw) => chunk.includes(kw)));
    if (alreadyFound) return;

    const phrase = rawChunk.replace(/^(e|também|tambem)\s+/i, '').trim();
    const phraseKey = stripDiacritics(phrase.toLowerCase());
    if (!phrase || seenPhrases.has(phraseKey)) return;
    seenPhrases.add(phraseKey);

    let bestProduct: Product | null = null;
    let bestScore = 0;
    products.forEach((p) => {
      const score = productKeywords(p.name).filter((kw) => chunk.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestProduct = p;
      }
    });

    notFound.push({ phrase, suggestion: bestScore > 0 ? bestProduct : null });
  });

  return notFound;
}

/** Parser heurístico de transcrição de voz em PT-BR (produtos, cliente, arquiteto, desconto). */
export function parseVoiceText(text: string, products: Product[]): ParsedVoiceResult {
  // Remove aspas/reticências de transcrições ilustrativas truncadas (ex.: mocks) para não quebrar os regexes de extração.
  const t = stripDiacritics(text.toLowerCase()).replace(/\.{2,}/g, '').replace(/["“”]/g, '');
  const result: ParsedVoiceResult = { client: null, architect: null, discount: 0, items: [], notFound: [] };

  const cliRx = /(?:para o cliente|cliente|para\s+a\s+empresa|empresa)\s+([\w\s]+?)(?:\s*,|\s+arquiteto|\s+desconto|\s+com\s*desconto|$)/;
  const cliM = t.match(cliRx);
  if (cliM) result.client = toTitleCase(cliM[1].trim());

  const arcRx = /(?:arquiteto|arquiteta)\s+([\w\s]+?)(?:\s*,|\s+desconto|\s+produto|$)/;
  const arcM = t.match(arcRx);
  if (arcM) result.architect = toTitleCase(arcM[1].trim());

  const discRx = /desconto\s+de\s+(\d+|[\w]+)\s*(?:por\s+cento|%)?|(\d+)\s*(?:%|por\s+cento)\s+(?:de\s+)?desconto/;
  const discM = t.match(discRx);
  if (discM) {
    const raw = discM[1] || discM[2];
    result.discount = parseInt(raw, 10) || wordToNumber(raw) || 0;
  }

  products.forEach((p) => {
    const keywords = stripDiacritics(p.name.toLowerCase()).split(' ').filter((w) => w.length > 3);
    const matches = keywords.filter((kw) => t.includes(kw));
    if (matches.length < Math.min(2, keywords.length)) return;

    const prodIdx = t.indexOf(matches[0]);
    const before = t.slice(Math.max(0, prodIdx - 30), prodIdx);
    const numMatch = before.match(/(\d+)\s*$/) || before.match(/(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s*$/i);
    let qty = 1;
    if (numMatch) {
      qty = parseInt(numMatch[1], 10) || wordToNumber(numMatch[1]) || 1;
    }
    result.items.push({ product: p, qty });
  });

  result.notFound = findUnmatchedMentions(text, products, result.items.map((i) => i.product));

  return result;
}

export const VOICE_SIMULATION_PHRASES = [
  'Três cadeiras barcelona',
  ' para o cliente Studio Lima,',
  ' arquiteto Beatriz Costa,',
  ' duas mesas de jantar carrara,',
  ' desconto de dez por cento.',
];
