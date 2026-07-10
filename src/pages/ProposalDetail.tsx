import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, FileCheck, FileX, Pencil, PackageSearch } from 'lucide-react';
import { fetchProposalDetail } from '../api/proposals';
import { useProducts } from '../context/ProductsContext';
import { useProposalDraft, PAYMENT_OPTIONS } from '../context/ProposalDraftContext';
import { useToast } from '../context/ToastContext';
import { groupByAmbiente, orderGroupsByAmbientList, shouldShowAmbienteHeaders } from '../utils/groupByAmbiente';
import { formatCurrency, formatCurrencyRounded } from '../utils/format';
import { STATUS_BADGE, statusBadgeLabel } from '../utils/proposalStatus';
import { VENDEDOR_CODE_BY_DISPLAY_NAME } from '../data/vendedores';
import DocumentSheet from '../components/proposal/DocumentSheet';
import type { ProposalDetail as ProposalDetailType } from '../types';

type Tab = 'resumo' | 'pdf' | 'versoes';

export default function ProposalDetail() {
  const { codigo = '' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { products } = useProducts();
  const { loadDraft } = useProposalDraft();

  const [detail, setDetail] = useState<ProposalDetailType | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('resumo');

  useEffect(() => {
    setDetail(undefined);
    setTab('resumo');
    fetchProposalDetail(codigo).then(setDetail);
  }, [codigo]);

  if (detail === undefined) {
    return (
      <div className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando proposta…</div>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
        <div className="card p-10 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <PackageSearch style={{ width: 36, height: 36, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>Proposta <span className="mono">{codigo}</span> não encontrada.</div>
          <button className="btn btn-outline btn-sm mt-2" onClick={() => navigate('/propostas/historico')}>
            <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar ao Histórico
          </button>
        </div>
      </div>
    );
  }

  const groups = orderGroupsByAmbientList(groupByAmbiente(detail.itens), detail.ambientes);
  const showAmbienteHeaders = shouldShowAmbienteHeaders(groups);
  const subtotal = detail.itens.reduce((s, r) => s + r.qty * r.price * (1 - r.disc / 100), 0);
  const globalDiscount = 0; // desconto global não é registrado no histórico mock — só por item.
  const validadeDate = detail.validade ? new Date(`${detail.validade}T00:00:00`) : null;

  function handleEditAsNewVersion() {
    const vendedorCode = VENDEDOR_CODE_BY_DISPLAY_NAME[detail!.vendedor] ?? '';
    loadDraft(
      {
        cliente: detail!.cliente,
        arquiteto: detail!.arquiteto ?? '',
        vendedor: vendedorCode,
        validade: detail!.validade,
        pagamento: PAYMENT_OPTIONS.includes(detail!.pagamento) ? detail!.pagamento : PAYMENT_OPTIONS[0],
        versao: detail!.versao + 1,
        observacoes: detail!.observacoes,
        globalDiscount: 0,
        vendaDireta: detail!.vendaDireta,
        ambientes: detail!.ambientes,
      },
      detail!.itens,
    );
    showToast(`Nova versão v${detail!.versao + 1} criada a partir de ${detail!.code}.`, 'success');
    navigate('/propostas/nova');
  }

  return (
    <div className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <button className="btn btn-ghost btn-sm mb-3" style={{ color: 'var(--text-secondary)' }} onClick={() => navigate('/propostas/historico')}>
        <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar ao Histórico
      </button>

      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="mono" style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{detail.code}</span>
              <span className={`badge ${STATUS_BADGE[detail.status]}`}>{statusBadgeLabel(detail.status)}</span>
              <span className="badge badge-gold">v{detail.versao}</span>
            </div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 19 }}>{detail.cliente}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              {detail.arquiteto ? `${detail.arquiteto} · ` : ''}Vendedor: {detail.vendedor} · {detail.data}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-secondary)' }}>Valor Total</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>{formatCurrencyRounded(detail.valor)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(detail!.code).catch(() => {});
              showToast('Código copiado!', 'info');
            }}
          >
            <Copy style={{ width: 13, height: 13 }} /> Copiar código
          </button>
          <button className="btn btn-gold btn-sm" onClick={handleEditAsNewVersion}>
            <Pencil style={{ width: 13, height: 13 }} /> Editar (Nova Versão)
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {([
          ['resumo', 'Resumo'],
          ['pdf', 'PDF'],
          ['versoes', `Versões (${detail.versoes.length})`],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            className="btn btn-ghost btn-sm"
            style={{
              borderRadius: 0,
              borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent',
              color: tab === id ? 'var(--gold)' : 'var(--text-secondary)',
              fontWeight: 700,
            }}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumo' && (
        <div className="card overflow-hidden">
          {groups.map((group) => (
            <div key={group.ambiente}>
              {showAmbienteHeaders && <div className="ambiente-bar">{group.ambiente}</div>}
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>Preço Unit.</th><th>Desc.</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {group.items.map((r) => {
                    const product = products.find((p) => p.id === r.code);
                    const lineTotal = r.qty * r.price * (1 - r.disc / 100);
                    return (
                      <tr key={r.id}>
                        <td><span className="mono text-xs" style={{ color: 'var(--gold)' }}>{r.code}</span></td>
                        <td>
                          {r.desc}
                          {product && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{product.supplier} · {product.finish}</div>}
                        </td>
                        <td>{r.qty}</td>
                        <td className="mono">{formatCurrency(r.price)}</td>
                        <td>{r.disc > 0 ? <span className="badge badge-warning">{r.disc}%</span> : '—'}</td>
                        <td className="mono font-semibold">{formatCurrency(lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          ))}
          <div className="p-5 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 480 }}>
              {detail.observacoes || 'Sem observações registradas.'}
              <div style={{ marginTop: 4 }}>Condição de pagamento: <strong style={{ color: 'var(--primary)' }}>{detail.pagamento}</strong></div>
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{formatCurrency(subtotal)}</div>
          </div>
        </div>
      )}

      {tab === 'pdf' && (
        <div className="card" style={{ padding: 24, background: 'var(--bg)' }}>
          <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,.12)' }}>
            <DocumentSheet
              codeDisplay={detail.code}
              cliente={detail.cliente}
              arquiteto={detail.arquiteto ?? ''}
              vendedorLabel={detail.vendedor}
              pagamento={detail.pagamento}
              validadeDate={validadeDate}
              vendaDireta={detail.vendaDireta}
              groups={groups}
              showAmbienteHeaders={showAmbienteHeaders}
              products={products}
              subtotal={subtotal}
              globalDiscount={globalDiscount}
              total={subtotal}
              observacoes={detail.observacoes}
            />
          </div>
        </div>
      )}

      {tab === 'versoes' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Código</th><th>Versão</th><th>Status</th><th>Data</th><th style={{ textAlign: 'center' }}>PDF</th><th /></tr>
            </thead>
            <tbody>
              {detail.versoes.map((v) => (
                <tr key={v.code}>
                  <td><span className="mono text-xs" style={{ color: 'var(--gold)' }}>{v.code}</span></td>
                  <td><span className="badge badge-gold">v{v.versao}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[v.status]}`}>{statusBadgeLabel(v.status)}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{v.data}</td>
                  <td style={{ textAlign: 'center' }}>
                    {v.pdfGerado
                      ? <FileCheck style={{ width: 15, height: 15, color: '#3182CE', display: 'inline-block' }} />
                      : <FileX style={{ width: 15, height: 15, color: 'var(--text-secondary)', display: 'inline-block' }} />}
                  </td>
                  <td>
                    {v.code !== detail.code && (
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/propostas/${encodeURIComponent(v.code)}`)}>
                        Abrir esta versão
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
