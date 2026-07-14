import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import { fetchFornecedores } from '../api/fornecedores';
import ErrorState from '../components/ui/ErrorState';
import { useToast } from '../context/ToastContext';
import type { FornecedorSummary } from '../types';

const EMPTY_FORM = { nome: '', logoUrl: '', site: '', contato: '' };

/**
 * Edição/cadastro ainda é front-only (sem coluna de logo/site/contato no banco), mas a lista
 * base sempre vem do backend (tabela `fornecedores`) — o que fica no localStorage é só a
 * camada de edições locais (overrides) e os fornecedores criados manualmente que não existem
 * no banco, para não sumirem quando um fornecedor novo for cadastrado no banco de verdade.
 */
const OVERRIDES_KEY = 'galpao:fornecedores:overrides';
const MANUAL_KEY = 'galpao:fornecedores:manual';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Miniatura de logo com fundo neutro (para logos claras não desaparecerem) e fallback caso a imagem falhe ao carregar. */
function LogoThumb({ src, alt, size = 34 }: { src: string | null; alt: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={alt}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }}
        />
      ) : (
        <Building2 style={{ width: size * 0.45, height: size * 0.45, color: 'var(--text-secondary)' }} />
      )}
    </div>
  );
}

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<FornecedorSummary[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchFornecedores()
      .then((base) => {
        const overrides = loadJSON<Record<string, Partial<FornecedorSummary>>>(OVERRIDES_KEY, {});
        const manual = loadJSON<FornecedorSummary[]>(MANUAL_KEY, []);
        const baseIds = new Set(base.map((f) => f.id));
        const merged = base.map((f) => (overrides[f.id] ? { ...f, ...overrides[f.id] } : f));
        const extras = manual.filter((m) => !baseIds.has(m.id));
        setFornecedores([...merged, ...extras].sort((a, b) => a.nome.localeCompare(b.nome)));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fornecedores;
    return fornecedores.filter((f) => f.nome.toLowerCase().includes(q));
  }, [fornecedores, search]);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(f: FornecedorSummary) {
    setEditingId(f.id);
    setForm({ nome: f.nome, logoUrl: f.logoUrl ?? '', site: f.site ?? '', contato: f.contato ?? '' });
    setModalOpen(true);
  }

  function handleLogoFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  function handleSave() {
    const nome = form.nome.trim();
    if (!nome) {
      showToast('Informe o nome do fornecedor.', 'warning');
      return;
    }
    const patch = { nome, logoUrl: form.logoUrl.trim() || null, site: form.site.trim() || null, contato: form.contato.trim() || null };

    if (editingId) {
      const atualizado = fornecedores.map((f) => (f.id === editingId ? { ...f, ...patch } : f));
      setFornecedores(atualizado.sort((a, b) => a.nome.localeCompare(b.nome)));

      const overrides = loadJSON<Record<string, Partial<FornecedorSummary>>>(OVERRIDES_KEY, {});
      overrides[editingId] = patch;
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));

      const manual = loadJSON<FornecedorSummary[]>(MANUAL_KEY, []);
      const idx = manual.findIndex((m) => m.id === editingId);
      if (idx >= 0) {
        manual[idx] = { ...manual[idx], ...patch };
        localStorage.setItem(MANUAL_KEY, JSON.stringify(manual));
      }
      showToast('Fornecedor atualizado.', 'success');
    } else {
      const novo: FornecedorSummary = { id: crypto.randomUUID(), ...patch };
      setFornecedores((prev) => [novo, ...prev].sort((a, b) => a.nome.localeCompare(b.nome)));

      const manual = loadJSON<FornecedorSummary[]>(MANUAL_KEY, []);
      localStorage.setItem(MANUAL_KEY, JSON.stringify([...manual, novo]));
      showToast('Fornecedor cadastrado.', 'success');
    }
    setModalOpen(false);
  }

  return (
    <div id="view-fornecedores" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16, maxWidth: 720 }}>
        Fornecedores cadastrados no banco. Logo, site e contato ainda ficam salvos só neste navegador (não persistem no backend ainda).
      </div>

      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="relative" style={{ maxWidth: 360, flex: 1, minWidth: 220 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#979797' }} />
          <input
            type="text"
            placeholder="Buscar fornecedor..."
            className="form-input"
            style={{ paddingLeft: 36 }}
            aria-label="Buscar fornecedor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-gold btn-sm" onClick={openNew}>
          <Plus style={{ width: 13, height: 13 }} /> Novo Fornecedor
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="spin" style={{ width: 28, height: 28 }} />
            <div style={{ fontSize: 14 }}>Carregando fornecedores...</div>
          </div>
        ) : error ? (
          <ErrorState message="Não foi possível carregar os fornecedores — verifique se o backend está no ar." onRetry={load} />
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th /><th>Fornecedor</th><th>Site</th><th>Contato</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id}>
                    <td style={{ width: 52 }}>
                      <LogoThumb src={f.logoUrl} alt={f.nome} />
                    </td>
                    <td className="font-medium">{f.nome}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{f.site || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{f.contato || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" aria-label={`Editar ${f.nome}`} onClick={() => openEdit(f)}>
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
            <Building2 style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhum fornecedor encontrado.</div>
          </div>
        )}
      </div>

      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <div className="modal-box" style={{ width: 460 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 16 }}>
              {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar" onClick={() => setModalOpen(false)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="form-label" htmlFor="forn-nome">Nome *</label>
              <input id="forn-nome" className="form-input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="form-label">Logo</label>
              <div className="flex items-center gap-3">
                <LogoThumb src={form.logoUrl || null} alt="Logo" size={40} />
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload style={{ width: 13, height: 13 }} /> Enviar imagem
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoFile(file); e.target.value = ''; }}
                  />
                </label>
                {form.logoUrl && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))}>
                    Remover
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Use uma imagem com fundo transparente ou branco e a marca em cor escura — logos totalmente brancas não aparecem sobre a tabela.
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="forn-site">Site</label>
              <input id="forn-site" className="form-input" value={form.site} onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))} />
            </div>
            <div className="mb-2">
              <label className="form-label" htmlFor="forn-contato">Contato</label>
              <input id="forn-contato" className="form-input" value={form.contato} onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))} />
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
