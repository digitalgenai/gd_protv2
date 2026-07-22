import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCatalogFacets, fetchProducts } from '../api/products';
import { useAuth } from './AuthContext';
import type { Product } from '../types';

type CatalogFacets = Awaited<ReturnType<typeof fetchCatalogFacets>>;

const EMPTY_FACETS: CatalogFacets = { categories: [], suppliers: [], finishes: [], materials: [] };

/** vendaDireta é front-only (sem coluna própria no banco ainda) — overrides por produto ficam salvos aqui. */
const VENDA_DIRETA_KEY = 'galpao:produtos:venda-direta';

function loadVendaDiretaOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(VENDA_DIRETA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

interface ProductsContextValue {
  products: Product[];
  facets: CatalogFacets;
  loading: boolean;
  /** true quando o carregamento do catálogo real falhou (backend fora do ar ou erro real). */
  error: boolean;
  /** Tenta buscar o catálogo real de novo. */
  reload: () => void;
  /** Atualização otimista em memória — reflete na hora em toda a app sem esperar um refetch. */
  updateProductLocally: (id: string, patch: Partial<Product>) => void;
  /** Marca/desmarca um produto como elegível para venda direta — front-only, persiste no navegador. */
  setVendaDireta: (id: string, value: boolean) => void;
}

const ProductsContext = createContext<ProductsContextValue>({
  products: [],
  facets: EMPTY_FACETS,
  loading: true,
  error: false,
  reload: () => {},
  updateProductLocally: () => {},
  setVendaDireta: () => {},
});

/** Catálogo completo — usado pela busca global, parser de voz e geração de PDF. */
export function ProductsProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<CatalogFacets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Só busca quando há usuário logado — e refaz a busca quando o login muda (usuario?.id na
  // dependência). Antes, o fetch disparava no mount (ainda na tela de login, sem sessão), tomava
  // 401 e nunca mais tentava — por isso o catálogo/busca/PDF só "acordavam" depois de um reload
  // manual. Agora tudo o que o sistema precisa carrega automaticamente no login do usuário.
  useEffect(() => {
    if (!usuario) {
      setProducts([]);
      setFacets(EMPTY_FACETS);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all([fetchProducts({}), fetchCatalogFacets()])
      .then(([productsData, facetsData]) => {
        if (!active) return;
        const overrides = loadVendaDiretaOverrides();
        setProducts(productsData.map((p) => (p.id in overrides ? { ...p, vendaDireta: overrides[p.id] } : p)));
        setFacets(facetsData);
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

  const updateProductLocally = (id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const setVendaDireta = (id: string, value: boolean) => {
    updateProductLocally(id, { vendaDireta: value });
    const overrides = loadVendaDiretaOverrides();
    overrides[id] = value;
    localStorage.setItem(VENDA_DIRETA_KEY, JSON.stringify(overrides));
  };

  // Contagem de categorias recalculada a partir do catálogo em memória — assim uma edição de
  // categoria feita agora mesmo (ex.: no modal de produto) já aparece somada no filtro lateral,
  // sem esperar um refetch do backend.
  const liveFacets = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      if (p.cat) counts.set(p.cat, (counts.get(p.cat) ?? 0) + 1);
    });
    return { ...facets, categories: Array.from(counts, ([value, count]) => ({ value, count })) };
  }, [products, facets]);

  return (
    <ProductsContext.Provider value={{ products, facets: liveFacets, loading, error, reload, updateProductLocally, setVendaDireta }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  return useContext(ProductsContext);
}
