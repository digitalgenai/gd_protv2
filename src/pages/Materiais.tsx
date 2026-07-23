import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Pencil, Plus, Power, Search, X } from 'lucide-react';
import { createAcabamento, fetchAcabamentosGestao, updateAcabamento } from '../api/acabamentos';
import { fetchFornecedores } from '../api/fornecedores';
import { createMaterial, fetchMateriaisGestao, updateMaterial } from '../api/materiais';
import Combobox from '../components/ui/Combobox';
import Dropdown from '../components/ui/Dropdown';
import ErrorState from '../components/ui/ErrorState';
import { useToast } from '../context/ToastContext';
import type { AcabamentoSummary, FornecedorSummary, MaterialSummary } from '../types';

type Resource = 'materiais' | 'acabamentos';

const TABS: { key: Resource; label: string }[] = [
  { key: 'materiais', label: 'Materiais' },
  { key: 'acabamentos', label: 'Acabamentos' },
];

/** Exemplos citados no DATABASE.md da analista — sugestões de partida, texto livre continua aceito. */
const CATEGORIA_SEED: Record<Resource, string[]> = {
  materiais: ['Madeira', 'Metal', 'MDF'],
  acabamentos: ['Tecido', 'Couro', 'Metal', 'Laca'],
};

const RESOURCE_LABEL: Record<Resource, string> = { materiais: 'material', acabamentos: 'acabamento' };
const RESOURCE_LABEL_CAP: Record<Resource, string> = { materiais: 'Material', acabamentos: 'Acabamento' };

interface ItemForm {
  fornecedorId: string;
  nome: string;
  categoria: string;
  classificacao: string;
}

const EMPTY_FORM: ItemForm = { fornecedorId: '', nome: '', categoria: '', classificacao: '' };

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Gestão formal (criar, editar, ativar/desativar) dos materiais e acabamentos cadastrados por
 * fornecedor (tabelas `materiais`/`acabamentos`, migration 008 da analista de dados) — normalizam,
 * sem substituir, o texto livre já usado em Acabamento/Material do Cadastrar Produto. */
