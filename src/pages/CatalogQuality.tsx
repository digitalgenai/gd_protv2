import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, FileWarning, ImageOff, Loader2, Search, Tag } from 'lucide-react';
import { fetchCatalogQuality } from '../api/catalogQuality';
import ErrorState from '../components/ui/ErrorState';
import { useImageModal } from '../context/ImageModalContext';
import { useProducts } from '../context/ProductsContext';
import { buildCatalogHealthProblems, buildCatalogHealthSummary } from '../utils/catalogHealth';
import type { CatalogQualityReport } from '../api/catalogQuality';

const PROBLEM_TABS = [
  { key: '', label: 'Todos' },
  { key: 'Sem imagem', label: 'Sem imagem' },
  { key: 'Sem preço', label: 'Sem preço' },
  { key: 'Duplicado', label: 'Duplicado' },
  { key: 'Erro de importação', label: 'Erro de importação' },
];

export default function CatalogQuality() {
  const navigate = useNavigate();
  const { openImageModal } = useImageModal();
  const { products } = useProducts();
  const [report, setReport] = useState<CatalogQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [problemFilter, setProblemFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchCatalogQuality()
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => buildCatalogHealthSummary(products, report), [products, report]);
  const problems = useMemo(
    () => buildCatalogHealthProblems(summary, (p, tab) => openImageModal(p, tab)),
    [summary, openImageModal],
  );

  const problemCounts = useMemo(() => {
    const counts: Record<string, number> = { '': problems.length };
    problems.forEach((p) => {
      counts[p.problema] = (counts[p.problema] ?? 0) + 1;
    });
    return counts;
  }, [problems]);

  const filteredProblems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return problems.filter((p) => {
      if (problemFilter && p.problema !== problemFilter) return false;
      if (q && !`${p.produto} ${p.fornecedor}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [problems, search, problemFilter]);

  if (loading) {
    return (
      <div className="view active fade-in p-6" style={{ maxWidth: 1200 }}>
        <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 className="spin" style={{ width: 28, height: 28 }} />
          <div style={{ fontSize: 14 }}>Carregando relatório de qualidade...</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="view active fade-in p-6" style={{ maxWidth: 1200 }}>
        <ErrorState message="Não foi possível carregar o relatório de qualidade — verifique se o backend está no ar." onRetry={load} />
      </div>
    );
  }

  return (
    <div className="view active fade-in p-6" style={{ maxWidth: 1200 }}>
      <button className="btn btn-ghost btn-sm mb-3" style={{ color: 'var(--text-secondary)' }} onClick={() => navigate('/catalogo')}>
        <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar ao Catálogo
      </button>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{summary.semImagem.length}</div>
              <div className="kpi-label">Sem imagem</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(221,107,32,.12)' }}>
              <ImageOff style={{ width: 20, height: 20, color: 'var(--warning)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{summary.semPreco.length}</div>
              <div className="kpi-label">Sem preço</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(229,62,62,.1)' }}>
              <Tag style={{ width: 20, height: 20, color: 'var(--error)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{summary.duplicados.length}</div>
              <div className="kpi-label">Possíveis duplicatas</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(133,34,40,.12)' }}>
              <Copy style={{ width: 20, height: 20, color: 'var(--gold-text)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{summary.errosImportacao.length}</div>
              <div className="kpi-label">Erros de importação</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(66,153,225,.1)' }}>
              <FileWarning style={{ width: 20, height: 20, color: '#3182CE' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15 }}>Problemas Identificados</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {filteredProblems.length === problems.length
              ? `${problems.length} iten${problems.length !== 1 ? 's' : ''} no total`
              : `${filteredProblems.length} de ${problems.length} itens`}
          </span>
        </div>

        <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Filtrar por tipo de problema">
            {PROBLEM_TABS.map(({ key, label }) => (
              <button
                key={key || 'todos'}
                role="tab"
                aria-selected={problemFilter === key}
                className="btn btn-ghost btn-sm"
                style={{
                  borderRadius: 0,
                  borderBottom: problemFilter === key ? '2px solid var(--gold)' : '2px solid transparent',
                  color: problemFilter === key ? 'var(--gold-text)' : 'var(--text-secondary)',
                  fontWeight: 700,
                }}
                onClick={() => setProblemFilter(key)}
              >
                {label}
                <span
                  className="badge"
                  style={{
                    marginLeft: 6,
                    background: problemFilter === key ? 'rgba(133,34,40,.12)' : 'var(--bg)',
                    color: problemFilter === key ? 'var(--gold-text)' : 'var(--text-secondary)',
                    fontSize: 11,
                  }}
                >
                  {problemCounts[key] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="relative" style={{ marginLeft: 'auto', minWidth: 220 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#979797' }} />
            <input
              type="text"
              placeholder="Buscar por produto ou fornecedor..."
              className="form-input"
              style={{ paddingLeft: 36 }}
              aria-label="Buscar problema por produto ou fornecedor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredProblems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Problema</th><th>Produto / Fornecedor</th><th>Impacto</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {filteredProblems.map((item) => (
                  <tr key={item.id}>
                    <td><span className={`badge ${item.badgeClass}`}>{item.problema}</span></td>
                    <td>
                      <div className="font-medium">{item.produto}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{item.fornecedor}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.impacto}</td>
                    <td>
                      {item.onAction ? (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--gold-text)', fontWeight: 600 }} onClick={item.onAction}>
                          {item.actionLabel}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : problems.length === 0 ? (
          <div className="p-5" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum problema identificado. 🎉</div>
        ) : (
          <div className="p-5" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum problema encontrado com esses filtros.</div>
        )}
      </div>
    </div>
  );
}
