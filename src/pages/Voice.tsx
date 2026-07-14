import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Check, CheckCircle2, Mic, Package, Search, Square, Trash2,
} from 'lucide-react';
import { updateRascunhoStatus } from '../api/voice';
import { filterProductsLocally } from '../api/products';
import { useProposalDraft } from '../context/ProposalDraftContext';
import { useProducts } from '../context/ProductsContext';
import { useVendedores } from '../context/VendedoresContext';
import { useVoz } from '../context/VozContext';
import { useToast } from '../context/ToastContext';
import { useVoiceRecognition } from '../components/voice/useVoiceRecognition';
import { parseVoiceText } from '../components/voice/voiceParser';
import { formatCurrency } from '../utils/format';
import type { ParsedVoiceResult, Product, VoiceDraftItem, VoiceNotFoundItem } from '../types';

const STEP_LABELS = ['Cliente & Partes', 'Produtos Encontrados', 'Itens não Encontrados', 'Descontos & Obs.', 'Criar Proposta'];

interface DisplayDraft {
  key: string;
  code: string;
  label: string;
  meta: string;
  parsed: ParsedVoiceResult;
  transcricao: string;
  /** Presente só nos rascunhos reais (vindos do backend) — usado pra confirmar/descartar. */
  rascunhoId?: number;
  vendedorId?: string | null;
}

function emptyParsed(): ParsedVoiceResult {
  return { client: null, architect: null, discount: 0, items: [], notFound: [] };
}

