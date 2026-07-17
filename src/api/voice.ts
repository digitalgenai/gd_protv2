import { apiFetch } from './client';
import type { ParsedVoiceResult, Product, RascunhoVoz } from '../types';

interface TranscricaoItemResponse {
  descricaoOriginal: string;
  quantidade: number;
  desconto: number;
  ambiente: string | null;
  produto: Product | null;
}

interface TranscricaoResponse {
  transcricao: string;
  semFalaDetectada: boolean;
  cliente: string | null;
  telefoneCliente: string | null;
  emailCliente: string | null;
  enderecoCliente: string | null;
  arquiteto: string | null;
  descontoGlobal: number;
  itens: TranscricaoItemResponse[];
}

/** Extensão do arquivo precisa bater com o formato real gravado pelo navegador (varia por
 * browser: Chrome grava webm/opus, Safari grava mp4/aac) — mandar tudo como ".webm" faz o
 * Whisper tentar decodificar um contêiner errado e a transcrição sai ruim/incompreensível. */
function extensaoPorMimeType(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

/** Grava-se áudio de verdade (MediaRecorder) em vez de usar a Web Speech API do navegador —
 * o backend manda pro Whisper (transcrição) e pro GPT (extração de cliente/arquiteto/desconto/
 * itens), casando cada item com um produto real do catálogo por similaridade de texto
 * (pg_trgm — não usa embedding/pgvector, que ainda não está disponível no banco). */
export async function transcreverAudio(blob: Blob): Promise<{ transcricao: string; parsed: ParsedVoiceResult }> {
  const form = new FormData();
  form.append('audio', blob, `gravacao.${extensaoPorMimeType(blob.type)}`);
  const data = await apiFetch<TranscricaoResponse>('/voz/transcrever', {
    method: 'POST',
    body: form,
    timeoutMs: 45000, // Whisper + GPT nessa ordem podem levar bem mais que o timeout padrão de 15s
  });

  if (data.semFalaDetectada) {
    throw new Error('Não identificamos fala nesse áudio — tente gravar de novo, falando mais perto do microfone.');
  }

  const parsed: ParsedVoiceResult = {
    client: data.cliente,
    clientPhone: data.telefoneCliente,
    clientEmail: data.emailCliente,
    clientAddress: data.enderecoCliente,
    architect: data.arquiteto,
    discount: data.descontoGlobal || 0,
    items: data.itens
      .filter((i): i is TranscricaoItemResponse & { produto: Product } => Boolean(i.produto))
      .map((i) => ({ product: i.produto, qty: i.quantidade, ambiente: i.ambiente })),
    notFound: data.itens
      .filter((i) => !i.produto)
      .map((i) => ({ phrase: i.descricaoOriginal, suggestion: null })),
  };
  return { transcricao: data.transcricao, parsed };
}

/** RF-059: rascunhos pendentes de revisão gerados por um webhook externo de voz (ainda não
 * implementado) — lista real, costuma vir vazia até esse webhook existir. Sem fallback mockado. */
export function fetchRascunhos(): Promise<RascunhoVoz[]> {
  return apiFetch<RascunhoVoz[]>('/rascunhos');
}

/** RF-061: marca um rascunho como confirmado (virou proposta) ou descartado. */
export function updateRascunhoStatus(id: number, status: 'confirmado' | 'descartado'): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/rascunhos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
