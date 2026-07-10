import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Copy, FileWarning, ImageOff, Tag } from 'lucide-react';
import { fetchCatalogQuality } from '../api/catalogQuality';
import { useImageModal } from '../context/ImageModalContext';
import { useProducts } from '../context/ProductsContext';
import { buildCatalogHealthProblems, buildCatalogHealthSummary } from '../utils/catalogHealth';
import type { CatalogQualityReport } from '../data/mockCatalogQuality';

export default function CatalogQuality() {
  const navigate = useNavigate();
  const { openImageModal } = useImageModal();
  const { products } = useProducts();
  const [report, setReport] = useState<CatalogQualityReport | null>(null);

  useEffect(() => {
    fetchCatalogQuality().then(setReport);
  }, []);

  const summary = useMemo(() => buildCatalogHealthSummary(products, report), [products, report]);
  const problems = useMemo(
    () => buildCatalogHealthProblems(summary, (p, tab) => openImageModal(p, tab)),
    [summary, openImageModal],
  );

  if (!report) {
    return (
      <div className="view active fade-in p-6" style={{ maxWidth: 1200 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando relatório de qualidade…</div>
      </div>
    );
  }

  return (
    <div className="view active fade-in p-6" style={{ maxWidth: 1200 }}>
      <button className="btn btn-ghost btn-sm mb-3" style={{ color: 'var(--text-secondary)' }} onClick={() => navigate('/catalogo')}>
        <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar ao Catálogo
      </button>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
              <div className="kpi-value">{summary.imagensRejeitadas.length}</div>
              <div className="kpi-label">Imagens rejeitadas</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(229,62,62,.1)' }}>
              <AlertTriangle style={{ width: 20, height: 20, color: 'var(--error)' }} />
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="kpi-value">{summary.duplicados.length}</div>
              <div className="kpi-label">Possíveis duplicatas</div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(123,29,52,.12)' }}>
              <Copy style={{ width: 20, height: 20, color: 'var(--gold)' }} />
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
          <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 15 }}>Problemas Identificados</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{problems.length} iten{problems.length !== 1 ? 's' : ''} no total</span>
        </div>
        {problems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Problema</th><th>Produto / Fornecedor</th><th>Impacto</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {problems.map((item) => (
                  <tr key={item.id}>
                    <td><span className={`badge ${item.badgeClass}`}>{item.problema}</span></td>
                    <td>
                      <div className="font-medium">{item.produto}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{item.fornecedor}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.impacto}</td>
                    <td>
                      {item.onAction ? (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--gold)', fontWeight: 600 }} onClick={item.onAction}>
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
        ) : (
          <div className="p-5" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum problema identificado. 🎉</div>
        )}
      </div>
    </div>
  );
}
