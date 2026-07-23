import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProducts } from '../../context/ProductsContext';
import type { FilterState } from '../../types';

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Grupo de filtro recolhível — a Categoria vem fechada por padrão (é a lista mais longa,
 * ~30 itens); os demais vêm abertos, já que são curtos o bastante pra não pesar na tela. */
function FilterGroup({ label, defaultOpen = true, children }: { label: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="filter-group">
      <button type="button" className="filter-group-header" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="filter-label" style={{ marginBottom: 0 }}>{label}</span>
        <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
      </button>
      {open && <div className="filter-group-body">{children}</div>}
    </div>
  );
}

export default function FilterSidebar({ filters, onChange, onClear }: FilterSidebarProps) {
  const { facets, products } = useProducts();
  const [collapsed, setCollapsed] = useState(false);

  // Em telas estreitas o filtro fica sempre visível, empilhado (decisão explícita — ver
  // commit anterior) — o recolher/expandir é só um recurso de desktop, pra devolver espaço
  // horizontal pra tabela quando não está filtrando.
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    setIsNarrowViewport(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrowViewport(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const effectivelyCollapsed = collapsed && !isNarrowViewport;

  // Acabamento depende do(s) fornecedor(es) marcado(s): sem nenhum marcado, mostra todos os
  // acabamentos do catálogo; com um ou mais marcados, só os que existem em produtos daqueles
  // fornecedores — calculado em memória a partir do catálogo já carregado, sem round-trip.
  const availableFinishes = useMemo(() => {
    const relevantes = filters.suppliers.length
      ? products.filter((p) => filters.suppliers.includes(p.supplier))
      : products;
    return Array.from(new Set(relevantes.map((p) => p.finish).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [products, filters.suppliers]);

  // Se trocar o fornecedor faz um acabamento já marcado sumir da lista, remove ele do filtro
  // ativo também — evita deixar um filtro aplicado que não aparece mais na tela pra desmarcar.
  useEffect(() => {
    const semAcabamentosOrfaos = filters.finishes.filter((f) => availableFinishes.includes(f));
    if (semAcabamentosOrfaos.length !== filters.finishes.length) {
      onChange({ finishes: semAcabamentosOrfaos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableFinishes]);

  if (effectivelyCollapsed) {
    return (
      <button
        type="button"
        className="filter-sidebar-rail"
        onClick={() => setCollapsed(false)}
        aria-label="Mostrar filtros"
        title="Mostrar filtros"
      >
        <ChevronRight style={{ width: 16, height: 16 }} />
      </button>
    );
  }

  return (
    <aside
      id="catalog-filter-sidebar"
      className="w-56 flex-shrink-0 bg-white border-r p-4 overflow-y-auto"
      style={{ borderColor: 'var(--border)', minHeight: 'calc(100vh - 57px)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Filtros</span>
        <div className="flex items-center gap-2">
          <button className="text-xs" style={{ color: 'var(--gold-text)', fontWeight: 600 }} onClick={onClear}>Limpar</button>
          {!isNarrowViewport && (
            <button
              type="button"
              className="filter-sidebar-collapse-btn"
              onClick={() => setCollapsed(true)}
              aria-label="Esconder filtros"
              title="Esconder filtros"
            >
              <ChevronLeft style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      <FilterGroup label="Categoria" defaultOpen={false}>
        {facets.categories.map(({ value: c, count }) => (
          <label key={c} className="filter-option">
            <input
              type="checkbox"
              checked={filters.categories.includes(c)}
              onChange={() => onChange({ categories: toggleValue(filters.categories, c) })}
            />
            {c} <span className="ml-auto text-xs" style={{ color: 'var(--text-secondary)' }}>{count}</span>
          </label>
        ))}
      </FilterGroup>

      <FilterGroup label="Fornecedor">
        {facets.suppliers.map((s) => (
          <label key={s} className="filter-option">
            <input type="checkbox" checked={filters.suppliers.includes(s)} onChange={() => onChange({ suppliers: toggleValue(filters.suppliers, s) })} />
            {s}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup label="Acabamento">
        {availableFinishes.map((f) => (
          <label key={f} className="filter-option">
            <input type="checkbox" checked={filters.finishes.includes(f)} onChange={() => onChange({ finishes: toggleValue(filters.finishes, f) })} />
            {f}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup label="Faixa de Preço">
        {([
          ['all', 'Todos'],
          ['0-3000', 'Até R$ 3.000'],
          ['3000-8000', 'R$ 3k – R$ 8k'],
          ['8000+', 'Acima de R$ 8k'],
        ] as const).map(([value, label]) => (
          <label key={value} className="filter-option">
            <input type="radio" name="price" checked={filters.priceRange === value} onChange={() => onChange({ priceRange: value })} />
            {label}
          </label>
        ))}
      </FilterGroup>
    </aside>
  );
}
