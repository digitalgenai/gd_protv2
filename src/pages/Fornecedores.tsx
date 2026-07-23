import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Search, X } from 'lucide-react';
import {
  createFornecedor,
  fetchFornecedores,
  updateFornecedor,
  type FornecedorPayload,
} from '../api/fornecedores';
import ErrorState from '../components/ui/ErrorState';
import { useProducts } from '../context/ProductsContext';
import { useToast } from '../context/ToastContext';
import type { FornecedorSummary } from '../types';

const EMPTY_FORM: FornecedorPayload = { nome: '', site: null, contato: null };

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível salvar o fornecedor.';
}

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<FornecedorSummary[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FornecedorPayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const { showToast } = useToast();
  const { reload: reloadProducts } = useProducts();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchFornecedores()
      .then(setFornecedores)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? fornecedores.filter((f) =>
      [f.nome, f.site, f.contato].some((value) => value?.toLowerCase().includes(q)),
    ) : fornecedores;
  }, [fornecedores, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(fornecedor: FornecedorSummary) {
    setEditingId(fornecedor.id);
    setForm({ nome: fornecedor.nome, site: fornecedor.site, contato: fornecedor.contato });
    setModalOpen(true);
  }

  async function handleSave() {
    const payload = {
      nome: form.nome.trim(),
      site: form.site?.trim() || null,
      contato: form.contato?.trim() || null,
    };
    if (!payload.nome) {
      showToast('Informe o nome do fornecedor.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const saved = editingId
        ? await updateFornecedor(editingId, payload)
        : await createFornecedor(payload);
      setFornecedores((current) => {
        const next = editingId
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [...current, saved];
        return next.sort((a, b) => a.nome.localeCompare(b.nome));
      });
      reloadProducts();
      showToast(editingId ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado no banco.', 'success');
      setModalOpen(false);
    } catch (err) {
      showToast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="view-fornecedores" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 5 }}>Fornecedores</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 680 }}>
            Cadastre aqui as empresas que poderão ser escolhidas nos produtos. Nome, site e contato ficam salvos no banco de dados.
          </p>
        </div>
        <button className="btn btn-gold" onClick={openCreate}>
          <Plus style={{ width: 15, height: 15 }} /> Novo fornecedor
        </button>
      </div>

      <div className="relative mb-5" style={{ maxWidth: 420 }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#979797' }} />
        <input
          type="search"
          placeholder="Buscar por nome, site ou contato..."
          className="form-input"
          style={{ paddingLeft: 36 }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="spin" style={{ width: 28, height: 28 }} />
            <div style={{ fontSize: 14 }}>Carregando fornecedores...</div>
          </div>
        ) : error ? (
          <ErrorState message="Não foi possível carregar os fornecedores." onRetry={load} />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Fornecedor</th><th>Site</th><th>Contato</th><th style={{ width: 64 }}>Ações</th></tr></thead>
              <tbody>
                {filtered.map((fornecedor) => (
                  <tr key={fornecedor.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 7, background: 'var(--bg)' }}>
                          <Building2 style={{ width: 16, height: 16, color: 'var(--gold)' }} />
                        </span>
                        <span className="font-medium">{fornecedor.nome}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {fornecedor.site ? <a href={fornecedor.site.startsWith('http') ? fornecedor.site : `https://${fornecedor.site}`} target="_blank" rel="noreferrer">{fornecedor.site}</a> : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fornecedor.contato || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" aria-label={`Editar ${fornecedor.nome}`} onClick={() => openEdit(fornecedor)}>
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Building2 style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhum fornecedor encontrado.</div>
          </div>
        )}
      </div>

      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} role="dialog" aria-modal="true" onClick={(event) => {
        if (event.target === event.currentTarget && !saving) setModalOpen(false);
      }}>
        <div className="modal-box" style={{ width: 500 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{editingId ? 'Editar fornecedor' : 'Cadastrar fornecedor'}</div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar" disabled={saving} onClick={() => setModalOpen(false)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="form-label" htmlFor="fornecedor-nome">Nome do fornecedor *</label>
              <input id="fornecedor-nome" className="form-input" autoFocus value={form.nome} onChange={(event) => setForm((value) => ({ ...value, nome: event.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="fornecedor-site">Site</label>
              <input id="fornecedor-site" className="form-input" type="url" placeholder="https://..." value={form.site ?? ''} onChange={(event) => setForm((value) => ({ ...value, site: event.target.value }))} />
            </div>
            <div>
              <label className="form-label" htmlFor="fornecedor-contato">Contato</label>
              <input id="fornecedor-contato" className="form-input" placeholder="Nome, telefone ou e-mail" value={form.contato ?? ''} onChange={(event) => setForm((value) => ({ ...value, contato: event.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-outline" disabled={saving} onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-gold" disabled={saving} onClick={handleSave}>
                {saving && <Loader2 className="spin" style={{ width: 14, height: 14 }} />}
                {editingId ? 'Salvar alterações' : 'Cadastrar fornecedor'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
