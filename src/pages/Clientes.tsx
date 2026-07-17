import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Search, Users, X } from 'lucide-react';
import { fetchClientes } from '../api/clientes';
import ErrorState from '../components/ui/ErrorState';
import { useToast } from '../context/ToastContext';
import { formatCurrencyRounded, formatPhoneBR } from '../utils/format';
import type { ClienteSummary } from '../types';

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteSummary[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', telefone: '', endereco: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchClientes()
      .then(setClientes)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(q));
  }, [clientes, search]);

  function openEdit(c: ClienteSummary) {
    setEditingId(c.id);
    setForm({ nome: c.nome, telefone: c.telefone ?? '', endereco: c.endereco ?? '' });
    setModalOpen(true);
  }

  function handleSave() {
    const nome = form.nome.trim();
    if (!nome) {
      showToast('Informe o nome do cliente.', 'warning');
      return;
    }
    setClientes((prev) => prev.map((c) => (c.id === editingId
      ? { ...c, nome, telefone: form.telefone.trim() || null, endereco: form.endereco.trim() || null }
      : c)));
    showToast('Cliente atualizado.', 'success');
    setModalOpen(false);
  }

  return (
    <div id="view-clientes" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16, maxWidth: 720 }}>
        Diretório de clientes, hoje derivado das propostas já criadas. O cadastro de novos clientes passa a ser feito no CRM da empresa —
        em breve esta lista vai puxar de lá via integração (MCP).
      </div>

      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="relative" style={{ maxWidth: 360, flex: 1, minWidth: 220 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#979797' }} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            className="form-input"
            style={{ paddingLeft: 36 }}
            aria-label="Buscar cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="spin" style={{ width: 28, height: 28 }} />
            <div style={{ fontSize: 14 }}>Carregando clientes...</div>
          </div>
        ) : error ? (
          <ErrorState message="Não foi possível carregar os clientes — verifique se o backend está no ar." onRetry={load} />
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Cliente</th><th>Telefone</th><th>Endereço</th><th>Propostas</th><th>Valor Total</th><th>Última Proposta</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">
                      {c.nome}
                      {c.cadastradoManualmente && <span className="badge badge-draft" style={{ marginLeft: 8, fontSize: 10 }}>Cadastro manual</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.telefone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.endereco || '—'}</td>
                    <td><span className="badge badge-gold">{c.propostas}</span></td>
                    <td><span className="mono font-semibold">{formatCurrencyRounded(c.valorTotal)}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.ultimaProposta}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" aria-label={`Editar ${c.nome}`} onClick={() => openEdit(c)}>
                        <Pencil style={{ width: 13, height: 13 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Users style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhum cliente encontrado.</div>
          </div>
        )}
      </div>

      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <div className="modal-box" style={{ width: 460 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 16 }}>
              Editar Cliente
            </div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar" onClick={() => setModalOpen(false)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="form-label" htmlFor="cli-nome">Nome *</label>
              <input id="cli-nome" className="form-input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="cli-tel">Telefone</label>
              <input
                id="cli-tel"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                maxLength={15}
                className="form-input"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: formatPhoneBR(e.target.value) }))}
              />
            </div>
            <div className="mb-2">
              <label className="form-label" htmlFor="cli-end">Endereço</label>
              <input id="cli-end" className="form-input" value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSave}>Salvar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
