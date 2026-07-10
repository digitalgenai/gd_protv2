import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCatalogFacets, fetchProducts } from '../api/products';
import type { Product } from '../types';

type CatalogFacets = Awaited<ReturnType<typeof fetchCatalogFacets>>;

const EMPTY_FACETS: CatalogFacets = { categories: [], suppliers: [], finishes: [] };

interface ProductsContextValue {
  products: Product[];
  facets: CatalogFacets;
  loading: boolean;
  /** Atualização otimista em memória — reflete na hora em toda a app sem esperar um refetch. */
  updateProductLocally: (id: string, patch: Partial<Product>) => void;
}

const ProductsContext = createContext<ProductsContextValue>({
  products: [],
  facets: EMPTY_FACETS,
  loading: true,
  updateProductLocally: () => {},
});

/** Catálogo completo — usado pela busca global, parser de voz e geração de PDF. */
export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<CatalogFacets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchProducts({}), fetchCatalogFacets()]).then(([productsData, facetsData]) => {
      if (active) {
        setProducts(productsData);
        setFacets(facetsData);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const updateProductLocally = (id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
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

  return <ProductsContext.Provider value={{ products, facets: liveFacets, loading, updateProductLocally }}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  return useContext(ProductsContext);
}
