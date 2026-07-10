import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, LayoutGrid, List, PackageSearch, Plus, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { filterProductsLocally } from '../api/products';
import AmbienteSelectorBar from '../components/catalog/AmbienteSelectorBar';
import FilterSidebar from '../components/catalog/FilterSidebar';
import ProductCard from '../components/catalog/ProductCard';
import { useImageModal } from '../context/ImageModalContext';
import { useProducts } from '../context/ProductsContext';
import { useProposalDraft } from '../context/ProposalDraftContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import type { FilterState } from '../types';

type ViewMode = 'grid' | 'list';

const DEFAULT_FILTERS: FilterState = {
  search: '',
  categories: [],
  suppliers: [],
  finishes: [],
  priceRange: 'all',
  sort: 'relevance',
};

export default function Catalog() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [selectedAmbiente, setSelectedAmbiente] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { openImageModal } = useImageModal();
  const { showToast } = useToast();
  const navigate = useNavigate();
  // Fonte única de verdade: o catálogo inteiro vem do contexto (já carregado uma vez),
  // filtros/ordenação são derivados na hora — assim uma edição feita no modal de produto
  // (que atualiza o contexto) aparece aqui instantaneamente, sem precisar recarregar.
  const { products: allProducts } = useProducts();
  const { header, rows, addProductToProposal } = useProposalDraft();
  const products = useMemo(() => filterProductsLocally(allProducts, filters), [allProducts, filters]);

  useEffect(() => {
    setSelectedAmbiente((prev) => (header.ambientes.includes(prev) ? prev : header.ambientes[header.ambientes.length - 1] ?? ''));
  }, [header.ambientes]);

  const rowsInSelectedAmbiente = useMemo(() => rows.filter((r) => r.ambiente === selectedAmbiente), [rows, selectedAmbiente]);
  const codesInSelectedAmbiente = useMemo(
    () => new Set(rowsInSelectedAmbiente.filter((r) => r.code.trim()).map((r) => r.code.trim().toLowerCase())),
    [rowsInSelectedAmbiente],
  );

  return (
    <div id="view-catalog" className="view active fade-in" style={{ maxWidth: 1440 }}>
      <div className="flex">
        <FilterSidebar
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onClear={() => setFilters(DEFAULT_FILTERS)}
          mobileOpen={mobileFilterOpen}
          onCloseMobile={() => setMobileFilterOpen(false)}
        />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                id="btn-filter-mobile"
                style={{ display: 'none', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}
                onClick={() => setMobileFilterOpen(true)}
              >
                <SlidersHorizontal style={{ width: 14, height: 14 }} /> Filtros
              </button>
              <div id="catalog-count" style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                {products.length} produto{products.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center" style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  aria-label="Ver em grade"
                  aria-pressed={viewMode === 'grid'}
                  title="Ver em grade"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: viewMode === 'grid' ? 'var(--gold)' : 'var(--card)',
                    color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
                  }}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid style={{ width: 13, height: 13 }} /> Grade
                </button>
                <button
                  aria-label="Ver em lista"
                  aria-pressed={viewMode === 'list'}
                  title="Ver em lista"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: viewMode === 'list' ? 'var(--gold)' : 'var(--card)',
                    color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                  }}
                  onClick={() => setViewMode('list')}
                >
                  <List style={{ width: 13, height: 13 }} /> Lista
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                id="catalog-sort"
                className="form-input"
                style={{ width: 'auto', fontSize: 13, padding: '6px 28px 6px 10px' }}
                aria-label="Ordenar catálogo"
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as FilterState['sort'] }))}
              >
                <option value="relevance">Ordem: Relevância</option>
                <option value="price-asc">Menor Preço</option>
                <option value="price-desc">Maior Preço</option>
                <option value="name-asc">Nome A-Z</option>
              </select>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/catalogo/qualidade')}>
                <ShieldCheck style={{ width: 13, height: 13 }} /> Qualidade do Catálogo
              </button>
              <button
                className="btn btn-primary btn-sm"
                id="btn-import-produto"
                onClick={() => {
                  const p = allProducts.find((prod) => prod.id === 'GD-CAD-001') || allProducts[0];
                  if (p) openImageModal(p, 'imagens');
                }}
              >
                <CloudUpload style={{ width: 13, height: 13 }} /> Importar Produto
              </button>
            </div>
          </div>
          <AmbienteSelectorBar
            ambientes={header.ambientes}
            selected={selectedAmbiente}
            onChange={setSelectedAmbiente}
            itemsInSelected={rowsInSelectedAmbiente.map((r) => r.desc || r.code)}
          />
          {products.length > 0 ? (
            viewMode === 'grid' ? (
              <div id="catalog-grid" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} ambiente={selectedAmbiente} alreadyInAmbiente={codesInSelectedAmbiente.has(p.id.toLowerCase())} />
                ))}
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Produto</th><th>Fornecedor</th><th>Categoria</th><th>Acabamento</th><th>Preço</th><th /></tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openImageModal(p, 'info')}>
                          <td>
                            <div className="flex items-center gap-3">
                              {p.img ? (
                                <img src={p.img} alt={p.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg)', flexShrink: 0 }} />
                              )}
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="mono text-xs" style={{ color: 'var(--gold)' }}>{p.id}</div>
                              </div>
                            </div>
                          </td>
                          <td>{p.supplier}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.cat || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.finish || '—'}</td>
                          <td className="mono font-semibold">{p.price ? formatCurrency(p.price) : '—'}</td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              aria-label={`Adicionar ${p.name} à proposta`}
                              onClick={(e) => {
                                e.stopPropagation();
                                addProductToProposal(p, selectedAmbiente);
                                showToast(
                                  selectedAmbiente ? `"${p.name}" adicionado ao ambiente "${selectedAmbiente}".` : `"${p.name}" adicionado à proposta.`,
                                  'success',
                                );
                              }}
                            >
                              <Plus style={{ width: 12, height: 12 }} /> Proposta
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
              <PackageSearch style={{ width: 40, height: 40, opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>Nenhum produto encontrado com esses filtros.</div>
              <button className="btn btn-outline btn-sm mt-1" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