export default function Materiais() {
  const [tab, setTab] = useState<Resource>('materiais');
  const [materiais, setMateriais] = useState<MaterialSummary[]>([]);
  const [acabamentos, setAcabamentos] = useState<AcabamentoSummary[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [fornecedorFilter, setFornecedorFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([fetchMateriaisGestao(), fetchAcabamentosGestao(), fetchFornecedores()])
      .then(([m, a, f]) => {
        setMateriais(m);
        setAcabamentos(a);
        setFornecedores(f);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const fornecedorNomePorId = useMemo(
    () => new Map(fornecedores.map((f) => [f.id, f.nome])),
    [fornecedores],
  );
  const supplierNames = fornecedores.map((f) => f.nome);
  const selectedFormSupplier = fornecedores.find((f) => f.id === form.fornecedorId);
  const selectedFilterSupplier = fornecedores.find((f) => f.id === fornecedorFilter);

  const resourceLabel = RESOURCE_LABEL[tab];
  const resourceLabelCap = RESOURCE_LABEL_CAP[tab];
  const items: (MaterialSummary | AcabamentoSummary)[] = tab === 'materiais' ? materiais : acabamentos;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (fornecedorFilter && item.fornecedorId !== fornecedorFilter) return false;
      if (!q) return true;
      const fornecedorNome = fornecedorNomePorId.get(item.fornecedorId) ?? '';
      return [item.nome, item.categoria, item.classificacao, fornecedorNome]
        .some((value) => value?.toLowerCase().includes(q));
    });
  }, [items, search, fornecedorFilter, fornecedorNomePorId]);

  const categoriaOptions = useMemo(
    () => [...new Set([...CATEGORIA_SEED[tab], ...items.map((i) => i.categoria)])],
    [tab, items],
  );

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, fornecedorId: fornecedorFilter });
    setModalOpen(true);
  }

  function openEdit(item: MaterialSummary | AcabamentoSummary) {
    setEditingId(item.id);
    setForm({
      fornecedorId: item.fornecedorId,
      nome: item.nome,
      categoria: item.categoria,
      classificacao: item.classificacao ?? '',
    });
    setModalOpen(true);
  }

  async function handleToggleAtivo(item: MaterialSummary | AcabamentoSummary) {
    try {
      if (tab === 'materiais') await updateMaterial(item.id, { ativo: !item.ativo });
      else await updateAcabamento(item.id, { ativo: !item.ativo });
      showToast(`${item.nome} agora está ${item.ativo ? 'inativo' : 'ativo'}.`, 'success');
      load();
    } catch {
      showToast(`Não foi possível atualizar o status do ${resourceLabel}.`, 'error');
    }
  }

  async function handleSave() {
    const nome = form.nome.trim();
    const categoria = form.categoria.trim();
    if (!form.fornecedorId) {
      showToast('Selecione o fornecedor.', 'warning');
      return;
    }
    if (!nome) {
      showToast(`Informe o nome do ${resourceLabel}.`, 'warning');
      return;
    }
    if (!categoria) {
      showToast('Informe a categoria.', 'warning');
      return;
    }

    const payload = {
      fornecedorId: form.fornecedorId,
      nome,
      categoria,
      classificacao: form.classificacao.trim() || null,
    };
    setSaving(true);
    try {
      if (tab === 'materiais') {
        const saved = editingId ? await updateMaterial(editingId, payload) : await createMaterial(payload);
        setMateriais((current) => {
          const next = editingId ? current.map((i) => (i.id === saved.id ? saved : i)) : [...current, saved];
          return next.sort((a, b) => a.nome.localeCompare(b.nome));
        });
      } else {
        const saved = editingId ? await updateAcabamento(editingId, payload) : await createAcabamento(payload);
        setAcabamentos((current) => {
          const next = editingId ? current.map((i) => (i.id === saved.id ? saved : i)) : [...current, saved];
          return next.sort((a, b) => a.nome.localeCompare(b.nome));
        });
      }
      showToast(editingId ? `${resourceLabelCap} atualizado.` : `${resourceLabelCap} cadastrado.`, 'success');
      setModalOpen(false);
    } catch (err) {
      showToast(errorText(err, `Não foi possível salvar o ${resourceLabel}.`), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="view-materiais" className="view active fade-in p-6" style={{ maxWidth: 1440 }}>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 5 }}>Materiais e Acabamentos</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 680 }}>
            Cadastro por fornecedor — aparece como sugestão nos campos Material e Acabamento do Cadastrar Produto.
          </p>
        </div>
        <button className="btn btn-gold" onClick={openCreate}>
          <Plus style={{ width: 15, height: 15 }} /> Novo {resourceLabel}
        </button>
      </div>

      <div className="flex items-center gap-1 flex-wrap mb-4" role="tablist" aria-label="Materiais ou Acabamentos">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="btn btn-ghost btn-sm"
            style={{
              borderRadius: 0,
              borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent',
              color: tab === key ? 'var(--gold-text)' : 'var(--text-secondary)',
            }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative" style={{ width: 320 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#979797' }} />
          <input
            type="search"
            placeholder="Buscar por nome, categoria ou fornecedor..."
            className="form-input"
            style={{ paddingLeft: 36 }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div style={{ width: 240 }}>
          <Dropdown
            value={selectedFilterSupplier?.nome ?? ''}
            onChange={(nome) => setFornecedorFilter(fornecedores.find((f) => f.nome === nome)?.id ?? '')}
            options={supplierNames}
            placeholder="Todos os fornecedores"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="spin" style={{ width: 28, height: 28 }} />
            <div style={{ fontSize: 14 }}>Carregando {resourceLabel}s...</div>
          </div>
        ) : error ? (
          <ErrorState message={`Não foi possível carregar os ${resourceLabel}s.`} onRetry={load} />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fornecedor</th><th>Nome</th><th>Categoria</th><th>Classificação</th><th>Status</th><th style={{ width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{fornecedorNomePorId.get(item.fornecedorId) ?? '—'}</td>
                    <td className="font-medium">{item.nome}</td>
                    <td><span className="mono badge badge-gold">{item.categoria}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.classificacao || '—'}</td>
                    <td><span className={`badge ${item.ativo ? 'badge-success' : 'badge-draft'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm" aria-label={`Editar ${item.nome}`} title={`Editar ${item.nome}`} onClick={() => openEdit(item)}>
                          <Pencil style={{ width: 13, height: 13 }} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          aria-label={`${item.ativo ? 'Desativar' : 'Ativar'} ${item.nome}`}
                          title={`${item.ativo ? 'Desativar' : 'Ativar'} ${item.nome}`}
                          onClick={() => handleToggleAtivo(item)}
                        >
                          <Power style={{ width: 13, height: 13, color: item.ativo ? 'var(--success)' : 'var(--text-secondary)' }} />
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
            <Layers style={{ width: 38, height: 38, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhum {resourceLabel} encontrado.</div>
          </div>
        )}
      </div>

      <div
        className={`modal-overlay${modalOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-modal-title"
        onClick={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}
      >
        <div className="modal-box" style={{ width: 500 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div id="material-modal-title" style={{ fontWeight: 700, fontSize: 17 }}>
              {editingId ? `Editar ${resourceLabel}` : `Cadastrar ${resourceLabel}`}
            </div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar" disabled={saving} onClick={() => setModalOpen(false)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="form-label" htmlFor="material-fornecedor">Fornecedor *</label>
              <Dropdown
                id="material-fornecedor"
                value={selectedFormSupplier?.nome ?? ''}
                onChange={(nome) => setForm((f) => ({ ...f, fornecedorId: fornecedores.find((item) => item.nome === nome)?.id ?? '' }))}
                options={supplierNames}
                placeholder="Selecione o fornecedor"
                allowEmpty={false}
              />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="material-nome">Nome *</label>
              <input
                id="material-nome"
                className="form-input"
                autoFocus
                value={form.nome}
                onChange={(event) => setForm((f) => ({ ...f, nome: event.target.value }))}
              />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="material-categoria">Categoria *</label>
              <Combobox
                id="material-categoria"
                value={form.categoria}
                onChange={(value) => setForm((f) => ({ ...f, categoria: value }))}
                options={categoriaOptions}
                placeholder="Ex.: Madeira, Metal..."
              />
            </div>
            <div>
              <label className="form-label" htmlFor="material-classificacao">Classificação</label>
              <input
                id="material-classificacao"
                className="form-input"
                placeholder="Opcional — texto livre por enquanto"
                value={form.classificacao}
                onChange={(event) => setForm((f) => ({ ...f, classificacao: event.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-outline" disabled={saving} onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-gold" disabled={saving} onClick={handleSave}>
                {saving && <Loader2 className="spin" style={{ width: 14, height: 14 }} />}
                {editingId ? 'Salvar alterações' : `Cadastrar ${resourceLabel}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
