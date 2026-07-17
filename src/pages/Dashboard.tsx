import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, DollarSign, FileText, Loader2, Package, Percent, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchCatalogQuality } from '../api/catalogQuality';
import { fetchDashboardKpis, type DashboardKpis } from '../api/dashboard';
import { fetchProposals } from '../api/proposals';
import ErrorState from '../components/ui/ErrorState';
import { useProducts } from '../context/ProductsContext';
// Voz: modo de gravação por áudio adiado para a v2 — ver App.tsx/Layout.tsx/Sidebar.tsx.
// import { useVoz } from '../context/VozContext';
import { buildCatalogHealthSummary } from '../utils/catalogHealth';
import { formatCurrencyRounded } from '../utils/format';
import type { CatalogQualityReport } from '../api/catalogQuality';
import type { ProposalSummary } from '../types';

const STATUS_BADGE: Record<string, string> = {
  Aprovada: 'badge-success',
  Enviada: 'badge-info',
  Rascunho: 'badge-draft',
  Reprovada: 'badge-error',
  Revisão: 'badge-warning',
};

function pctDelta(atual: number, anterior: number): { text: string; up: boolean } | null {
  if (anterior === 0) {
    if (atual === 0) return null;
    return { text: 'Novo vs. mês anterior', up: true };
  }
  const diff = Math.round(((atual - anterior) / anterior) * 100);
  return { text: `${diff >= 0 ? '+' : ''}${diff}% vs. mês anterior`, up: diff >= 0 };
}

