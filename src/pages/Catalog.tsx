import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Loader2, PackageSearch, Plus, ShieldCheck } from 'lucide-react';
import { filterProductsLocally } from '../api/products';
import AmbienteSelectorBar from '../components/catalog/AmbienteSelectorBar';
import FilterSidebar from '../components/catalog/FilterSidebar';
import ProductCard from '../components/catalog/ProductCard';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import ErrorState from '../components/ui/ErrorState';
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

// Renderizar os 1300+ produtos de uma vez trava a montagem inicial e deixa o scroll pesado —
// pagina em blocos deste tamanho.
const PAGE_SIZE = 60;

/** Números de página a mostrar, com "..." quando há mais páginas do que cabe na barra. */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export default function Catalog() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedAmbiente, setSelectedAmbiente] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { openImageModal } = useImageModal();
  const { showToast } = useToast();
  const navigate = useNavigate();
  // Fonte única de verdade: o catálogo inteiro vem do contexto (já carregado uma vez),
  // filtros/ordenação são derivados na hora — assim uma edição feita no modal de produto
  // (que atualiza o contexto) aparece aqui instantaneamente, sem precisar recarregar.
  const { products: allProducts, setVendaDireta, loading, error, reload } = useProducts();
  const { header, rows, addProductToProposal } = useProposalDraft();
  const products = useMemo(() => filterProductsLocally(allProducts, filters), [allProducts, filters]);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  // Se o filtro encolher o resultado enquanto o usuário está numa página alta, volta pra última válida.
  const page = Math.min(currentPage, totalPages);
  const pageProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, page]);

  useEffect(() => {
    setSelectedAmbiente((prev) => (header.ambientes.includes(prev) ? prev : header.ambientes[header.ambientes.length - 1] ?? ''));
  }, [header.ambientes]);

  // Filtro/ordenação mudou — volta pra página 1, senão a paginação ficaria destravada
  // num ponto sem sentido pro novo resultado (ex.: filtro com só 1 página, mas na página 5).
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const rowsInSelectedAmbiente = useMemo(() => rows.filter((r) => r.ambiente === selectedAmbiente), [rows, selectedAmbiente]);
  const codesInSelectedAmbiente = useMemo(
    () => new Set(rowsInSelectedAmbiente.filter((r) => r.code.trim()).map((r) => r.code.trim().toLowerCase())),
    [rowsInSelectedAmbiente],
  );

  return (
    <div id="view-catalog" className="view active fade-in" style={{ maxWidth: 1440 }}>
      <div id="catalog-layout" className="flex">
        <FilterSidebar
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Código ou nome..."
                className="form-input"
                style={{ width: 200, fontSize: 13, padding: '6px 10px' }}
                aria-label="Buscar produto no catálogo"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
              <div id="catalog-count" style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                {products.length === 0
                  ? '0 produtos'
                  : totalPages > 1
                    ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, products.length)} de ${products.length}`
                    : `${products.length} produto${products.length !== 1 ? 's' : ''}`}
              </div>
              <div className="flex items-center" style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  aria-label="Ver em grade"
                  aria-pressed={viewMode === 'grid'}
                  title="Ver em grade"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: viewMode === 'grid' ? 'var(--gold)' : 'var(--card)',
                    color: viewMode === 'grid' ? '#fefefe' : 'var(--text-secondary)',
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
                    color: viewMode === 'list' ? '#fefefe' : 'var(--text-secondary)',
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
            </div>
          </div>
          <AmbienteSelectorBar
            ambientes={header.ambientes}
            selected={selectedAmbiente}
            onChange={setSelectedAmbiente}
            itemsInSelected={rowsInSelectedAmbiente.map((r) => r.desc || r.code)}
          />
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 className="spin" style={{ width: 28, height: 28 }} />
              <div style={{ fontSize: 14 }}>Carregando catálogo...</div>
            </div>
          ) : error ? (
            <ErrorState message="Não foi possível carregar o catálogo — verifique se o backend está no ar." onRetry={reload} />
          ) : products.length > 0 ? (
            <>
            {viewMode === 'grid' ? (
              <div id="catalog-grid" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {pageProducts.map((p) => (
                  <ProductCard key={p.id} product={p} ambiente={selectedAmbiente} alreadyInAmbiente={codesInSelectedAmbiente.has(p.id.toLowerCase())} />
                ))}
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Produto</th><th>Fornecedor</th><th>Categoria</th><th>Acabamento</th><th>Material</th><th>Preço</th><th>Venda Direta</th><th /></tr>
                    </thead>
                    <tbody>
                      {pageProducts.map((p) => (
                        <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openImageModal(p, 'info')}>
                          <td>
                            <div className="flex items-center gap-3">
                              {p.img ? (
                                <img src={p.img} alt={p.name} loading="lazy" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
                              ) : (
                                <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg)', flexShrink: 0 }} />
                              )}
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="mono text-xs" style={{ color: 'var(--gold-text)' }}>{p.id}</div>
                              </div>
                            </div>
                          </td>
                          <td>{p.supplier}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.cat || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.finish || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.material || '—'}</td>
                          <td className="mono font-semibold">{p.price ? formatCurrency(p.price) : '—'}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <ToggleSwitch
                              checked={Boolean(p.vendaDireta)}
                              onChange={(checked) => setVendaDireta(p.id, checked)}
                              onLabel="Sim"
                              offLabel="Não"
                              ariaLabel={`Venda direta: ${p.id}`}
                            />
                          </td>
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
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-5" role="navigation" aria-label="Paginação do catálogo">
                <button
                  className="btn btn-outline btn-sm"
                  aria-label="Página anterior"
                  disabled={page === 1}
                  onClick={() => setCurrentPage(page - 1)}
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                </button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--text-secondary)', fontSize: 13 }}>···</span>
                  ) : (
                    <button
                      key={p}
                      className="btn btn-sm"
                      aria-label={`Página ${p}`}
                      aria-current={p === page ? 'page' : undefined}
                      style={{
                        minWidth: 32,
                        background: p === page ? 'var(--gold)' : 'var(--card)',
                        color: p === page ? '#fefefe' : 'var(--text-secondary)',
                        border: p === page ? 'none' : '1.5px solid var(--border)',
                        fontWeight: 600,
                      }}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  className="btn btn-outline btn-sm"
                  aria-label="Próxima página"
                  disabled={page === totalPages}
                  onClick={() => setCurrentPage(page + 1)}
                >
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
            </>
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
