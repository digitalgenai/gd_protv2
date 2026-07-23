import { apiFetch, ApiError } from './client';
import type { PerfilUsuario } from './usuarios';

export interface AuthUser {
  id: string;
  nome: string;
  codigoVendedor: number | null;
  email: string;
  perfil: PerfilUsuario;
  setor: string;
  isActive: boolean;
}

/** Sessão via cookie assinado (httpOnly) — nunca lê/guarda senha no front. */
export function login(email: string, senha: string): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}

/** 401 = sem sessão ativa (não é erro de rede) — quem chama trata como "não logado". */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>('/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export function updateMe(patch: { nome: string; email: string; setor?: string }): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function changePassword(senhaAtual: string, novaSenha: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ senhaAtual, novaSenha }),
  });
}
