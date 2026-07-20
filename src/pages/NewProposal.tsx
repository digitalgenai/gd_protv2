import { Fragment, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Circle, Copy, Eye, FileDown, FilePlus, Home, Mail, MessageCircle, Package, Plus, Save, Send, Users, X } from 'lucide-react';
import { useProposalDraft, PAYMENT_OPTIONS } from '../context/ProposalDraftContext';
import { useProducts } from '../context/ProductsContext';
import { useVendedores } from '../context/VendedoresContext';
import { useToast } from '../context/ToastContext';
import { createProposal } from '../api/proposals';
import { fetchArquitetos } from '../api/clientes';
import type { ArquitetoSummary } from '../types';
import { formatCurrency, formatPhoneBR, parseClamped } from '../utils/format';
import { buildWhatsAppShareLink } from '../utils/whatsapp';
import { buildMailtoShareLink } from '../utils/email';
import { groupByAmbiente, shouldShowAmbienteHeaders, orderGroupsByAmbientList, AMBIENTE_SUGGESTIONS } from '../utils/groupByAmbiente';
import ProposalItemRow from '../components/proposal/ProposalItemRow';
import ProposalPreview from '../components/proposal/ProposalPreview';
import CatalogPickerModal from '../components/catalog/CatalogPickerModal';

