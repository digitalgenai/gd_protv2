import { apiFetch } from './client';

export interface ProductImage {
  id: number;
  url: string;
  posicao: number;
}

/**
 * RF-019 a RF-027: upload/exclusão de imagens. Sem fallback mock de propósito — sem
 * o backend real ativo, a imagem simplesmente não persiste (era exatamente o bug
 * "não salva quando eu coloco imagens" que motivou este backend existir). Erros de
 * validação (formato/tamanho/resolução) chegam como ApiError com a mensagem real do
 * backend; quem chama deve mostrar isso ao usuário, não mascarar com mock.
 */
export async function uploadProductImage(codigo: string, file: File): Promise<ProductImage> {
  const form = new FormData();
  form.append('imagem', file);
  return apiFetch<ProductImage>(`/produtos/${encodeURIComponent(codigo)}/imagens`, {
    method: 'POST',
    body: form,
  });
}

export async function deleteProductImage(codigo: string, imageId: number): Promise<void> {
  await apiFetch<void>(`/produtos/${encodeURIComponent(codigo)}/imagens/${imageId}`, { method: 'DELETE' });
}

/** RN-004/RBD-009: move uma imagem para outra posição (1-3) — usado para tornar uma imagem a "Principal". */
export async function reorderProductImage(codigo: string, imageId: number, posicao: number): Promise<ProductImage[]> {
  return apiFetch<ProductImage[]>(`/produtos/${encodeURIComponent(codigo)}/imagens/${imageId}/posicao`, {
    method: 'PATCH',
    body: JSON.stringify({ posicao }),
  });
}
