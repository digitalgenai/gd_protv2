import { X } from 'lucide-react';
import { useProducts } from '../../context/ProductsContext';
import { CATALOG_CATEGORIES } from '../../data/categories';
import type { FilterState } from '../../types';

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FilterSidebar({ filters, onChange, onClear, mobileOpen, onCloseMobile }: FilterSidebarProps) {
  const { facets } = useProducts();
  return (
    <aside
      id="catalog-filter-sidebar"
      className={`w-56 flex-shrink-0 bg-white border-r p-4 overflow-y-auto${mobileOpen ? ' mobile-open' : ''}`}
      style={{ borderColor: 'var(--border)', minHeight: 'calc(100vh - 57px)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Filtros</span>
        <div className="flex items-center gap-2">
          <button className="text-xs" style={{ color: 'var(--gold)', fontWeight: 600 }} onClick={onClear}>Limpar</button>
          <button
            id="btn-close-filter-mobile"
            style={{ display: mobileOpen ? 'flex' : 'none', width: 28, height: 28, border: 'none', background: 'var(--border)', borderRadius: 6, cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}
            onClick={onCloseMobile}
          >
            <X style={{ width: 14, height: 14, color: 'var(--primary)' }} />
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Código ou nome..."
          className="form-input"
          style={{ fontSize: 13, paddingTop: 6, paddingBottom: 6, paddingLeft: 32 }}
          aria-label="Buscar produto no catálogo"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <div className="filter-label">Categoria</div>
        {CATALOG_CATEGORIES.map((c) => {
          const count = facets.categories.find((fc) => fc.value === c)?.count ?? 0;
          return (
            <label key={c} className="filter-option">
              <input
                type="checkbox"
                checked={filters.categories.includes(c)}
                onChange={() => onChange({ categories: toggleValue(filters.categories, c) })}
              />
              {c} <span className="ml-auto text-xs" style={{ color: 'var(--text-secondary)' }}>{count}</span>
            </label>
          );
        })}
      </div>

      <div className="filter-group">
        <div className="filter-label">Fornecedor</div>
        {facets.suppliers.map((s) => (
          <label key={s} className="filter-option">
            <input type="checkbox" checked={filters.suppliers.includes(s)} onChange={() => onChange({ suppliers: toggleValue(filters.suppliers, s) })} />
            {s}
          </label>
        ))}
      </div>

      <div className="filter-group">
        <div className="filter-label">Acabamento</div>
        {facets.finishes.map((f) => (
          <label key={f} className="filter-option">
            <input type="checkbox" checked={filters.finishes.includes(f)} onChange={() => onChange({ finishes: toggleValue(filters.finishes, f) })} />
            {f}
          </label>
        ))}
      </div>

      <div className="filter-group">
        <div className="filter-label">Faixa de Preço</div>
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
      </div>
    </aside>
  );
}