function Delta({ delta }: { delta: { text: string; up: boolean } | null }) {
  if (!delta) return null;
  const Icon = delta.up ? TrendingUp : TrendingDown;
  return (
    <div className={`kpi-delta ${delta.up ? 'up' : 'down'} flex items-center gap-1`}>
      <Icon style={{ width: 13, height: 13 }} /> {delta.text}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const [qualityReport, setQualityReport] = useState<CatalogQualityReport | null>(null);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([fetchDashboardKpis(), fetchProposals()])
      .then(([kpisResult, proposalsResult]) => {
        setKpis(kpisResult);
        setProposals(proposalsResult);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchCatalogQuality().then(setQualityReport);
  }, []);

  const health = useMemo(() => buildCatalogHealthSummary(products, qualityReport), [products, qualityReport]);
  const recent = useMemo(() => proposals.slice(0, 5), [proposals]);

  const periodoFaturamento = useMemo(() => {
    const hoje = new Date();
    const mes = hoje.toLocaleDateString('pt-BR', { month: 'long' });
    return `01 a ${hoje.getDate().toString().padStart(2, '0')} de ${mes}`;
  }, []);

  if (loading) {
    return (
      <div id="view-dashboard" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
        <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 className="spin" style={{ width: 28, height: 28 }} />
          <div style={{ fontSize: 14 }}>Carregando dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div id="view-dashboard" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
        <ErrorState message="Não foi possível carregar o dashboard — verifique se o backend está no ar." onRetry={load} />
      </div>
    );
  }

  const pipelineTotal = Math.max(1, kpis.pipeline.rascunho + kpis.pipeline.enviada + kpis.pipeline.aprovadaMes);

  return (
    <div id="view-dashboard" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{formatCurrencyRounded(kpis.faturamentoMes)}</div>
              <div className="kpi-label">Faturamento do Mês · {periodoFaturamento}</div>
              <Delta delta={pctDelta(kpis.faturamentoMes, kpis.faturamentoMesAnterior)} />
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(133,34,40,.12)' }}>
              <DollarSign style={{ width: 20, height: 20, color: 'var(--gold-text)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{kpis.propostasEnviadasMes}</div>
              <div className="kpi-label">Propostas Enviadas</div>
              <Delta delta={pctDelta(kpis.propostasEnviadasMes, kpis.propostasEnviadasMesAnterior)} />
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(66,153,225,.1)' }}>
              <FileText style={{ width: 20, height: 20, color: '#3182CE' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{kpis.taxaConversaoMes.toFixed(0)}%</div>
              <div className="kpi-label">Taxa de Conversão</div>
              <Delta delta={pctDelta(kpis.taxaConversaoMes, kpis.taxaConversaoMesAnterior)} />
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,161,105,.1)' }}>
              <Percent style={{ width: 20, height: 20, color: 'var(--success)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{kpis.produtosCatalogo}</div>
              <div className="kpi-label">Produtos no Catálogo</div>
              {kpis.produtosNovosSemana > 0 && (
                <div className="kpi-delta up flex items-center gap-1">
                  <TrendingUp style={{ width: 13, height: 13 }} /> +{kpis.produtosNovosSemana} esta semana
                </div>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(159,122,234,.1)' }}>
              <Package style={{ width: 20, height: 20, color: '#805AD5' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15 }}>Propostas Recentes</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/propostas/historico')}>Ver todas →</button>
          </div>
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Valor</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recent.length > 0 ? recent.map((p) => (
                <tr key={p.code}>
                  <td><span className="mono text-xs" style={{ color: 'var(--gold-text)' }}>{p.code}</span></td>
                  <td>{p.cliente}</td>
                  <td>{p.vendedor}</td>
                  <td><span className="mono">{formatCurrencyRounded(p.valor)}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span></td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>Nenhuma proposta cadastrada ainda.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Rascunhos de Voz — modo de gravação por áudio adiado para a v2
          <div className="card p-5" style={{ borderColor: 'rgba(133,34,40,.3)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(133,34,40,.12)' }}>
                <Mic style={{ width: 18, height: 18, color: 'var(--gold-text)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Rascunhos de Voz</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {rascunhos.length > 0 ? `${rascunhos.length} aguardando revisão` : 'Nenhum aguardando revisão'}
                </div>
              </div>
            </div>
            <button className="btn btn-gold w-full" onClick={() => navigate('/voz')}>
              Revisar Agora
            </button>
          </div>
          */}

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck style={{ width: 16, height: 16, color: 'var(--gold-text)' }} />
              <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 14 }}>Saúde do Catálogo</span>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex justify-between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Produtos sem imagem</span>
                <span className="mono font-semibold" style={{ color: health.semImagem.length ? 'var(--warning)' : 'var(--success)' }}>
                  {health.semImagem.length}
                </span>
              </div>
              <div className="flex justify-between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Produtos sem preço</span>
                <span className="mono font-semibold" style={{ color: health.semPreco.length ? 'var(--error)' : 'var(--success)' }}>
                  {health.semPreco.length}
                </span>
              </div>
              <div className="flex justify-between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Erros de importação</span>
                <span className="mono font-semibold" style={{ color: health.errosImportacao.length ? 'var(--error)' : 'var(--success)' }}>
                  {health.errosImportacao.length}
                </span>
              </div>
            </div>
            <button className="btn btn-outline btn-sm w-full" onClick={() => navigate('/catalogo/qualidade')}>
              Ver painel completo →
            </button>
          </div>

          <div className="card p-5">
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Pipeline de Conversão</div>
            <div className="space-y-3">
              <PipelineRow label="Rascunhos" value={kpis.pipeline.rascunho} pct={(kpis.pipeline.rascunho / pipelineTotal) * 100} />
              <PipelineRow label="Enviadas" value={kpis.pipeline.enviada} pct={(kpis.pipeline.enviada / pipelineTotal) * 100} />
              <PipelineRow label="Aprovadas (mês)" value={kpis.pipeline.aprovadaMes} pct={(kpis.pipeline.aprovadaMes / pipelineTotal) * 100} />
            </div>
          </div>

          {kpis.ultimoImport && (
            <div className="card p-5">
              <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Último Import Drive</div>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: kpis.ultimoImport.status === 'ok' ? 'rgba(56,161,105,.1)' : kpis.ultimoImport.status === 'erro' ? 'rgba(229,62,62,.1)' : 'rgba(66,153,225,.1)' }}
                >
                  <CloudUpload style={{ width: 17, height: 17, color: kpis.ultimoImport.status === 'ok' ? 'var(--success)' : kpis.ultimoImport.status === 'erro' ? 'var(--error)' : '#3182CE' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: kpis.ultimoImport.status === 'ok' ? 'var(--success)' : kpis.ultimoImport.status === 'erro' ? 'var(--error)' : '#3182CE' }}>
                    {kpis.ultimoImport.status === 'ok' ? 'Sucesso' : kpis.ultimoImport.status === 'erro' ? 'Erro' : 'Processando'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={kpis.ultimoImport.nome ?? ''}>
                    {kpis.ultimoImport.fornecedor ? `${kpis.ultimoImport.fornecedor} · ` : ''}
                    {kpis.ultimoImport.processadoEm ? new Date(kpis.ultimoImport.processadoEm).toLocaleDateString('pt-BR') : ''}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineRow({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
        <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{value}</span>
      </div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
