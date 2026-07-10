import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, DollarSign, FileText, Mic, Package, Percent, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchCatalogQuality } from '../api/catalogQuality';
import { useProducts } from '../context/ProductsContext';
import { buildCatalogHealthSummary } from '../utils/catalogHealth';
import { formatCurrencyRounded } from '../utils/format';
import { MOCK_PROPOSALS } from '../data/mockProposals';
import type { CatalogQualityReport } from '../data/mockCatalogQuality';

const STATUS_BADGE: Record<string, string> = {
  Aprovada: 'badge-success',
  Enviada: 'badge-info',
  Rascunho: 'badge-draft',
  Reprovada: 'badge-error',
  Revisão: 'badge-warning',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const recent = MOCK_PROPOSALS.slice(0, 5);
  const { products } = useProducts();
  const [qualityReport, setQualityReport] = useState<CatalogQualityReport | null>(null);

  useEffect(() => {
    fetchCatalogQuality().then(setQualityReport);
  }, []);

  const health = useMemo(() => buildCatalogHealthSummary(products, qualityReport), [products, qualityReport]);

  return (
    <div id="view-dashboard" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="kpi-card card-gold-line">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">R$ 148.700</div>
              <div className="kpi-label">Faturamento do Mês</div>
              <div className="kpi-delta up flex items-center gap-1"><TrendingUp style={{ width: 13, height: 13 }} /> +12% vs. abril</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(123,29,52,.12)' }}>
              <DollarSign style={{ width: 20, height: 20, color: 'var(--gold)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">23</div>
              <div className="kpi-label">Propostas Enviadas</div>
              <div className="kpi-delta up flex items-center gap-1"><TrendingUp style={{ width: 13, height: 13 }} /> +5 este mês</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(66,153,225,.1)' }}>
              <FileText style={{ width: 20, height: 20, color: '#3182CE' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">68%</div>
              <div className="kpi-label">Taxa de Conversão</div>
              <div className="kpi-delta down flex items-center gap-1"><TrendingDown style={{ width: 13, height: 13 }} /> -3% vs. abril</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,161,105,.1)' }}>
              <Percent style={{ width: 20, height: 20, color: 'var(--success)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">247</div>
              <div className="kpi-label">Produtos no Catálogo</div>
              <div className="kpi-delta up flex items-center gap-1"><TrendingUp style={{ width: 13, height: 13 }} /> +18 esta semana</div>
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
            <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 15 }}>Propostas Recentes</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/propostas/historico')}>Ver todas →</button>
          </div>
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Valor</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.code}>
                  <td><span className="mono text-xs" style={{ color: 'var(--gold)' }}>{p.code}</span></td>
                  <td>{p.cliente}</td>
                  <td>{p.vendedor}</td>
                  <td><span className="mono">{formatCurrencyRounded(p.valor)}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-5" style={{ borderColor: 'rgba(123,29,52,.3)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(123,29,52,.12)' }}>
                <Mic style={{ width: 18, height: 18, color: 'var(--gold)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Rascunhos de Voz</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>2 aguardando revisão</div>
              </div>
            </div>
            <button className="btn btn-gold w-full" onClick={() => navigate('/voz')}>
              Revisar Agora
            </button>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck style={{ width: 16, height: 16, color: 'var(--gold)' }} />
              <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 14 }}>Saúde do Catálogo</span>
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
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Pipeline de Conversão</div>
            <div className="space-y-3">
              <PipelineRow label="Propostas Abertas" value={18} pct={75} />
              <PipelineRow label="Em Negociação" value={9} pct={38} />
              <PipelineRow label="Aprovadas (mês)" value={12} pct={50} />
            </div>
          </div>

          <div className="card p-5">
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Último Import Drive</div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,161,105,.1)' }}>
                <CloudUpload style={{ width: 17, height: 17, color: 'var(--success)' }} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--success)' }}>Sucesso</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>18 imagens · hoje 09:14</div>
              </div>
            </div>
          </div>
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