export default function NewProposal() {
  const {
    header, rows, setHeaderField, addEmptyRow, addAmbiente, removeAmbiente,
    addCoVendedor, removeCoVendedor, originalCode, proposalCode, subtotal, total,
  } = useProposalDraft();
  const { products: allProducts } = useProducts();
  const { vendedores } = useVendedores();
  const { showToast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [novoAmbiente, setNovoAmbiente] = useState('');
  const [novoCoVendedor, setNovoCoVendedor] = useState('');
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement>(null);
  const [arquitetosCrm, setArquitetosCrm] = useState<ArquitetoSummary[]>([]);

  useEffect(() => {
    // Sugestões pro campo Arquiteto vêm do CRM — se falhar, o campo segue como texto livre normal.
    fetchArquitetos().then(setArquitetosCrm).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sendMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target as Node)) setSendMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sendMenuOpen]);
  const groups = orderGroupsByAmbientList(groupByAmbiente(rows), header.ambientes);
  const showAmbienteHeaders = shouldShowAmbienteHeaders(groups);

  function handleAddAmbiente(name: string) {
    addAmbiente(name);
    setNovoAmbiente('');
  }

  const readiness = [
    { label: 'Cliente', done: Boolean(header.cliente.trim()) },
    { label: 'Vendedor', done: Boolean(header.vendedor) },
    { label: rows.length > 0 ? `${rows.length} ite${rows.length > 1 ? 'ns' : 'm'}` : 'Itens', done: rows.length > 0 },
  ];

  const todosProdutosTemImagem = rows.length > 0 && rows.every((r) => {
    const matched = allProducts.find((p) => p.id.toLowerCase() === r.code.trim().toLowerCase());
    return Boolean(matched?.img);
  });
  const todosProdutosTemPreco = rows.length > 0 && rows.every((r) => r.price > 0);

  const validationChecklist = [
    { label: 'Cliente selecionado', done: Boolean(header.cliente.trim()) },
    { label: 'Vendedor selecionado', done: Boolean(header.vendedor) },
    { label: 'Pelo menos 1 produto adicionado', done: rows.length > 0 },
    { label: 'Todos os produtos têm imagem', done: todosProdutosTemImagem },
    { label: 'Todos os produtos têm preço', done: todosProdutosTemPreco },
  ];

  function validateHeader(): boolean {
    if (!header.cliente.trim()) {
      showToast('Informe o nome do cliente antes de continuar.', 'warning');
      document.getElementById('pCliente')?.focus();
      return false;
    }
    if (!header.vendedor) {
      showToast('Selecione o vendedor responsável.', 'warning');
      document.getElementById('pVendedor')?.focus();
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validateHeader()) return;
    try {
      await createProposal({
        cliente: header.cliente,
        telefoneCliente: header.telefoneCliente || null,
        enderecoCliente: header.enderecoCliente || null,
        emailCliente: header.emailCliente || null,
        arquiteto: header.arquiteto || null,
        vendedor: header.vendedor,
        validade: header.validade,
        pagamento: header.pagamento,
        versao: header.versao,
        observacoes: header.observacoes,
        descontoGlobal: header.globalDiscount,
        itens: rows,
        vendedoresConjuntos: header.vendedoresConjuntos,
        propostaOriginalCodigo: originalCode ?? undefined,
      });
      showToast(originalCode ? `Versão v${header.versao} salva!` : 'Rascunho salvo!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar a proposta — backend indisponível.', 'error');
    }
  }

  function handlePdf() {
    if (rows.length === 0) {
      showToast('Adicione itens à proposta antes de gerar o PDF.', 'error');
      return;
    }
    window.print();
  }

  function podeEnviar(): boolean {
    if (!validateHeader()) return false;
    if (rows.length === 0) {
      showToast('Adicione itens à proposta antes de enviar.', 'error');
      return false;
    }
    return true;
  }

  function handleSendWhatsApp() {
    setSendMenuOpen(false);
    if (!podeEnviar()) return;
    const mensagem = [
      `Olá${header.cliente.trim() ? ', ' + header.cliente.trim() : ''}! Segue a proposta *${proposalCode}* da Galpão Design.`,
      '',
      `Valor total: ${formatCurrency(total)}`,
      '',
      'Qualquer dúvida, estou à disposição!',
    ].join('\n');
    window.open(buildWhatsAppShareLink(header.telefoneCliente, mensagem), '_blank', 'noopener,noreferrer');
    showToast('Anexe o PDF da proposta manualmente na conversa do WhatsApp.', 'info');
  }

  function handleSendEmail() {
    setSendMenuOpen(false);
    if (!podeEnviar()) return;
    const assunto = `Proposta Comercial ${proposalCode} — Galpão Design`;
    const corpo = [
      `Olá${header.cliente.trim() ? ', ' + header.cliente.trim() : ''}!`,
      '',
      `Segue a proposta ${proposalCode} da Galpão Design.`,
      '',
      `Valor total: ${formatCurrency(total)}`,
      '',
      'Qualquer dúvida, estou à disposição!',
    ].join('\n');
    window.location.href = buildMailtoShareLink(header.emailCliente, assunto, corpo);
    showToast('Anexe o PDF da proposta manualmente no e-mail.', 'info');
  }

  return (
    <div id="view-new-proposal" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="proposal-hero rise-in mb-5">
        <div className="flex items-start justify-between gap-6 flex-wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div>
            <div className="proposal-hero-eyebrow">Proposta Comercial · Rascunho</div>
            <h1 className="proposal-hero-title">
              Proposta para{' '}
              {header.cliente.trim()
                ? <span className="hero-client">{header.cliente}</span>
                : <span className="hero-client placeholder">seu cliente…</span>}
            </h1>
            <div className="proposal-hero-code">
              {proposalCode}
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 6px', color: '#979797' }}
                aria-label="Copiar código da proposta"
                title="Copiar código"
                onClick={() => {
                  navigator.clipboard?.writeText(proposalCode).catch(() => {});
                  showToast('Código copiado!', 'info');
                }}
              >
                <Copy style={{ width: 12, height: 12 }} />
              </button>
            </div>
            <div className="readiness">
              {readiness.map((r) => (
                <span key={r.label} className={`readiness-chip${r.done ? ' done' : ''}`}>
                  <span className="dot">{r.done && <Check style={{ width: 10, height: 10 }} />}</span>
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="proposal-hero-total-label">Total da proposta</div>
            <div className="proposal-hero-total"><span key={total} className="total-pop">{formatCurrency(total)}</span></div>
            {header.globalDiscount > 0 && (
              <div style={{ fontSize: 11.5, color: '#AA3A41', fontWeight: 600, marginTop: 2 }}>
                com {header.globalDiscount}% de desconto global
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5 mb-5 rise-in" style={{ animationDelay: '.06s' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label" htmlFor="pCliente">Cliente *</label>
            <input id="pCliente" type="text" placeholder="Nome do cliente" className="form-input" value={header.cliente} onChange={(e) => setHeaderField('cliente', e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="pTelefone">Telefone do Cliente</label>
            <input
              id="pTelefone"
              type="tel"
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              maxLength={15}
              className="form-input"
              value={header.telefoneCliente}
              onChange={(e) => setHeaderField('telefoneCliente', formatPhoneBR(e.target.value))}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="pEmail">E-mail do Cliente</label>
            <input
              id="pEmail"
              type="email"
              placeholder="cliente@email.com"
              className="form-input"
              value={header.emailCliente}
              onChange={(e) => setHeaderField('emailCliente', e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <label className="form-label" htmlFor="pEndereco">Endereço do Cliente</label>
            <input id="pEndereco" type="text" placeholder="Rua, número, bairro, cidade, CEP" className="form-input" value={header.enderecoCliente} onChange={(e) => setHeaderField('enderecoCliente', e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="pArquiteto">Arquiteto / Escritório</label>
            <select id="pArquiteto" className="form-input" value={header.arquiteto} onChange={(e) => setHeaderField('arquiteto', e.target.value)}>
              <option value="">— Nenhum —</option>
              {header.arquiteto && !arquitetosCrm.some((a) => a.nome === header.arquiteto) && (
                <option value={header.arquiteto}>{header.arquiteto}</option>
              )}
              {arquitetosCrm.map((a) => (
                <option key={a.id} value={a.nome}>{a.escritorio ? `${a.nome} — ${a.escritorio}` : a.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="pVendedor">Vendedor *</label>
            <select id="pVendedor" className="form-input" value={header.vendedor} onChange={(e) => setHeaderField('vendedor', e.target.value)}>
              <option value="">Selecione...</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="pValidade">Validade da Proposta</label>
            <input id="pValidade" type="date" className="form-input" value={header.validade} onChange={(e) => setHeaderField('validade', e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="pPagamento">Condição de Pagamento</label>
            <select id="pPagamento" className="form-input" value={header.pagamento} onChange={(e) => setHeaderField('pagamento', e.target.value)}>
              {PAYMENT_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="pVersion">Versão</label>
            <input id="pVersion" type="number" min={1} className="form-input" value={header.versao} onChange={(e) => setHeaderField('versao', Math.round(parseClamped(e.target.value, 1, 99)))} />
          </div>
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Users style={{ width: 14, height: 14, color: 'var(--gold-text)' }} />
            <span className="form-label" style={{ marginBottom: 0 }}>Venda em Conjunto (opcional)</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Adicione outros vendedores que participaram dessa venda junto com {header.vendedor ? (vendedores.find((v) => v.id === header.vendedor)?.nome ?? 'o vendedor principal') : 'o vendedor principal'}.
          </div>

          {header.vendedoresConjuntos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {header.vendedoresConjuntos.map((id) => {
                const nome = vendedores.find((v) => v.id === id)?.nome ?? '—';
                return (
                  <span
                    key={id}
                    className="badge badge-gold"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '4px 6px 4px 12px' }}
                  >
                    {nome}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 2, color: 'var(--gold-text)' }}
                      aria-label={`Remover ${nome} da venda em conjunto`}
                      title="Remover co-vendedor"
                      onClick={() => removeCoVendedor(id)}
                    >
                      <X style={{ width: 11, height: 11 }} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addCoVendedor(novoCoVendedor);
              setNovoCoVendedor('');
            }}
          >
            <select
              className="form-input"
              style={{ maxWidth: 260 }}
              aria-label="Selecionar co-vendedor"
              value={novoCoVendedor}
              onChange={(e) => setNovoCoVendedor(e.target.value)}
            >
              <option value="">Selecione um vendedor...</option>
              {vendedores
                .filter((v) => v.id !== header.vendedor && !header.vendedoresConjuntos.includes(v.id))
                .map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            <button type="submit" className="btn btn-outline btn-sm" disabled={!novoCoVendedor}>
              <Plus style={{ width: 13, height: 13 }} /> Adicionar
            </button>
          </form>
        </div>
      </div>

      <div className="card p-5 mb-5 rise-in" style={{ animationDelay: '.09s' }}>
        <div className="flex items-center gap-2 mb-1">
          <Home style={{ width: 15, height: 15, color: 'var(--gold-text)' }} />
          <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 14 }}>Ambientes desta proposta</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Defina os ambientes (sala de estar, cozinha, suíte 1...) antes de adicionar os itens — cada produto será relacionado a um deles.
        </div>

        {header.ambientes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {header.ambientes.map((a) => (
              <span
                key={a}
                className="badge badge-gold"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '4px 6px 4px 12px' }}
              >
                {a}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: 2, color: 'var(--gold-text)' }}
                  aria-label={`Remover ambiente ${a}`}
                  title="Remover ambiente"
                  onClick={() => removeAmbiente(a)}
                >
                  <X style={{ width: 11, height: 11 }} />
                </button>
              </span>
            ))}
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddAmbiente(novoAmbiente);
          }}
        >
          <input
            className="form-input"
            style={{ maxWidth: 260 }}
            placeholder="Nome do ambiente (ex.: Sala de Estar)"
            value={novoAmbiente}
            onChange={(e) => setNovoAmbiente(e.target.value)}
            aria-label="Nome do novo ambiente"
          />
          <button type="submit" className="btn btn-outline btn-sm" disabled={!novoAmbiente.trim()}>
            <Plus style={{ width: 13, height: 13 }} /> Adicionar
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {AMBIENTE_SUGGESTIONS.filter((s) => !header.ambientes.includes(s)).map((s) => (
            <button
              key={s}
              className="btn btn-ghost btn-sm"
              style={{ border: '1px dashed var(--border)', fontSize: 11.5 }}
              onClick={() => handleAddAmbiente(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden mb-4 rise-in" style={{ animationDelay: '.12s' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15 }}>Itens da Proposta</span>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={() => setCatalogOpen(true)}>
              <Package style={{ width: 13, height: 13 }} /> Buscar no Catálogo
            </button>
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table" id="proposal-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ width: 120 }}>Ambiente</th>
                  <th style={{ width: 120 }}>Código</th>
                  <th>Descrição</th>
                  <th style={{ width: 80 }}>Qtd</th>
                  <th style={{ width: 140 }}>Preço Unit.</th>
                  <th style={{ width: 90 }}>Desc. %</th>
                  <th style={{ width: 140 }}>Total</th>
                  <th style={{ width: 130 }}>Materiais</th>
                  <th style={{ width: 110 }}>Destaque</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let globalIndex = 0;
                  return groups.map((group) => (
                    <Fragment key={group.ambiente}>
                      {showAmbienteHeaders && (
                        <tr>
                          <td colSpan={11} className="ambiente-bar">
                            <div className="flex items-center justify-between">
                              <span>{group.ambiente}</span>
                              <button className="btn btn-ghost btn-sm" style={{ color: '#fefefe' }} onClick={() => addEmptyRow(group.ambiente === 'Itens Gerais' ? '' : group.ambiente)}>
                                <Plus style={{ width: 12, height: 12 }} /> Item neste ambiente
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {group.items.map((r) => {
                        const i = globalIndex;
                        globalIndex += 1;
                        return <ProposalItemRow key={r.id} row={r} index={i} />;
                      })}
                    </Fragment>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <FilePlus style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>Comece a montar a proposta</div>
            <div style={{ fontSize: 13, maxWidth: 380, textAlign: 'center' }}>
              Adicione móveis do catálogo, digite um código (ex.: <span className="mono" style={{ color: 'var(--gold-text)' }}>GD-CAD-001</span>) ou use o microfone para ditar os itens.
            </div>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-outline btn-sm" onClick={() => setCatalogOpen(true)}>
                <Package style={{ width: 13, height: 13 }} /> Buscar no Catálogo
              </button>
              <button className="btn btn-gold btn-sm" onClick={() => addEmptyRow()}>+ Adicionar primeiro item</button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 mb-5 rise-in" style={{ animationDelay: '.15s' }}>
        <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Checklist de Validação</div>
        <div className="space-y-2.5">
          {validationChecklist.map((item) => (
            <div key={item.label} className="flex items-center gap-2" style={{ fontSize: 13.5 }}>
              {item.done
                ? <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--success)', flexShrink: 0 }} />
                : <Circle style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0 }} />}
              <span style={{ color: item.done ? 'var(--primary)' : 'var(--text-secondary)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap rise-in" style={{ animationDelay: '.18s' }}>
        <div className="card p-4 flex-1" style={{ minWidth: 220 }}>
          <label className="form-label" htmlFor="pObs">Observações para o cliente</label>
          <textarea id="pObs" className="form-input" rows={3} placeholder="Prazo de entrega, condições especiais..." value={header.observacoes} onChange={(e) => setHeaderField('observacoes', e.target.value)} />
        </div>
        <div className="card p-5" style={{ minWidth: 280 }}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Subtotal</span>
              <span className="mono font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Desconto Global</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100} className="proposal-input text-right"
                  style={{ width: 55, border: '1.5px solid var(--border)', borderRadius: 6 }}
                  aria-label="Desconto global em %"
                  value={header.globalDiscount}
                  onChange={(e) => setHeaderField('globalDiscount', parseClamped(e.target.value, 0, 100))}
                />
                <span style={{ color: 'var(--text-secondary)' }}>%</span>
              </div>
            </div>
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center">
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold-text)' }}>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <button className="btn btn-outline flex-1" onClick={handleSave}>
              <Save style={{ width: 14, height: 14 }} /> Salvar
            </button>
            <button className="btn btn-outline flex-1" title="Ver o documento como o cliente verá" onClick={() => setPreviewOpen(true)}>
              <Eye style={{ width: 14, height: 14 }} /> Prévia
            </button>
            <button className="btn btn-outline flex-1" onClick={handlePdf}>
              <FileDown style={{ width: 14, height: 14 }} /> PDF
            </button>
            <div className="relative flex-1" ref={sendMenuRef}>
              <button
                className="btn btn-gold w-full"
                aria-expanded={sendMenuOpen}
                aria-haspopup="menu"
                onClick={() => setSendMenuOpen((v) => !v)}
              >
                <Send style={{ width: 14, height: 14 }} /> Enviar
              </button>
              {sendMenuOpen && (
                <div
                  className="card"
                  role="menu"
                  style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 8px)', width: 200, padding: 6, zIndex: 30 }}
                >
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleSendWhatsApp}>
                    <MessageCircle style={{ width: 14, height: 14 }} /> Via WhatsApp
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleSendEmail}>
                    <Mail style={{ width: 14, height: 14 }} /> Via E-mail
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ProposalPreview open={previewOpen} onClose={() => setPreviewOpen(false)} onGeneratePdf={handlePdf} />
      <CatalogPickerModal open={catalogOpen} onClose={() => setCatalogOpen(false)} />
    </div>
  );
}
