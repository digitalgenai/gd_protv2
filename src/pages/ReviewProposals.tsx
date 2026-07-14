import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Clock, Download, FileCheck, FileDown, FileX, Pencil, Search, Send, ClipboardCheck } from 'lucide-react';
import { fetchProposals } from '../api/proposals';
import { useToast } from '../context/ToastContext';
import { formatCurrencyRounded } from '../utils/format';
import { STATUS_BADGE } from '../utils/proposalStatus';
import type { ProposalSummary } from '../types';

const REVIEW_STATUSES = ['Rascunho', 'Revisão'];

export default function ReviewProposals() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pdfFilter, setPdfFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProposals().then((all) => setProposals(all.filter((p) => REVIEW_STATUSES.includes(p.status))));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return proposals.filter((p) => {
      const text = `${p.code} ${p.cliente} ${p.arquiteto ?? ''} ${p.vendedor}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (pdfFilter === 'sim' && !p.pdfGerado) return false;
      if (pdfFilter === 'nao' && p.pdfGerado) return false;
      if (vendorFilter && p.vendedor !== vendorFilter) return false;
      return true;
    });
  }, [proposals, search, statusFilter, pdfFilter, vendorFilter]);

  const totalValor = proposals.reduce((s, p) => s + p.valor, 0);
  const pdfCount = proposals.filter((p) => p.pdfGerado).length;
  const vendedores = Array.from(new Set(proposals.map((p) => p.vendedor)));

  return (
    <div id="view-review" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{proposals.length}</div>
              <div className="kpi-label">Aguardando revisão</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(221,107,32,.12)' }}>
              <Clock style={{ width: 20, height: 20, color: 'var(--warning)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value mono" style={{ fontSize: 22 }}>{formatCurrencyRounded(totalValor)}</div>
              <div className="kpi-label">Valor total em revisão</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(133,34,40,.12)' }}>
              <Banknote style={{ width: 20, height: 20, color: 'var(--gold-text)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{pdfCount}</div>
              <div className="kpi-label">PDF já gerado</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(66,153,225,.1)' }}>
              <FileDown style={{ width: 20, height: 20, color: '#3182CE' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#979797' }} />
          <input
            type="text"
            placeholder="Buscar por código, cliente..."
            className="form-input"
            style={{ paddingLeft: 36 }}
            aria-label="Buscar proposta em revisão"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-input" style={{ width: 'auto' }} aria-label="Filtrar por status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="Rascunho">Rascunho</option>
          <option value="Revisão">Em Revisão</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} aria-label="Filtrar por PDF" value={pdfFilter} onChange={(e) => setPdfFilter(e.target.value)}>
          <option value="">PDF: Todos</option>
          <option value="sim">PDF gerado</option>
          <option value="nao">Sem PDF</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} aria-label="Filtrar por vendedor" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
          <option value="">Todos os vendedores</option>
          {vendedores.map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th><th>Cliente</th><th>Arquiteto</th><th>Vendedor</th>
                <th>Valor Total</th><th>Data</th><th>Status</th>
                <th style={{ textAlign: 'center' }}>PDF</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.code}>
                  <td><span className="mono text-xs" style={{ color: 'var(--gold-text)' }}>{p.code}</span></td>
                  <td className="font-medium">{p.cliente}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.arquiteto || '—'}</td>
                  <td style={{ fontSize: 13 }}>{p.vendedor}</td>
                  <td><span className="mono font-semibold">{formatCurrencyRounded(p.valor)}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{p.data}</td>
                  <td><span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-draft'}`}>{p.status === 'Revisão' ? 'Em Revisão' : p.status}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    {p.pdfGerado ? (
                      <span title="PDF gerado" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: 'rgba(66,153,225,.1)' }}>
                        <FileCheck style={{ width: 15, height: 15, color: '#3182CE' }} />
                      </span>
                    ) : (
                      <span title="PDF não gerado" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: 'var(--bg)' }}>
                        <FileX style={{ width: 15, height: 15, color: 'var(--text-secondary)' }} />
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Ver / editar proposta"
                        aria-label={`Ver proposta ${p.cliente}`}
                        onClick={() => navigate(`/propostas/${encodeURIComponent(p.code)}`)}
                      >
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title={p.pdfGerado ? 'Baixar PDF' : 'Gerar PDF'}
                        aria-label={`${p.pdfGerado ? 'Baixar' : 'Gerar'} PDF ${p.cliente}`}
                        style={{ color: '#3182CE' }}
                        onClick={() => showToast(p.pdfGerado ? 'Download iniciado!' : 'PDF gerado com sucesso!', 'success')}
                      >
                        {p.pdfGerado ? <Download style={{ width: 14, height: 14 }} /> : <FileDown style={{ width: 14, height: 14 }} />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Enviar proposta"
                        aria-label={`Enviar ${p.cliente}`}
                        style={{ color: 'var(--gold-text)' }}
                        onClick={() => showToast('Proposta enviada por e-mail!', 'success')}
                      >
                        <Send style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <ClipboardCheck style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhuma proposta pendente de revisão.</div>
          </div>
        )}
      </div>
    </div>
  );
}
