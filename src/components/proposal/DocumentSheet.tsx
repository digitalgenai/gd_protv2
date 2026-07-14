import { Fragment } from 'react';
import { formatCurrency } from '../../utils/format';
import { shouldShowAmbienteHeaders, type AmbienteGroup } from '../../utils/groupByAmbiente';
import { buildHighlightGroups } from '../../utils/proposalHighlight';
import type { Product, ProposalRow } from '../../types';

export interface DocumentSheetProps {
  codeDisplay: string;
  cliente: string;
  telefoneCliente?: string | null;
  emailCliente?: string | null;
  enderecoCliente?: string | null;
  arquiteto: string;
  vendedorLabel: string;
  pagamento: string;
  validadeDate: Date | null;
  groups: AmbienteGroup<ProposalRow>[];
  showAmbienteHeaders: boolean;
  products: Product[];
  subtotal: number;
  globalDiscount: number;
  total: number;
  observacoes: string;
}

/**
 * Corpo puramente apresentacional do documento de proposta (visual de tela, classes `prv-*`).
 * Recebe os dados via props — não lê contexto — para ser reutilizado tanto pela prévia em tela
 * do rascunho ativo (ProposalPreview) quanto pela aba "PDF" do histórico (ProposalDetail).
 * A árvore de impressão real (PrintProposal, classes `pr-*`) é uma folha de estilo separada e
 * não usa este componente.
 */
