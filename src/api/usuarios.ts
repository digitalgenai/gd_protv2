import { apiFetch } from './client';

export type PerfilUsuario = 'Administrador' | 'Supervisor' | 'Vendedor';

export interface Usuario {
  id: string;
  nome: string;
  codigoVendedor: number | null;
  email: string;
  perfil: PerfilUsuario;
  setor: string;
  isActive: boolean;
}

export interface CreateUsuarioPayload {
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
  setor?: string;
}

/** RF-044: gestão real de usuários (tabela `usuarios`). Sem fallback mockado. */
export function fetchUsuarios(): Promise<Usuario[]> {
  return apiFetch<Usuario[]>('/usuarios');
}

export function createUsuario(payload: CreateUsuarioPayload): Promise<Usuario> {
  return apiFetch<Usuario>('/usuarios', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function setUsuarioAtivo(id: string, isActive: boolean): Promise<Usuario> {
  return apiFetch<Usuario>(`/usuarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function setUsuarioPerfil(id: string, perfil: PerfilUsuario): Promise<Usuario> {
  return apiFetch<Usuario>(`/usuarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ perfil }),
  });
}

/** Reset de senha pelo administrador — não exige a senha atual do usuário (diferente da troca
 * de senha em Perfil.tsx, que é o próprio usuário trocando a sua). */
export function resetSenhaUsuario(id: string, novaSenha: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/usuarios/${id}/senha`, {
    method: 'PATCH',
    body: JSON.stringify({ novaSenha }),
  });
}