export default function Voice() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const { vendedores } = useVendedores();
  const { rascunhos, reload: reloadRascunhos } = useVoz();
  const { applyVoiceResult, setHeaderField } = useProposalDraft();
  const { showToast } = useToast();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [liveTranscript, setLiveTranscript] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval>>();

  const [cliente, setCliente] = useState('');
  const [arquiteto, setArquiteto] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [discount, setDiscount] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [items, setItems] = useState<VoiceDraftItem[]>([]);
  const [notFound, setNotFound] = useState<VoiceNotFoundItem[]>([]);
  const [searchOpenFor, setSearchOpenFor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const wasRecordingRef = useRef(false);

  const { isRecording, start, stop } = useVoiceRecognition(setLiveTranscript, (msg) => showToast(msg, 'error'));

  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(recordTimerRef.current);
    }
    return () => clearInterval(recordTimerRef.current);
  }, [isRecording]);

  const liveParsed = useMemo(
    () => (liveTranscript.trim() ? parseVoiceText(liveTranscript, products) : emptyParsed()),
    [liveTranscript, products],
  );

  // Rascunhos reais (tabela proposta_rascunhos) — chegam via webhook externo de voz (RF-059),
  // já vêm com os itens estruturados (encontrado/não encontrado), sem precisar reparsear a transcrição.
  const realDisplayDrafts: DisplayDraft[] = useMemo(() => rascunhos.map((r) => {
    const parsed: ParsedVoiceResult = {
      client: r.clienteNome,
      architect: r.arquiteto,
      discount: r.descontoGlobal,
      items: r.itens
        .filter((i) => i.status === 'encontrado' && i.produto)
        .map((i) => ({ product: i.produto as Product, qty: i.quantidade })),
      notFound: r.itens
        .filter((i) => i.status === 'nao_encontrado')
        .map((i) => ({ phrase: i.codigoExtraido, suggestion: null })),
    };
    return {
      key: `real-${r.id}`,
      code: `VOZ-${r.id}`,
      label: r.clienteNome || r.vendedorNome || 'Rascunho de voz',
      meta: new Date(r.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      parsed,
      transcricao: r.transcricaoOriginal,
      rascunhoId: r.id,
      vendedorId: r.vendedorId,
    };
  }), [rascunhos]);

  const liveDisplayDraft: DisplayDraft | null = liveTranscript.trim() ? {
    key: 'live',
    code: 'Nova Gravação',
    label: liveParsed.client || 'Gravação atual',
    meta: isRecording ? `Gravando… ${String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:${String(recordSeconds % 60).padStart(2, '0')}` : `${String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:${String(recordSeconds % 60).padStart(2, '0')}`,
    parsed: liveParsed,
    transcricao: liveTranscript,
  } : null;

  const allDrafts = liveDisplayDraft ? [liveDisplayDraft, ...realDisplayDrafts] : realDisplayDrafts;
  const selectedDraft = allDrafts.find((d) => d.key === selectedKey) ?? null;

  function loadDraftIntoForm(draft: DisplayDraft) {
    setCliente(draft.parsed.client || '');
    setArquiteto(draft.parsed.architect || '');
    setVendedor(draft.vendedorId ?? '');
    setDiscount(draft.parsed.discount || 0);
    setObservacoes('');
    setItems(draft.parsed.items);
    setNotFound(draft.parsed.notFound);
    setStep(1);
  }

  // Auto-seleciona a gravação em andamento assim que ela produzir algum texto.
  useEffect(() => {
    if (liveDisplayDraft && selectedKey !== 'live') {
      setSelectedKey('live');
      loadDraftIntoForm(liveDisplayDraft);
    } else if (!selectedKey && realDisplayDrafts.length > 0) {
      setSelectedKey(realDisplayDrafts[0].key);
      loadDraftIntoForm(realDisplayDrafts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(liveDisplayDraft), realDisplayDrafts.length]);

  // Ao parar de gravar, sincroniza o formulário com a transcrição final (enquanto grava, o usuário só observa).
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && selectedKey === 'live' && liveDisplayDraft) {
      loadDraftIntoForm(liveDisplayDraft);
    }
    wasRecordingRef.current = isRecording;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  function selectDraft(draft: DisplayDraft) {
    setSelectedKey(draft.key);
    loadDraftIntoForm(draft);
  }

  function useSuggestion(entry: VoiceNotFoundItem) {
    if (!entry.suggestion) return;
    setItems((prev) => [...prev, { product: entry.suggestion as Product, qty: 1 }]);
    setNotFound((prev) => prev.filter((n) => n.phrase !== entry.phrase));
  }

  function removeNotFound(phrase: string) {
    setNotFound((prev) => prev.filter((n) => n.phrase !== phrase));
    setSearchOpenFor(null);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function pickReplacement(entry: VoiceNotFoundItem, product: Product) {
    setItems((prev) => [...prev, { product, qty: 1 }]);
    setNotFound((prev) => prev.filter((n) => n.phrase !== entry.phrase));
    setSearchOpenFor(null);
    setSearch('');
  }

  const total = items.reduce((s, it) => s + it.qty * it.product.price, 0) * (1 - discount / 100);

  async function handleCreateProposal() {
    const result: ParsedVoiceResult = { client: cliente || null, architect: arquiteto || null, discount, items, notFound: [] };
    applyVoiceResult(result);
    if (vendedor) setHeaderField('vendedor', vendedor);
    if (observacoes) setHeaderField('observacoes', observacoes);

    const rascunhoId = selectedDraft?.rascunhoId;
    if (rascunhoId) {
      try {
        await updateRascunhoStatus(rascunhoId, 'confirmado');
        reloadRascunhos();
      } catch {
        // segue mesmo se o PATCH falhar — os dados já foram aplicados ao rascunho local da proposta.
      }
    }
    showToast('Dados aplicados — revise e salve a proposta.', 'success');
    navigate('/propostas/nova');
  }

  const searchResults = searchOpenFor && search.trim()
    ? filterProductsLocally(products, { search, categories: [], suppliers: [], finishes: [], priceRange: 'all', sort: 'relevance' }).slice(0, 5)
    : [];

  return (
    <div id="view-voice" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Rascunhos de Voz</span>
              <span className="badge badge-gold" style={{ fontSize: 10.5 }}>{allDrafts.length} transcriç{allDrafts.length !== 1 ? 'ões' : 'ão'}</span>
            </div>
            <button
              className="btn btn-sm w-full mt-2"
              style={{
                background: isRecording ? 'var(--error)' : 'var(--gold)', color: '#fefefe', justifyContent: 'center',
              }}
              onClick={() => (isRecording ? stop() : start())}
            >
              {isRecording ? <Square style={{ width: 13, height: 13 }} /> : <Mic style={{ width: 13, height: 13 }} />}
              {isRecording ? 'Parar Gravação' : 'Gravar Novo Rascunho'}
            </button>
          </div>

          {allDrafts.map((draft) => {
            const hasIssue = draft.parsed.notFound.length > 0;
            const isLive = draft.key === 'live';
            return (
              <div
                key={draft.key}
                className={`draft-item${selectedKey === draft.key ? ' selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => selectDraft(draft)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: isLive && isRecording ? 'var(--error)' : hasIssue ? 'var(--warning)' : 'var(--info, #3182CE)',
                    }} />
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{draft.code}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{draft.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {draft.meta} · {draft.parsed.items.length} produto{draft.parsed.items.length !== 1 ? 's' : ''}
                </div>
                {hasIssue && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
                    {draft.parsed.notFound.length} não encontrado(s)
                  </div>
                )}
              </div>
            );
          })}

          {allDrafts.length === 0 && (
            <div className="card p-4" style={{ fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Nenhum rascunho de voz ainda. Toque em "Gravar Novo Rascunho" para começar.
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-4">
          {isRecording && (
            <div className="card p-4" style={{ borderColor: 'var(--error)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--error)' }} />
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>Ouvindo… fale agora</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', minHeight: 20 }}>
                {liveTranscript || 'A transcrição aparecerá aqui enquanto você fala...'}
              </p>
            </div>
          )}

          {!selectedDraft ? (
            <div className="card flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
              <Mic style={{ width: 36, height: 36, opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>Selecione um rascunho na lista ou grave um novo.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 flex-wrap" style={{ marginBottom: 4 }}>
                {STEP_LABELS.map((label, i) => {
                  const n = i + 1;
                  const done = n < step;
                  const active = n === step;
                  return (
                    <div key={label} className="flex items-center gap-1">
                      <button
                        className="btn btn-sm"
                        style={{
                          background: active ? 'var(--gold)' : done ? 'rgba(56,161,105,.1)' : 'var(--card)',
                          color: active ? '#fefefe' : done ? 'var(--success)' : 'var(--text-secondary)',
                          border: active ? 'none' : '1px solid var(--border)',
                          fontWeight: 600, fontSize: 12,
                        }}
                        onClick={() => setStep(n)}
                      >
                        {done ? <Check style={{ width: 11, height: 11 }} /> : `${n}.`} {label}
                      </button>
                      {n < STEP_LABELS.length && <span style={{ color: 'var(--text-secondary)' }}>›</span>}
                    </div>
                  );
                })}
              </div>

              <div className="card p-5 flex-1">
                {step === 1 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Confirme os dados identificados pela IA</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5" style={{ maxWidth: 640 }}>
                      <div>
                        <label className="form-label" htmlFor="voz-cliente">Cliente</label>
                        <input id="voz-cliente" className="form-input" value={cliente} onChange={(e) => setCliente(e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label" htmlFor="voz-arq">Arquiteto</label>
                        <input id="voz-arq" className="form-input" value={arquiteto} onChange={(e) => setArquiteto(e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="form-label" htmlFor="voz-vend">Vendedor</label>
                        <select id="voz-vend" className="form-input" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
                          <option value="">Selecione...</option>
                          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ maxWidth: 640, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Transcrição Original
                      </div>
                      <p style={{ fontSize: 13.5, fontStyle: 'italic', color: 'var(--primary)', lineHeight: 1.6 }}>
                        &quot;{selectedDraft.transcricao || '—'}&quot;
                      </p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Produtos identificados automaticamente</div>
                    {items.length > 0 ? (
                      <div className="space-y-2" style={{ maxWidth: 640 }}>
                        {items.map((item, i) => (
                          <div key={`${item.product.id}-${i}`} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                            {item.product.img
                              ? <img src={item.product.img} alt={item.product.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
                              : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg)', flexShrink: 0 }} />}
                            <div className="flex-1">
                              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.product.name}</div>
                              <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {item.product.id} · Qtd {item.qty} · {formatCurrency(item.product.price)}
                              </div>
                              {item.ambiente && <div style={{ fontSize: 11.5, color: 'var(--gold-text)', marginTop: 2 }}>{item.ambiente}</div>}
                            </div>
                            <span className="badge badge-success" style={{ fontSize: 10.5 }}>
                              <CheckCircle2 style={{ width: 11, height: 11 }} /> Encontrado
                            </span>
                            <button className="btn btn-ghost btn-sm" aria-label={`Remover ${item.product.name}`} onClick={() => removeItem(i)}>
                              <Trash2 style={{ width: 13, height: 13, color: 'var(--error)' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhum produto do catálogo foi identificado nesta transcrição.</div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Itens não encontrados — corrija manualmente</div>
                    {notFound.length > 0 ? (
                      <div className="space-y-3" style={{ maxWidth: 640 }}>
                        {notFound.map((entry) => (
                          <div key={entry.phrase} className="p-4 rounded-lg" style={{ background: 'rgba(221,107,32,.08)', border: '1px solid rgba(221,107,32,.35)' }}>
                            <div className="flex items-start gap-2 mb-1">
                              <AlertTriangle style={{ width: 15, height: 15, color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <div style={{ fontSize: 13.5, fontWeight: 700 }}>&quot;{entry.phrase}&quot;</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Não encontrada no catálogo com este termo</div>
                                {entry.suggestion && (
                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                    Sugestão: {entry.suggestion.name} ({entry.suggestion.id})
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {entry.suggestion && (
                                <button className="btn btn-sm" style={{ background: 'var(--gold)', color: '#fefefe' }} onClick={() => useSuggestion(entry)}>
                                  Usar sugestão
                                </button>
                              )}
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => { setSearchOpenFor(searchOpenFor === entry.phrase ? null : entry.phrase); setSearch(''); }}
                              >
                                <Search style={{ width: 12, height: 12 }} /> Buscar outro
                              </button>
                              <button className="btn btn-ghost btn-sm" aria-label="Remover item não encontrado" onClick={() => removeNotFound(entry.phrase)}>
                                <Trash2 style={{ width: 13, height: 13, color: 'var(--error)' }} />
                              </button>
                            </div>
                            {searchOpenFor === entry.phrase && (
                              <div className="mt-3">
                                <input
                                  className="form-input"
                                  placeholder="Buscar produto por nome ou código..."
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  autoFocus
                                />
                                {searchResults.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {searchResults.map((p) => (
                                      <button
                                        key={p.id}
                                        className="btn btn-outline btn-sm w-full"
                                        style={{ justifyContent: 'flex-start' }}
                                        onClick={() => pickReplacement(entry, p)}
                                      >
                                        <Package style={{ width: 12, height: 12 }} /> {p.name} <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{p.id}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--success)' }}>Nenhum item não encontrado. 🎉</div>
                    )}
                  </div>
                )}

                {step === 4 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Descontos e Observações</div>
                    <div style={{ maxWidth: 640 }}>
                      <label className="form-label" htmlFor="voz-desc">Desconto global (%)</label>
                      <input
                        id="voz-desc" type="number" min={0} max={100} className="form-input mb-4"
                        value={discount} onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                      />
                      <label className="form-label" htmlFor="voz-obs">Observações</label>
                      <textarea
                        id="voz-obs" className="form-input" rows={3} placeholder="Observações adicionais..."
                        value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="flex items-center justify-center" style={{ minHeight: 240 }}>
                    <div className="card p-6 text-center" style={{ maxWidth: 360 }}>
                      <CheckCircle2 style={{ width: 40, height: 40, color: 'var(--success)', margin: '0 auto 12px' }} />
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Revisão concluída!</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                        {items.length} produto{items.length !== 1 ? 's' : ''} prontos · {formatCurrency(total)} estimado
                      </div>
                      <button className="btn btn-gold" onClick={handleCreateProposal}>Criar Proposta</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button className="btn btn-outline btn-sm" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  ← Anterior
                </button>
                <button className="btn btn-gold btn-sm" disabled={step === 5} onClick={() => setStep((s) => Math.min(5, s + 1))}>
                  Próximo →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
