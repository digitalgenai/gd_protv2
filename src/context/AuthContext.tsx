import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { changePassword as apiChangePassword, fetchMe, login as apiLogin, logout as apiLogout, updateMe, type AuthUser } from '../api/auth';

/** fotoUrl é front-only (sem coluna própria no banco ainda) — fica só no navegador, por usuário. */
const FOTO_KEY_PREFIX = 'galpao:perfil:foto:';

function loadFoto(userId: string): string | undefined {
  try {
    return localStorage.getItem(FOTO_KEY_PREFIX + userId) || undefined;
  } catch {
    return undefined;
  }
}

function saveFoto(userId: string, url: string | undefined) {
  try {
    if (url) localStorage.setItem(FOTO_KEY_PREFIX + userId, url);
    else localStorage.removeItem(FOTO_KEY_PREFIX + userId);
  } catch {
    // localStorage indisponível (modo privado etc.) — sem problema, só a foto não persiste.
  }
}

export interface AuthUsuario extends AuthUser {
  fotoUrl?: string;
}

type LoginResult = { ok: true } | { ok: false; erro: string };

interface AuthContextValue {
  usuario: AuthUsuario | null;
  /** true enquanto restaura a sessão ao carregar a página — evita redirecionar pro login antes de saber. */
  loading: boolean;
  login: (email: string, senha: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updatePerfil: (patch: { nome: string; email: string; setor?: string }) => Promise<LoginResult>;
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<LoginResult>;
  updateFotoUrl: (url: string | undefined) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function withFoto(user: AuthUser): AuthUsuario {
  return { ...user, fotoUrl: loadFoto(user.id) };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<AuthUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then((user) => setUsuario(user ? withFoto(user) : null))
      .catch(() => setUsuario(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, senha: string): Promise<LoginResult> {
    try {
      const user = await apiLogin(email, senha);
      setUsuario(withFoto(user));
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: errorMessage(err, 'Não foi possível entrar — backend indisponível.') };
    }
  }

  async function logout(): Promise<void> {
    try {
      await apiLogout();
    } catch {
      // segue mesmo se a chamada falhar — limpa a sessão local de qualquer forma.
    }
    setUsuario(null);
  }

  async function updatePerfil(patch: { nome: string; email: string; setor?: string }): Promise<LoginResult> {
    try {
      const user = await updateMe(patch);
      setUsuario((prev) => ({ ...withFoto(user), fotoUrl: prev?.fotoUrl }));
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: errorMessage(err, 'Não foi possível salvar o perfil.') };
    }
  }

  async function changePassword(senhaAtual: string, novaSenha: string): Promise<LoginResult> {
    try {
      await apiChangePassword(senhaAtual, novaSenha);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: errorMessage(err, 'Não foi possível trocar a senha.') };
    }
  }

  function updateFotoUrl(url: string | undefined) {
    setUsuario((prev) => {
      if (!prev) return prev;
      saveFoto(prev.id, url);
      return { ...prev, fotoUrl: url };
    });
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, updatePerfil, changePassword, updateFotoUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
