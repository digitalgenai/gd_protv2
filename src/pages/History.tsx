import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, FileSearch, Search } from 'lucide-react';
import { fetchProposals } from '../api/proposals';
import { useToast } from '../context/ToastContext';
import { formatCurrencyRounded } from '../utils/format';
import { STATUS_BADGE, statusBadgeLabel } from '../utils/proposalStatus';
import type { ProposalStatus, ProposalSummary } from '../types';

function parseDataBr(data: string): Date {
  const [dd, mm, yyyy] = data.split('/').map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1);
}

const STATUS_TABS: { key: ProposalStatus | ''; label: string }[] = [
  { key: '', label: 'Todas' },
  { key: 'Rascunho', label: 'Rascunho' },
  { key: 'Revisão', label: 'Em Revisão' },
  { key: 'Enviada', label: 'Enviada' },
  { key: 'Aprovada', label: 'Aprovada' },
  { key: 'Reprovada', label: 'Reprovada' },
];

export default function History() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [periodDays, setPeriodDays] = useState<number>(0);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProposals().then(setProposals);
  }, []);

  const vendedores = useMemo(() => Array.from(new Set(proposals.map((p) => p.vendedor))), [proposals]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': proposals.length };
    proposals.forEach((p) => {
      counts[p.status] = (counts[p.status] ?? 0) + 1;
    });
    return counts;
  }, [proposals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = periodDays > 0 ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;
    return proposals.filter((p) => {
      const text = `${p.code} ${p.cliente} ${p.arquiteto ?? ''} ${p.vendedor}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (vendorFilter && p.vendedor !== vendorFilter) return false;
      if (cutoff && parseDataBr(p.data) < cutoff) return false;
      return true;
    });
  }, [proposals, search, statusFilter, vendorFilter, periodDays]);

  function openDetail(p: ProposalSummary) {
    navigate(`/propostas/${encodeURIComponent(p.code)}`);
  }

  return (
    <div id="view-history" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="flex items-center gap-1 mb-4 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }} role="tablist" aria-label="Filtrar propostas por status">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key || 'todas'}
            role="tab"
            aria-selected={statusFilter === key}
            className="btn btn-ghost btn-sm"
            style={{
              borderRadius: 0,
              borderBottom: statusFilter === key ? '2px solid var(--gold)' : '2px solid transparent',
              color: statusFilter === key ? 'var(--gold)' : 'var(--text-secondary)',
              fontWeight: 700,
            }}
            onClick={() => setStatusFilter(key)}
          >
            {label}
            <span
              className="badge"
              style={{
                marginLeft: 6,
                background: statusFilter === key ? 'rgba(123,29,52,.12)' : 'var(--bg)',
                color: statusFilter === key ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: 11,
              }}
            >
              {statusCounts[key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#71717A' }} />
          <input
            type="text"
            placeholder="Buscar por código, cliente..."
            className="form-input"
            style={{ paddingLeft: 36 }}
            aria-label="Buscar proposta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-input" style={{ width: 'auto' }} aria-label="Filtrar por vendedor" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
          <option value="">Todos os vendedores</option>
          {vendedores.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} aria-label="Filtrar por período" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
          <option value={0}>Todo o período</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={365}>Este ano</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Código</th><th>Cliente</th><th>Arquiteto</th><th>Vendedor</th><th>Valor Total</th><th>Data</th><th>Versão</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.code}
                  onClick={() => openDetail(p)}
                  style={{ cursor: 'pointer' }}
                  title="Ver detalhe da proposta"
                >
                  <td><span className="mono text-xs" style={{ color: 'var(--gold)' }}>{p.code}</span></td>
                  <td className="font-medium">{p.cliente}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.arquiteto || '—'}</td>
                  <td>{p.vendedor}</td>
                  <td><span className="mono font-semibold">{formatCurrencyRounded(p.valor)}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{p.data}</td>
                  <td><span className="badge badge-gold">v{p.versao}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{statusBadgeLabel(p.status)}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" aria-label="Abrir proposta" title="Abrir proposta" onClick={() => openDetail(p)}>
                        <Eye style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        aria-label="Duplicar"
                        title="Duplicar proposta"
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast(`Proposta ${p.code} duplicada como rascunho.`, 'success');
                        }}
                      >
                        <Copy style={{ width: 14, height: 14 }} />
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
            <FileSearch style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhuma proposta encontrada com esses filtros.</div>
            <button
              className="btn btn-outline btn-sm mt-1"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setVendorFilter('');
                setPeriodDays(0);
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
