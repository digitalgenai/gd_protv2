import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, PencilRuler, Search } from 'lucide-react';
import { fetchArquitetos } from '../api/clientes';
import ErrorState from '../components/ui/ErrorState';
import { formatCurrencyRounded } from '../utils/format';
import type { ArquitetoSummary } from '../types';

export default function Arquitetos() {
  const [arquitetos, setArquitetos] = useState<ArquitetoSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchArquitetos()
      .then(setArquitetos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar os arquitetos.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return arquitetos;
    return arquitetos.filter((a) => a.nome.toLowerCase().includes(q));
  }, [arquitetos, search]);

  return (
    <div id="view-arquitetos" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16, maxWidth: 720 }}>
        Diretório de arquitetos/escritórios parceiros, sincronizado a partir do CRM da empresa (EngajaCRM).
        O cadastro de novos arquitetos é feito lá. Propostas/valor total somam as negociações já registradas no CRM
        com as propostas criadas aqui no nosso sistema.
      </div>

      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="relative" style={{ maxWidth: 360, flex: 1, minWidth: 220 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#979797' }} />
          <input
            type="text"
            placeholder="Buscar arquiteto..."
            className="form-input"
            style={{ paddingLeft: 36 }}
            aria-label="Buscar arquiteto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="spin" style={{ width: 28, height: 28 }} />
            <div style={{ fontSize: 14 }}>Carregando arquitetos...</div>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Arquiteto</th><th>Escritório</th><th>Propostas</th><th>Valor Total</th><th>Última Proposta</th></tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.nome}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{a.escritorio || '—'}</td>
                    <td><span className="badge badge-gold">{a.propostas}</span></td>
                    <td><span className="mono font-semibold">{formatCurrencyRounded(a.valorTotal)}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{a.ultimaProposta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <PencilRuler style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhum arquiteto encontrado.</div>
          </div>
        )}
      </div>
    </div>
  );
}
