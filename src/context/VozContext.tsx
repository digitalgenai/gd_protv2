import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchRascunhos } from '../api/voice';
import { useAuth } from './AuthContext';
import type { RascunhoVoz } from '../types';

interface VozContextValue {
  rascunhos: RascunhoVoz[];
  loading: boolean;
  error: boolean;
  reload: () => void;
}

const VozContext = createContext<VozContextValue>({
  rascunhos: [],
  loading: true,
  error: false,
  reload: () => {},
});

/** Rascunhos de voz reais (tabela `proposta_rascunhos`, aguardando revisão) — compartilhado
 * entre a tela de Rascunhos de Voz, o badge da sidebar e o card do Dashboard. */
export function VozProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [rascunhos, setRascunhos] = useState<RascunhoVoz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Só busca com usuário logado; refaz no login (ver ProductsContext pro porquê detalhado).
  useEffect(() => {
    if (!usuario) {
      setRascunhos([]);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    fetchRascunhos()
      .then((data) => {
        if (!active) return;
        setRascunhos(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey, usuario?.id]);

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <VozContext.Provider value={{ rascunhos, loading, error, reload }}>
      {children}
    </VozContext.Provider>
  );
}

export function useVoz() {
  return useContext(VozContext);
}
