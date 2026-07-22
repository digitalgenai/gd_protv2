import { useEffect, useRef, useState } from 'react';
import { BarChart3, CheckCircle, CloudUpload, Info, Images, Loader2, Plus, Save, Star, X, ZoomIn } from 'lucide-react';
import { useImageModal, type ImageModalTab } from '../../context/ImageModalContext';
import { useProducts } from '../../context/ProductsContext';
import { useToast } from '../../context/ToastContext';
import { updateProduct, fetchProductAnalytics, type ProductAnalytics } from '../../api/products';
import { uploadProductImage, reorderProductImage } from '../../api/images';
import { ApiError } from '../../api/client';
import { formatCurrencyRounded } from '../../utils/format';
import CurrencyInput from '../ui/CurrencyInput';
import Dropdown from '../ui/Dropdown';
import { STATUS_BADGE, statusBadgeLabel } from '../../utils/proposalStatus';
import type { ProposalStatus } from '../../types';

type ProductImage = { id: number; url: string; posicao: number };

const TABS: { id: ImageModalTab; label: string; icon: typeof Info }[] = [
  { id: 'info', label: 'Informações', icon: Info },
  { id: 'imagens', label: 'Imagens', icon: Images },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const MAX_IMAGES = 3;
// Mesmo teto do backend (config.MAX_TOTAL_IMAGES_PER_PRODUCT) — só pra desabilitar o botão
// "Adicionar mais imagens" no limite, sem precisar de um round-trip pra descobrir isso.
const MAX_TOTAL_IMAGES = 20;

export default function ImageModal() {
  const { product, isOpen, initialTab, closeImageModal } = useImageModal();
  const { facets, updateProductLocally } = useProducts();
  const { showToast } = useToast();

  const [tab, setTab] = useState<ImageModalTab>('info');
  const [form, setForm] = useState({ name: '', cat: '', supplier: '', finish: '', material: '', price: 0, dimensions: '' });
  const [savingInfo, setSavingInfo] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [addingExtra, setAddingExtra] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ProductAnalytics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !product) return;
    setTab(initialTab);
    setForm({ name: product.name, cat: product.cat, supplier: product.supplier, finish: product.finish, material: product.material, price: product.price, dimensions: product.dimensions });
    setImages(product.images ?? []);
    setLightboxUrl(null);
    setStats(null);
  }, [isOpen, product, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (lightboxUrl) setLightboxUrl(null);
      else closeImageModal();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeImageModal, lightboxUrl]);

  // Carrega sob demanda só quando a aba é aberta — antes vinha de um mock local
  // (src/data/mockProposals.ts) que nunca batia com os códigos reais do catálogo,
  // então a aba sempre aparecia vazia pra qualquer produto de verdade.
  useEffect(() => {
    if (!isOpen || !product || tab !== 'analytics') return;
    let active = true;
    setStatsLoading(true);
    fetchProductAnalytics(product.id)
      .then((data) => { if (active) setStats(data); })
      .catch(() => { if (active) showToast('Não foi possível carregar as estatísticas — backend indisponível.', 'error'); })
      .finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [isOpen, product, tab, showToast]);

  if (!product) return null;
  // Fotos legadas de antes do limite de 3 posições por produto (ver MAX_IMAGES_PER_PRODUCT no
  // backend) — não cabem nos 3 slots principais, mas ficam visíveis aqui num carrossel.
  const extraImages = images.filter((img) => img.posicao > MAX_IMAGES);

  async function handleSaveInfo() {
    if (!product) return;
    setSavingInfo(true);
    try {
      await updateProduct(product.id, form);
      updateProductLocally(product.id, form);
      showToast('Produto atualizado!', 'success');
      closeImageModal();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Não foi possível salvar — backend indisponível.', 'error');
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleUploadFile(file: File | null | undefined) {
    if (!file || !product) return;
    const slot = pendingSlotRef.current;
    if (slot) setUploadingSlot(slot);
    else setAddingExtra(true);
    try {
      const nova = await uploadProductImage(product.id, file);
      setImages((prev) => {
        const next = [...prev, nova].sort((a, b) => a.posicao - b.posicao);
        const principal = next.find((img) => img.posicao === 1);
        updateProductLocally(product.id, { images: next, img: principal?.url || product.img });
        return next;
      });
      showToast('Imagem enviada!', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Não foi possível enviar a imagem — backend indisponível.', 'error');
    } finally {
      if (slot) setUploadingSlot(null);
      else setAddingExtra(false);
    }
  }

  async function handleMakePrimary(imageId: number) {
    if (!product) return;
    try {
      const updated = await reorderProductImage(product.id, imageId, 1);
      const next = [...updated].sort((a, b) => a.posicao - b.posicao);
      const principal = next.find((img) => img.posicao === 1);
      setImages(next);
      updateProductLocally(product.id, { images: next, img: principal?.url || product.img });
      showToast('Imagem definida como principal.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Não foi possível reordenar as imagens — backend indisponível.', 'error');
    }
  }

  return (
    <>
    <div
      id="modal-images"
      className={`modal-overlay${isOpen ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-product-name"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeImageModal();
      }}
    >
      <div className="modal-box">
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div id="modal-product-name" style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 17 }}>{product.name}</div>
            <div id="modal-product-id" className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{product.id}</div>
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Fechar modal" onClick={closeImageModal}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div className="px-6 pt-3" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className="btn btn-ghost btn-sm"
              style={{
                borderRadius: 0,
                borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent',
                color: tab === id ? 'var(--gold-text)' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
              onClick={() => setTab(id)}
            >
              <Icon style={{ width: 13, height: 13 }} /> {label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="sm:col-span-2">
                <label className="form-label" htmlFor="pi-nome">Nome do Produto</label>
                <input id="pi-nome" className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label" htmlFor="pi-cat">Categoria</label>
                <Dropdown
                  id="pi-cat"
                  value={form.cat}
                  onChange={(cat) => setForm((f) => ({ ...f, cat }))}
                  placeholder="— Sem categoria —"
                  options={[
                    ...(form.cat && !facets.categories.some((fc) => fc.value === form.cat) ? [form.cat] : []),
                    ...facets.categories.map((fc) => fc.value),
                  ]}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="pi-forn">Fornecedor</label>
                <Dropdown
                  id="pi-forn"
                  value={form.supplier}
                  onChange={(supplier) => setForm((f) => ({ ...f, supplier }))}
                  placeholder="Selecione um fornecedor"
                  options={facets.suppliers}
                  allowEmpty={false}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="pi-acab">Acabamento</label>
                <Dropdown
                  id="pi-acab"
                  value={form.finish}
                  onChange={(finish) => setForm((f) => ({ ...f, finish }))}
                  placeholder="— Sem acabamento —"
                  options={facets.finishes}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="pi-material">Material</label>
                <Dropdown
                  id="pi-material"
                  value={form.material}
                  onChange={(material) => setForm((f) => ({ ...f, material }))}
                  placeholder="— Sem material —"
                  options={[
                    ...(form.material && !facets.materials.includes(form.material) ? [form.material] : []),
                    ...facets.materials,
                  ]}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="pi-preco">Preço (R$)</label>
                <CurrencyInput id="pi-preco" className="form-input" value={form.price} onChange={(price) => setForm((f) => ({ ...f, price }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label" htmlFor="pi-dim">Dimensões</label>
                <input
                  id="pi-dim"
                  className="form-input"
                  placeholder="Ex.: 76 × 68 × 84 cm (L×P×A)"
                  value={form.dimensions}
                  onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-outline" disabled={savingInfo} onClick={closeImageModal}>Cancelar</button>
              <button className="btn btn-gold" disabled={savingInfo} onClick={handleSaveInfo}>
                {savingInfo
                  ? <Loader2 className="spin" style={{ width: 14, height: 14 }} />
                  : <Save style={{ width: 14, height: 14 }} />}
                {savingInfo ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )}

        {tab === 'imagens' && (
          <div className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleUploadFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Padrão sugerido: a Imagem 1 é sempre o produto isolado (fundo neutro); as Imagens 2 e 3 podem mostrar o produto em um ambiente.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {Array.from({ length: MAX_IMAGES }, (_, i) => i + 1).map((posicao) => {
                const existing = images.find((img) => img.posicao === posicao);
                const isUploading = uploadingSlot === posicao;
                return (
                  <div key={posicao}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                      Imagem {posicao} <span style={{ color: 'var(--gold-text)' }}>· {posicao === 1 ? 'Produto' : 'Ambiente'}</span>
                    </div>
                    {existing ? (
                      <div
                        className="img-slot"
                        style={{ cursor: 'zoom-in' }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ampliar imagem ${posicao}`}
                        onClick={() => setLightboxUrl(existing.url)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLightboxUrl(existing.url); }}
                      >
                        <img src={existing.url} alt={`Imagem ${posicao} do produto`} />
                        <div className="img-actions">
                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(0,0,0,.6)', color: '#fefefe', borderRadius: 8 }}
                            aria-label={`Ampliar imagem ${posicao}`}
                            title="Ampliar"
                            onClick={(e) => { e.stopPropagation(); setLightboxUrl(existing.url); }}
                          >
                            <ZoomIn style={{ width: 13, height: 13 }} />
                          </button>
                          {posicao !== 1 && (
                            <button
                              className="btn btn-sm"
                              style={{ background: 'rgba(0,0,0,.6)', color: '#fefefe', borderRadius: 8 }}
                              aria-label={`Tornar imagem ${posicao} principal`}
                              title="Tornar principal (posição 1)"
                              onClick={(e) => { e.stopPropagation(); handleMakePrimary(existing.id); }}
                            >
                              <Star style={{ width: 13, height: 13 }} />
                            </button>
                          )}
                        </div>
                        {posicao === 1 && (
                          <div style={{ position: 'absolute', bottom: 6, left: 6 }}>
                            <span className="badge badge-gold" style={{ fontSize: 10 }}>Principal</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="img-slot drop-zone flex flex-col items-center justify-center gap-2"
                        style={{ minHeight: 160, cursor: isUploading ? 'wait' : 'pointer', opacity: isUploading ? 0.6 : 1 }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Área de upload para imagem ${posicao}`}
                        onClick={() => {
                          if (isUploading) return;
                          pendingSlotRef.current = posicao;
                          fileInputRef.current?.click();
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                            pendingSlotRef.current = posicao;
                            fileInputRef.current?.click();
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('over');
                        }}
                        onDragLeave={(e) => e.currentTarget.classList.remove('over')}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('over');
                          if (isUploading) return;
                          pendingSlotRef.current = posicao;
                          handleUploadFile(e.dataTransfer.files?.[0]);
                        }}
                      >
                        <CloudUpload style={{ width: 28, height: 28, color: 'var(--text-secondary)' }} />
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                          {isUploading ? 'Enviando...' : <>Arraste ou clique<br />para adicionar</>}
                        </div>
                        <div style={{ fontSize: 11, color: '#d3d3d3' }}>Mín. 600×600px</div>
                      </div>
                    )}
                    {existing && (
                      <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle style={{ width: 12, height: 12 }} /> Salva
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mb-5">
              {extraImages.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Mais {extraImages.length} imagem{extraImages.length > 1 ? 'ns' : ''} deste produto <span style={{ color: 'var(--gold-text)' }}>· clique para ampliar</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ marginBottom: 12 }}>
                    {extraImages.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        aria-label={`Ampliar imagem extra (posição ${img.posicao})`}
                        onClick={() => setLightboxUrl(img.url)}
                        style={{
                          flexShrink: 0, width: 96, height: 96, borderRadius: 8, overflow: 'hidden',
                          border: '1.5px solid var(--border)', cursor: 'zoom-in', padding: 0, background: '#fff',
                        }}
                      >
                        <img src={img.url} alt={`Imagem extra do produto, posição ${img.posicao}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={addingExtra || images.length >= MAX_TOTAL_IMAGES}
                onClick={() => {
                  pendingSlotRef.current = null;
                  fileInputRef.current?.click();
                }}
              >
                {addingExtra
                  ? <Loader2 className="spin" style={{ width: 13, height: 13 }} />
                  : <Plus style={{ width: 13, height: 13 }} />}
                {addingExtra
                  ? 'Enviando...'
                  : images.length >= MAX_TOTAL_IMAGES
                    ? `Limite de ${MAX_TOTAL_IMAGES} imagens atingido`
                    : 'Adicionar mais imagens'}
              </button>
            </div>

            <div className="p-4 rounded-lg mb-5" style={{ background: 'rgba(56,161,105,.07)', border: '1px solid rgba(56,161,105,.2)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>Validação Automática Ativa</div>
              <div style={{ fontSize: 12.5, color: 'var(--primary)' }}>
                Imagens abaixo de <strong>600×600px</strong>, fora dos formatos JPEG/PNG/WEBP, ou fora da faixa de{' '}
                <strong>50 KB – 10 MB</strong> são rejeitadas pelo backend antes de salvar — cada envio/remoção acima já é
                persistido de imediato, sem precisar de um botão "Salvar" separado.
              </div>
            </div>

            <div className="flex justify-end">
              <button className="btn btn-gold" onClick={closeImageModal}>Concluir</button>
            </div>
          </div>
        )}

        {tab === 'analytics' && (
          <div className="p-6">
            {statsLoading || !stats ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Loader2 className="spin" style={{ width: 24, height: 24 }} />
                <div style={{ fontSize: 13 }}>Carregando estatísticas...</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div className="kpi-card">
                    <div className="kpi-value">{stats.timesSold}</div>
                    <div className="kpi-label">Unidades vendidas (em propostas)</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-value mono" style={{ fontSize: 20 }}>{formatCurrencyRounded(stats.revenue)}</div>
                    <div className="kpi-label">Receita gerada (aproximada)</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Propostas relacionadas
                </div>
                {stats.proposals.length > 0 ? (
                  <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Código</th><th>Cliente</th><th>Qtd</th><th>Status</th></tr></thead>
                    <tbody>
                      {stats.proposals.map((p, i) => (
                        <tr key={`${p.code}-${i}`}>
                          <td><span className="mono text-xs" style={{ color: 'var(--gold-text)' }}>{p.code}</span></td>
                          <td>{p.cliente}</td>
                          <td>{p.qty}</td>
                          <td><span className={`badge ${STATUS_BADGE[p.status as ProposalStatus]}`}>{statusBadgeLabel(p.status as ProposalStatus)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                    Este produto ainda não apareceu em nenhuma proposta registrada.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>

    {lightboxUrl && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Imagem ampliada"
        onClick={() => setLightboxUrl(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, cursor: 'zoom-out',
        }}
      >
        <button
          aria-label="Fechar imagem ampliada"
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'absolute', top: 20, right: 20, width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(255,255,255,.12)', border: 'none', color: '#fefefe', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X style={{ width: 20, height: 20 }} />
        </button>
        <img
          src={lightboxUrl}
          alt="Imagem ampliada do produto"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'default' }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
}
