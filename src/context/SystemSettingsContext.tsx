import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchCatalogSystemSettings, updateCatalogSystemSettings } from '../api/systemSettings';
import { useAuth } from './AuthContext';

interface SystemSettingsContextValue {
  sellersCanManageCatalog: boolean;
  loading: boolean;
  saveSellersCanManageCatalog: (enabled: boolean) => Promise<void>;
}

const SystemSettingsContext = createContext<SystemSettingsContextValue | null>(null);

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [sellersCanManageCatalog, setSellersCanManageCatalog] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario) {
      setSellersCanManageCatalog(true);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchCatalogSystemSettings()
      .then((settings) => {
        if (active) setSellersCanManageCatalog(settings.vendedoresPodemCadastrarProdutos);
      })
      .catch(() => {
        if (active) setSellersCanManageCatalog(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [usuario?.id]);

  async function saveSellersCanManageCatalog(enabled: boolean) {
    const settings = await updateCatalogSystemSettings(enabled);
    setSellersCanManageCatalog(settings.vendedoresPodemCadastrarProdutos);
  }

  return (
    <SystemSettingsContext.Provider value={{ sellersCanManageCatalog, loading, saveSellersCanManageCatalog }}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (!context) throw new Error('useSystemSettings deve ser usado dentro de SystemSettingsProvider');
  return context;
}
