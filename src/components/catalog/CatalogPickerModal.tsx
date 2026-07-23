import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, PackageSearch, Plus, X } from 'lucide-react';
import { filterProductsLocally } from '../../api/products';
import { useProducts } from '../../context/ProductsContext';
import { useProposalDraft } from '../../context/ProposalDraftContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';
import AmbienteSelectorBar from './AmbienteSelectorBar';
import FilterSidebar from './FilterSidebar';
import ProductCard from './ProductCard';
import type { FilterState } from '../../types';

type ViewMode = 'grid' | 'list';

const DEFAULT_FILTERS: FilterState = {
  search: '',
  categories: [],
  suppliers: [],
  finishes: [],
  priceRange: 'all',
  sort: 'relevance',
};

interface CatalogPickerModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Catálogo dentro de um modal, aberto a partir da Nova Proposta — evita trocar de tela toda vez
 * que o consultor precisa buscar um item. Reaproveita FilterSidebar/ProductCard/fetchProducts
 * (mesmo código da tela cheia do Catálogo).
 */
export default function CatalogPickerModal({ open, onClose }: CatalogPickerModalProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedAmbiente, setSelectedAmbiente] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { header, rows, addProductToProposal } = useProposalDraft();
  const { showToast } = useToast();
  const { products: allProducts } = useProducts();
  const products = useMemo(() => filterProductsLocally(allProducts, filters), [allProducts, filters]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setSelectedAmbiente((prev) => (header.ambientes.includes(prev) ? prev : header.ambientes[header.ambientes.length - 1] ?? ''));
  }, [open, header.ambientes]);

  const rowsInSelectedAmbiente = useMemo(() => rows.filter((r) => r.ambiente === selectedAmbiente), [rows, selectedAmbiente]);
  const codesInSelectedAmbiente = useMemo(
    () => new Set(rowsInSelectedAmbiente.filter((r) => r.code.trim()).map((r) => r.code.trim().toLowerCase())),
    [rowsInSelectedAmbiente],
  );

  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar no catálogo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box modal-box-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 16 }}>Buscar no Catálogo</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Adicione itens sem sair da proposta — {rows.length} na proposta agora</div>
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Fechar catálogo" onClick={onClose}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div className="catalog-picker-body">
          <div className="catalog-picker-sidebar-wrap" style={{ overflowY: 'auto', flexShrink: 0 }}>
            <FilterSidebar
              filters={filters}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              onClear={() => setFilters(DEFAULT_FILTERS)}
            />
          </div>
          <div className="flex-1 p-5 overflow-y-auto" style={{ minWidth: 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Código ou nome..."
                  className="form-input"
                  style={{ width: 180, fontSize: 13, padding: '6px 10px' }}
                  aria-label="Buscar produto no catálogo"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
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
            </div>
            <AmbienteSelectorBar
              ambientes={header.ambientes}
              selected={selectedAmbiente}
              onChange={setSelectedAmbiente}
              itemsInSelected={rowsInSelectedAmbiente.map((r) => r.desc || r.code)}
            />
            {products.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} ambiente={selectedAmbiente} alreadyInAmbiente={codesInSelectedAmbiente.has(p.id.toLowerCase())} />
                  ))}
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table" style={{ minWidth: 760 }}>
                      <thead>
                        <tr><th>Produto</th><th>Fornecedor</th><th>Categoria</th><th>Acabamento</th><th>Material</th><th>Preço</th><th /></tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                {p.img ? (
                                  <img src={p.img} alt={p.name} loading="lazy" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
                                ) : (
                                  <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg)', flexShrink: 0 }} />
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
                            <td>
                              <button
                                className="btn btn-primary btn-sm"
                                aria-label={`Adicionar ${p.name} à proposta`}
                                disabled={codesInSelectedAmbiente.has(p.id.toLowerCase())}
                                onClick={() => {
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
                <PackageSearch style={{ width: 36, height: 36, opacity: 0.3 }} />
                <div style={{ fontSize: 14 }}>Nenhum produto encontrado com esses filtros.</div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
          <button className="btn btn-gold btn-sm" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </div>
  );
}
