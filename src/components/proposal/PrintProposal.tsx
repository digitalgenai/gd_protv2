import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useProducts } from '../../context/ProductsContext';
import { useProposalDraft, PAYMENT_OPTIONS } from '../../context/ProposalDraftContext';
import { useVendedores } from '../../context/VendedoresContext';
import { formatCurrency } from '../../utils/format';
import { groupByAmbiente, shouldShowAmbienteHeaders, orderGroupsByAmbientList } from '../../utils/groupByAmbiente';
import { buildHighlightGroups } from '../../utils/proposalHighlight';

export default function PrintProposal() {
  const printRoot = document.getElementById('print-root');
  const { header, rows, proposalCode, subtotal, total } = useProposalDraft();
  const { products } = useProducts();
  const { vendedores } = useVendedores();

  if (!printRoot) return null;

  const groups = orderGroupsByAmbientList(groupByAmbiente(rows), header.ambientes);
  const showAmbienteHeaders = shouldShowAmbienteHeaders(groups);

  // RN: página extra só com itens que têm foto de ambiente (automática ou escolhida manualmente
  // pelo vendedor) — ver ProposalItemRow/proposalHighlight.ts. Agrupada pelos mesmos ambientes
  // da tabela principal, na mesma ordem.
  const highlightGroups = buildHighlightGroups(groups, products);
  const showHighlightAmbienteHeaders = shouldShowAmbienteHeaders(highlightGroups);

  const codeDisplay = proposalCode.replace(/\.CLIENTE$/, '');
  const vendedorPrincipal = vendedores.find((v) => v.id === header.vendedor)?.nome ?? '—';
  const coVendedoresNomes = header.vendedoresConjuntos
    .map((id) => vendedores.find((v) => v.id === id)?.nome)
    .filter((nome): nome is string => Boolean(nome));
  const vendedorDisplay = coVendedoresNomes.length > 0
    ? `${vendedorPrincipal} + ${coVendedoresNomes.join(', ')}`
    : vendedorPrincipal;
  const pagamento = PAYMENT_OPTIONS.includes(header.pagamento) ? header.pagamento : PAYMENT_OPTIONS[0];
  const validadeDate = header.validade ? new Date(`${header.validade}T00:00:00`) : null;

  return createPortal(
    <div id="print-area">
      <div className="pr-topbar" />

      <div className="pr-header">
        <img src="/logo-galpao-bege.avif" alt="Galpão Design" className="pr-logo" />
        <div className="pr-header-right">
          <div className="pr-title">Proposta Comercial</div>
          <div className="pr-code-badge">{codeDisplay}</div>
        </div>
      </div>

      <div className="pr-meta">
        <div className="pr-meta-item"><label>Código</label><span className="pr-code">{codeDisplay}</span></div>
        <div className="pr-meta-item"><label>Cliente</label><span>{header.cliente || '—'}</span></div>
        <div className="pr-meta-item"><label>Telefone</label><span>{header.telefoneCliente || '—'}</span></div>
        <div className="pr-meta-item"><label>E-mail</label><span>{header.emailCliente || '—'}</span></div>
        <div className="pr-meta-item"><label>Endereço</label><span>{header.enderecoCliente || '—'}</span></div>
        <div className="pr-meta-item"><label>Arquiteto / Escritório</label><span>{header.arquiteto || '—'}</span></div>
        <div className="pr-meta-item"><label>Vendedor</label><span>{vendedorDisplay}</span></div>
        <div className="pr-meta-item"><label>Condição de Pagamento</label><span>{pagamento}</span></div>
        <div className="pr-meta-item"><label>Validade</label><span>{validadeDate ? validadeDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</span></div>
      </div>

      <div className="pr-section-title">Itens da Proposta</div>
      <table className="pr-table">
        <thead>
          <tr>
            <th style={{ width: 90 }} />
            <th>Produto</th>
            <th className="pr-center" style={{ width: 44 }}>Qtd</th>
            <th className="pr-right" style={{ width: 110 }}>Preço Unit.</th>
            <th className="pr-center" style={{ width: 64 }}>Desc.</th>
            <th className="pr-right" style={{ width: 110 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.ambiente}>
              {showAmbienteHeaders && (
                <tr>
                  <td colSpan={6} className="pr-ambiente-bar">{group.ambiente}</td>
                </tr>
              )}
              {group.items.map((r) => {
                const lineTotal = r.qty * r.price * (1 - r.disc / 100);
                const product = products.find((p) => p.id === r.code);
                return (
                  <tr key={r.id}>
                    <td style={{ padding: '7px 10px', width: 90 }}>
                      {product?.img && <img src={product.img} className="pr-img" alt={r.desc} />}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <div className="pr-item-code">{r.code}</div>
                      <div className="pr-item-name">
                        {r.desc}
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
                      <div className="pr-item-sub">{product ? `${product.supplier} · ${product.finish}` : ''}</div>
                      {r.materiais.length > 0 && (
                        <div className="pr-item-sub" style={{ marginTop: 3 }}>
                          {r.materiais
                            .filter((m) => m.descricao.trim())
                            .map((m) => `+ ${m.descricao}${m.fornecedor ? ` (${m.fornecedor})` : ''}`)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="pr-num pr-center" style={{ padding: '7px 10px' }}>{r.qty}</td>
                    <td className="pr-num pr-right" style={{ padding: '7px 10px' }}>{formatCurrency(r.price)}</td>
                    <td className="pr-center" style={{ padding: '7px 10px' }}>
                      {r.disc > 0 ? <span className="pr-disc-badge">{r.disc}%</span> : <span style={{ color: '#979797' }}>—</span>}
                    </td>
                    <td className="pr-num pr-right" style={{ padding: '7px 10px', fontWeight: 700, color: '#343434' }}>{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 16px' }}>
        <div className="pr-totals">
          <div className="pr-totals-inner">
            <div className="pr-totals-row">
              <div className="pr-totals-label">Subtotal</div>
              <div className="pr-totals-val">{formatCurrency(subtotal)}</div>
            </div>
            {header.globalDiscount > 0 && (
              <>
                <div className="pr-totals-divider" />
                <div className="pr-totals-row">
                  <div className="pr-totals-label">Desconto Global ({header.globalDiscount}%)</div>
                  <div className="pr-totals-val">− {formatCurrency((subtotal * header.globalDiscount) / 100)}</div>
                </div>
              </>
            )}
          </div>
          <div className="pr-totals-total-row">
            <div className="pr-totals-total-label">TOTAL</div>
            <div className="pr-totals-total-val">{formatCurrency(total)}</div>
          </div>
        </div>
      </div>

      {header.observacoes.trim() && (
        <div className="pr-obs">
          <div className="pr-obs-label">Observações</div>
          <div>{header.observacoes}</div>
        </div>
      )}

      <div className="pr-terms">
        <div className="pr-terms-header">Condições Gerais</div>
        <div className="pr-terms-pag">FORMA DE PAGAMENTO: {pagamento}</div>
        <div className="pr-terms-header" style={{ borderTop: '1px solid #d3d3d3' }}>Observações</div>
        <div className="pr-terms-row">Orçamento válido por até 48h — provável mudança de tabela.</div>
        <div className="pr-terms-row">O prazo de entrega de peças sob encomenda varia de <strong>90 a 120 dias</strong>.</div>
        <div className="pr-terms-row">O prazo máximo de armazenamento em nosso depósito será de <strong>120 dias corridos</strong> após o recebimento.</div>
        <div className="pr-terms-row">Não estão inclusos serviços de fretes para fora de Fortaleza e içamento (peças acima de 2,10m ou tampos com diâmetro acima de 1,50m).</div>
        <div className="pr-terms-row">Produtos de pronta entrega (showroom) devem sempre ser revisados pelo cliente, estando esse ciente que não será realizada troca do produto e nem assistência em possíveis avarias.</div>
      </div>

      <div className="pr-footer">
        <div className="pr-footer-left">
          {validadeDate && <span className="pr-valid-pill">Válida até {validadeDate.toLocaleDateString('pt-BR')}</span>}
        </div>
        <div className="pr-footer-right">
          <div className="pr-footer-brand">Galpão Design</div>
          <div className="pr-footer-contact">contato@galpaodesign.com.br</div>
        </div>
      </div>

      <div className="pr-sign">
        <div className="pr-sign-block">
          <div className="pr-sign-line">
            {vendedorDisplay !== '—'
              ? <div className="pr-sign-name">{vendedorDisplay}</div>
              : <div className="pr-sign-placeholder">Assinatura do Vendedor</div>}
            <div className="pr-sign-role">Galpão Design</div>
          </div>
        </div>
        <div className="pr-sign-block">
          <div className="pr-sign-line">
            {header.cliente.trim()
              ? <div className="pr-sign-name">{header.cliente}</div>
              : <div className="pr-sign-placeholder">Assinatura do Cliente</div>}
            <div className="pr-sign-role">{header.arquiteto}</div>
          </div>
        </div>
      </div>

      <div className="pr-bottombar" />

      {highlightGroups.length > 0 && (
        <div className="pr-highlight-page">
          <div className="pr-topbar" />
          <div className="pr-highlight-header">
            <img src="/logo-galpao-bege.avif" alt="Galpão Design" className="pr-logo" />
            <div className="pr-highlight-title">Itens em Destaque</div>
          </div>
          <div className="pr-highlight-content">
            {highlightGroups.map((g) => (
              <Fragment key={g.ambiente}>
                {showHighlightAmbienteHeaders && <div className="pr-highlight-ambiente-bar">{g.ambiente}</div>}
                <div className={`pr-highlight-grid${g.items.length === 1 ? ' single' : ''}`}>
                  {g.items.map(({ row, product, img }) => (
                    <div key={row.id} className="pr-highlight-card">
                      <img src={img.url} alt={row.desc} className="pr-highlight-img" />
                      <div className="pr-highlight-caption">
                        <div className="pr-highlight-name">{row.desc}</div>
                        <div className="pr-highlight-sub">{row.code}{product ? ` · ${product.supplier}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
          <div className="pr-bottombar" />
        </div>
      )}
    </div>,
    printRoot,
  );
}
