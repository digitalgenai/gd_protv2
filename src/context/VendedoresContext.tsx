import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchVendedores } from '../api/vendedores';
import { useAuth } from './AuthContext';
import type { VendedorSummary } from '../api/vendedores';

interface VendedoresContextValue {
  vendedores: VendedorSummary[];
  loading: boolean;
  error: boolean;
  reload: () => void;
}

const VendedoresContext = createContext<VendedoresContextValue>({
  vendedores: [],
  loading: true,
  error: false,
  reload: () => {},
});

/** Lista de vendedores reais (usuários ativos) — usada nos dropdowns de Nova Proposta/Voz e na exibição do documento. */
export function VendedoresProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [vendedores, setVendedores] = useState<VendedorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Só busca com usuário logado; refaz no login (ver ProductsContext pro porquê detalhado).
  useEffect(() => {
    if (!usuario) {
      setVendedores([]);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    fetchVendedores()
      .then((data) => {
        if (!active) return;
        setVendedores(data);
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
    <VendedoresContext.Provider value={{ vendedores, loading, error, reload }}>
      {children}
    </VendedoresContext.Provider>
  );
}

export function useVendedores() {
  return useContext(VendedoresContext);
}