export default function DocumentSheet({
  codeDisplay, cliente, telefoneCliente, emailCliente, enderecoCliente, arquiteto, vendedorLabel, pagamento, validadeDate,
  groups, showAmbienteHeaders, products, subtotal, globalDiscount, total, observacoes,
}: DocumentSheetProps) {
  const hasItems = groups.some((g) => g.items.length > 0);

  // Mesma regra da página impressa: itens com foto de ambiente automática ou escolhida
  // manualmente pelo vendedor (ver ProposalItemRow/proposalHighlight.ts), agrupados pelos
  // mesmos ambientes da tabela principal, na mesma ordem.
  const highlightGroups = buildHighlightGroups(groups, products);
  const showHighlightAmbienteHeaders = shouldShowAmbienteHeaders(highlightGroups);

  return (
    <div>
      <div className="prv-topbar" />
      <div className="prv-body">
        <div className="prv-header">
          <img src="/logo-galpao-branca.png" alt="Galpão Design" className="prv-logo" />
          <div>
            <div className="prv-title">Proposta Comercial</div>
            <div style={{ textAlign: 'right' }}><span className="prv-code-badge">{codeDisplay}</span></div>
          </div>
        </div>

        <div className="prv-meta">
          <div className="prv-meta-item"><label>Código</label><span className="prv-code">{codeDisplay}</span></div>
          <div className="prv-meta-item"><label>Cliente</label><span>{cliente || '—'}</span></div>
          <div className="prv-meta-item"><label>Telefone</label><span>{telefoneCliente || '—'}</span></div>
          <div className="prv-meta-item"><label>E-mail</label><span>{emailCliente || '—'}</span></div>
          <div className="prv-meta-item"><label>Endereço</label><span>{enderecoCliente || '—'}</span></div>
          <div className="prv-meta-item"><label>Arquiteto / Escritório</label><span>{arquiteto || '—'}</span></div>
          <div className="prv-meta-item"><label>Vendedor</label><span>{vendedorLabel}</span></div>
          <div className="prv-meta-item"><label>Condição de Pagamento</label><span>{pagamento}</span></div>
          <div className="prv-meta-item"><label>Validade</label><span>{validadeDate ? validadeDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</span></div>
        </div>

        <div className="prv-section-title">Itens da Proposta</div>
        <div className="overflow-x-auto">
        <table className="prv-table">
          <thead>
            <tr>
              <th style={{ width: 88 }} />
              <th>Produto</th>
              <th className="prv-center" style={{ width: 44 }}>Qtd</th>
              <th className="prv-right" style={{ width: 100 }}>Preço Unit.</th>
              <th className="prv-center" style={{ width: 56 }}>Desc.</th>
              <th className="prv-right" style={{ width: 100 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {!hasItems && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#979797', padding: '22px 0', fontStyle: 'italic' }}>
                  Nenhum item adicionado ainda — os itens aparecerão aqui.
                </td>
              </tr>
            )}
            {groups.map((group) => (
              <Fragment key={group.ambiente}>
                {showAmbienteHeaders && (
                  <tr><td colSpan={6} className="prv-ambiente-bar">{group.ambiente}</td></tr>
                )}
                {group.items.map((r) => {
                  const lineTotal = r.qty * r.price * (1 - r.disc / 100);
                  const product = products.find((p) => p.id === r.code);
                  return (
                    <tr key={r.id}>
                      <td>{product?.img && <img src={product.img} className="prv-img" alt={r.desc} />}</td>
                      <td>
                        <div className="prv-item-code">{r.code}</div>
                        <div className="prv-item-name">
                          {r.desc || <span style={{ color: '#979797', fontStyle: 'italic' }}>Sem descrição</span>}
                          {product?.vendaDireta && (
                            <span
                              style={{
                                marginLeft: 6, fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                                padding: '1.5px 7px', borderRadius: 20, display: 'inline-block', verticalAlign: 'middle',
                                background: 'rgba(133,34,40,.1)', color: '#852228', border: '1px solid rgba(133,34,40,.3)',
                              }}
                            >
                              Venda Direta
                            </span>
                          )}
                        </div>
                        <div className="prv-item-sub">{product ? `${product.supplier} · ${product.finish}` : ''}</div>
                        {r.materiais.filter((m) => m.descricao.trim()).length > 0 && (
                          <div className="prv-item-sub">
                            {r.materiais
                              .filter((m) => m.descricao.trim())
                              .map((m) => `+ ${m.descricao}${m.fornecedor ? ` (${m.fornecedor})` : ''}`)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="prv-num prv-center">{r.qty}</td>
                      <td className="prv-num prv-right">{formatCurrency(r.price)}</td>
                      <td className="prv-center" style={{ fontSize: 10.5, color: r.disc > 0 ? '#DD6B20' : '#979797', fontWeight: 700 }}>
                        {r.disc > 0 ? `${r.disc}%` : '—'}
                      </td>
                      <td className="prv-num prv-right" style={{ fontWeight: 700 }}>{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>

        <div className="prv-totals">
          <div className="prv-totals-inner">
            <div className="prv-totals-row"><span>Subtotal</span><span className="val">{formatCurrency(subtotal)}</span></div>
            {globalDiscount > 0 && (
              <div className="prv-totals-row">
                <span>Desconto Global ({globalDiscount}%)</span>
                <span className="val">− {formatCurrency((subtotal * globalDiscount) / 100)}</span>
              </div>
            )}
          </div>
          <div className="prv-totals-total">
            <span className="lbl">TOTAL</span>
            <span className="val">{formatCurrency(total)}</span>
          </div>
        </div>

        {observacoes.trim() && (
          <div className="prv-terms" style={{ marginBottom: 14 }}>
            <div className="prv-terms-header">Observações</div>
            <div className="prv-terms-row">{observacoes}</div>
          </div>
        )}

        <div className="prv-terms">
          <div className="prv-terms-header">Condições Gerais</div>
          <div className="prv-terms-row" style={{ fontWeight: 600, color: '#343434' }}>FORMA DE PAGAMENTO: {pagamento}</div>
          <div className="prv-terms-row">Orçamento válido por até 48h — provável mudança de tabela.</div>
          <div className="prv-terms-row">O prazo de entrega de peças sob encomenda varia de <strong>90 a 120 dias</strong>.</div>
          <div className="prv-terms-row">O prazo máximo de armazenamento em nosso depósito será de <strong>120 dias corridos</strong> após o recebimento.</div>
          <div className="prv-terms-row">Não estão inclusos serviços de fretes para fora de Fortaleza e içamento (peças acima de 2,10m ou tampos com diâmetro acima de 1,50m).</div>
          <div className="prv-terms-row">Produtos de pronta entrega (showroom) devem sempre ser revisados pelo cliente, estando esse ciente que não será realizada troca do produto e nem assistência em possíveis avarias.</div>
        </div>

        <div className="prv-sign">
          <div className="prv-sign-line">
            {vendedorLabel !== '—'
              ? <div className="prv-sign-name">{vendedorLabel}</div>
              : <div className="prv-sign-placeholder">Assinatura do Vendedor</div>}
            <div className="prv-sign-role">Galpão Design</div>
          </div>
          <div className="prv-sign-line">
            {cliente.trim()
              ? <div className="prv-sign-name">{cliente}</div>
              : <div className="prv-sign-placeholder">Assinatura do Cliente</div>}
            <div className="prv-sign-role">{arquiteto}</div>
          </div>
        </div>
      </div>
      <div className="prv-bottombar" />

      {highlightGroups.length > 0 && (
        <>
          <div className="prv-page-break">Nova página no PDF</div>
          <div className="prv-topbar" />
          <div className="prv-body">
            <div className="prv-highlight-header">
              <img src="/logo-galpao-branca.png" alt="Galpão Design" className="prv-logo" />
              <div className="prv-title">Itens em Destaque</div>
            </div>
            {highlightGroups.map((g) => (
              <Fragment key={g.ambiente}>
                {showHighlightAmbienteHeaders && <div className="prv-highlight-ambiente-bar">{g.ambiente}</div>}
                <div className={`prv-highlight-grid${g.items.length === 1 ? ' single' : ''}`}>
                  {g.items.map(({ row, product, img }) => (
                    <div key={row.id} className="prv-highlight-card">
                      <img src={img.url} alt={row.desc} className="prv-highlight-img" />
                      <div className="prv-highlight-caption">
                        <div className="prv-highlight-name">{row.desc}</div>
                        <div className="prv-highlight-sub">{row.code}{product ? ` · ${product.supplier}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
          <div className="prv-bottombar" />
        </>
      )}
    </div>
  );
}
