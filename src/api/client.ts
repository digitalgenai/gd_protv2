const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/** Backend inalcançável (offline, rede caiu, timeout) — quem chama cai no mock local. */
export class ApiUnavailableError extends Error {}

/** Backend respondeu, mas com erro real (validação, 404, 500...) — não é caso de cair no
 * mock (isso esconderia o erro real do usuário); quem chama deve tratar/mostrar a mensagem. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Wrapper fino sobre fetch para os endpoints REST descritos em requirements_v2.md.
 * Backend fora do ar (rede caiu, timeout) vira ApiUnavailableError; um erro real do
 * backend ativo (400/404/500) vira ApiError — quem chama trata cada caso e mostra
 * um estado de erro/retry, nunca cai em dado mockado.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // 1012 produtos reais com joins de fornecedor/customização/imagens já passam de 2s sozinhos;
  // 4s estourava fácil sob concorrência (várias telas buscando ao mesmo tempo).
  const { timeoutMs = 15000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    // FormData define o próprio Content-Type (multipart com boundary) — não sobrescrever.
    const isFormData = init.body instanceof FormData;
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'include', // manda/recebe o cookie de sessão do login (porta diferente do front)
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch (err) {
    throw new ApiUnavailableError(`Falha ao acessar ${path}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `API respondeu ${res.status} em ${path}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // corpo não é JSON — mantém a mensagem genérica.
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
