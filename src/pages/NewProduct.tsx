import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Database, ImagePlus, Info, Loader2, PackagePlus, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createAcabamento, fetchAcabamentosByFornecedor } from '../api/acabamentos';
import { fetchFornecedores } from '../api/fornecedores';
import { createMaterial, fetchMateriaisByFornecedor } from '../api/materiais';
import { createProduct, type CreateProductPayload } from '../api/products';
import Combobox from '../components/ui/Combobox';
import CurrencyInput from '../components/ui/CurrencyInput';
import DimensionsInput from '../components/ui/DimensionsInput';
import Dropdown from '../components/ui/Dropdown';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { useImageModal } from '../context/ImageModalContext';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { useToast } from '../context/ToastContext';
import type { AcabamentoSummary, FornecedorSummary, MaterialSummary } from '../types';

/** Recurso do cadastro rápido (botão "+" ao lado de Acabamento/Material) — cada um mapeia pra
 * uma tabela por fornecedor (materiais/acabamentos, migration 008 da analista de dados). */
type QuickAddResource = 'finish' | 'material';

/** Exemplos citados no DATABASE.md da analista — mesmo seed usado na tela Gestão > Materiais. */
const CATEGORIA_SEED: Record<QuickAddResource, string[]> = {
  material: ['Madeira', 'Metal', 'MDF'],
  finish: ['Tecido', 'Couro', 'Metal', 'Laca'],
};

const EMPTY_QUICK_ADD_FORM = { nome: '', categoria: '', classificacao: '' };

const EMPTY_FORM: CreateProductPayload = {
  name: '',
  supplierId: '',
  cat: '',
  finish: '',
  material: '',
  dimensions: '',
  unit: '',
  salePrice: 0,
  finalPrice: 0,
  active: true,
};

const SALE_UNIT_OPTIONS = ['Peça', 'Par', 'Conjunto', 'Metro linear', 'Metro quadrado'];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível cadastrar o produto.';
}

export default function NewProduct() {
  const [form, setForm] = useState<CreateProductPayload>(EMPTY_FORM);
  const [fornecedores, setFornecedores] = useState<FornecedorSummary[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierMateriais, setSupplierMateriais] = useState<MaterialSummary[]>([]);
  const [supplierAcabamentos, setSupplierAcabamentos] = useState<AcabamentoSummary[]>([]);
  const [quickAddResource, setQuickAddResource] = useState<QuickAddResource | null>(null);
  const [quickAddForm, setQuickAddForm] = useState(EMPTY_QUICK_ADD_FORM);
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);
  const { facets, products, reload } = useProducts();
  const { openImageModal } = useImageModal();
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const canCreateSupplier = usuario?.perfil === 'Administrador' || usuario?.perfil === 'Supervisor';
  const navigate = useNavigate();

  useEffect(() => {
    fetchFornecedores()
      .then(setFornecedores)
      .catch((error) => showToast(errorText(error), 'error'))
      .finally(() => setLoadingSuppliers(false));
  }, [showToast]);

  // Sugestões do fornecedor selecionado (cadastro formal, tabelas materiais/acabamentos) —
  // além do texto livre já usado em produtos anteriores (facets.materials/finishes).
  useEffect(() => {
    if (!form.supplierId) {
      setSupplierMateriais([]);
      setSupplierAcabamentos([]);
      return;
    }
    fetchMateriaisByFornecedor(form.supplierId).then(setSupplierMateriais).catch(() => setSupplierMateriais([]));
    fetchAcabamentosByFornecedor(form.supplierId).then(setSupplierAcabamentos).catch(() => setSupplierAcabamentos([]));
  }, [form.supplierId]);

  const categoryOptions = useMemo(
    () => unique([...facets.categories.map((item) => item.value), ...products.map((item) => item.cat)]),
    [facets.categories, products],
  );
  const supplierNames = fornecedores.map((item) => item.nome);
  const selectedSupplier = fornecedores.find((item) => item.id === form.supplierId);
  const finishOptions = unique([...facets.finishes, ...supplierAcabamentos.map((item) => item.nome)]);
  const materialOptions = unique([...facets.materials, ...supplierMateriais.map((item) => item.nome)]);
  const saleUnitOptions = unique([...facets.units, ...SALE_UNIT_OPTIONS]);
  const quickAddCategoriaOptions = quickAddResource
    ? [...new Set([
        ...CATEGORIA_SEED[quickAddResource],
        ...(quickAddResource === 'material' ? supplierMateriais : supplierAcabamentos).map((item) => item.categoria),
      ])]
    : [];

  function patch<K extends keyof CreateProductPayload>(key: K, value: CreateProductPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openQuickAdd(resource: QuickAddResource) {
    setQuickAddForm(EMPTY_QUICK_ADD_FORM);
    setQuickAddResource(resource);
  }

  async function handleQuickAddSave() {
    if (!quickAddResource || !form.supplierId) return;
    const nome = quickAddForm.nome.trim();
    const categoria = quickAddForm.categoria.trim();
    const resourceLabel = quickAddResource === 'material' ? 'material' : 'acabamento';
    if (!nome) {
      showToast(`Informe o nome do ${resourceLabel}.`, 'warning');
      return;
    }
    if (!categoria) {
      showToast('Informe a categoria.', 'warning');
      return;
    }

    setSavingQuickAdd(true);
    try {
      const payload = {
        fornecedorId: form.supplierId,
        nome,
        categoria,
        classificacao: quickAddForm.classificacao.trim() || null,
      };
      if (quickAddResource === 'material') {
        const created = await createMaterial(payload);
        setSupplierMateriais((current) => [...current, created]);
        patch('material', created.nome);
      } else {
        const created = await createAcabamento(payload);
        setSupplierAcabamentos((current) => [...current, created]);
        patch('finish', created.nome);
      }
      showToast(`${resourceLabel === 'material' ? 'Material' : 'Acabamento'} cadastrado e selecionado no produto.`, 'success');
      setQuickAddResource(null);
    } catch (error) {
      showToast(errorText(error), 'error');
    } finally {
      setSavingQuickAdd(false);
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      showToast('Informe o nome do produto.', 'warning');
      return;
    }
    if (!form.supplierId) {
      showToast('Selecione o fornecedor.', 'warning');
      return;
    }
    if (!form.cat) {
      showToast('Selecione a categoria.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const created = await createProduct({ ...form, name: form.name.trim() });
      reload();
      showToast(`${created.id} cadastrado no catálogo. Agora adicione as imagens.`, 'success');
      navigate('/catalogo');
      openImageModal(created, 'imagens');
      setForm(EMPTY_FORM);
    } catch (error) {
      showToast(errorText(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="view-new-product" className="view active fade-in p-6" style={{ maxWidth: 1180 }}>
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/catalogo" className="btn btn-outline btn-sm" aria-label="Voltar ao catálogo">
            <ArrowLeft style={{ width: 14, height: 14 }} />
          </Link>
          <div>
            <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 3 }}>Cadastrar produto</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Cadastre a peça e sua primeira configuração comercial. O código será criado automaticamente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-outline" disabled={saving} onClick={() => navigate('/catalogo')}>Cancelar</button>
          <button className="btn btn-gold" disabled={saving || loadingSuppliers} onClick={handleSubmit}>
            {saving ? <Loader2 className="spin" style={{ width: 15, height: 15 }} /> : <ImagePlus style={{ width: 15, height: 15 }} />}
            Cadastrar e adicionar imagens
          </button>
        </div>
      </div>

      <div className="product-register-layout">
        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <span className="product-register-icon"><PackagePlus style={{ width: 18, height: 18 }} /></span>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Identificação do produto</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Informações que identificam a peça no catálogo.</p>
              </div>
            </div>

            <div className="product-register-grid">
              <div className="product-register-span-2">
                <label className="form-label" htmlFor="product-name">Nome do produto *</label>
                <input
                  id="product-name"
                  className="form-input"
                  placeholder="Ex.: Sofá Modular Essenza"
                  value={form.name}
                  onChange={(event) => patch('name', event.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="form-label" htmlFor="product-supplier">Fornecedor *</label>
                  {canCreateSupplier && (
                    <Link to="/gestao/fornecedores" style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
                      <Plus style={{ width: 11, height: 11, display: 'inline' }} /> Novo
                    </Link>
                  )}
                </div>
                <Dropdown
                  id="product-supplier"
                  value={selectedSupplier?.nome ?? ''}
                  onChange={(name) => patch('supplierId', fornecedores.find((item) => item.nome === name)?.id ?? '')}
                  options={supplierNames}
                  placeholder={loadingSuppliers ? 'Carregando fornecedores...' : 'Selecione o fornecedor'}
                  allowEmpty={false}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="product-category">Categoria *</label>
                <Dropdown
                  id="product-category"
                  value={form.cat}
                  onChange={(value) => patch('cat', value)}
                  options={categoryOptions}
                  placeholder="Selecione a categoria"
                  allowEmpty={false}
                />
              </div>
              <div className="product-register-span-2">
                <label className="form-label">Disponibilidade no catálogo</label>
                <ToggleSwitch
                  checked={form.active}
                  onChange={(value) => patch('active', value)}
                  onLabel="Produto ativo"
                  offLabel="Produto inativo"
                  ariaLabel="Produto ativo no catálogo"
                />
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <span className="product-register-icon"><CheckCircle2 style={{ width: 18, height: 18 }} /></span>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Configuração comercial</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Acabamento, material e preço da primeira opção de venda.</p>
              </div>
            </div>

            <div className="product-register-grid">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="form-label" htmlFor="product-finish">Acabamento</label>
                  <button
                    type="button"
                    className="inline-field-action"
                    disabled={!form.supplierId}
                    title={form.supplierId ? 'Cadastrar acabamento para este fornecedor' : 'Selecione um fornecedor primeiro'}
                    onClick={() => openQuickAdd('finish')}
                  >
                    <Plus style={{ width: 11, height: 11 }} /> Cadastrar
                  </button>
                </div>
                <Combobox id="product-finish" value={form.finish} onChange={(value) => patch('finish', value)} options={finishOptions} placeholder="Digite ou selecione o acabamento" />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="form-label" htmlFor="product-material">Material ou tecido</label>
                  <button
                    type="button"
                    className="inline-field-action"
                    disabled={!form.supplierId}
                    title={form.supplierId ? 'Cadastrar material para este fornecedor' : 'Selecione um fornecedor primeiro'}
                    onClick={() => openQuickAdd('material')}
                  >
                    <Plus style={{ width: 11, height: 11 }} /> Cadastrar
                  </button>
                </div>
                <Combobox id="product-material" value={form.material} onChange={(value) => patch('material', value)} options={materialOptions} placeholder="Digite ou selecione o material" />
              </div>
              <div className="product-register-span-2">
                <DimensionsInput
                  idPrefix="product-dimensions"
                  value={form.dimensions}
                  onChange={(value) => patch('dimensions', value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="product-unit">Unidade de venda</label>
                <Dropdown id="product-unit" value={form.unit} onChange={(value) => patch('unit', value)} options={saleUnitOptions} placeholder="Ex.: Peça ou conjunto" />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>
                  Como este produto é vendido: por peça, par, conjunto, metro ou m².
                </div>
              </div>
              <div />
              <div>
                <label className="form-label" htmlFor="product-sale-price">Preço de venda</label>
                <CurrencyInput id="product-sale-price" className="form-input" value={form.salePrice} onChange={(value) => patch('salePrice', value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="product-final-price">Preço final</label>
                <CurrencyInput id="product-final-price" className="form-input" value={form.finalPrice} onChange={(value) => patch('finalPrice', value)} />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>
                  Se ficar em R$ 0,00, o catálogo utilizará o preço de venda.
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="card p-5 product-system-card">
            <div className="flex items-center gap-2 mb-4">
              <Database style={{ width: 16, height: 16, color: 'var(--gold)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Campos do sistema</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 14 }}>
              Estes campos também existem no banco, mas são protegidos e preenchidos automaticamente após o cadastro.
            </p>
            <dl className="product-system-list">
              <div><dt>ID do banco</dt><dd>Automático</dd></div>
              <div><dt>Código</dt><dd>GD-0000</dd></div>
              <div><dt>ID da configuração</dt><dd>Automático</dd></div>
              <div><dt>ID do arquivo</dt><dd>Sem arquivo</dd></div>
              <div><dt>Origem</dt><dd>Cadastro manual</dd></div>
              <div><dt>Preço em texto</dt><dd>Derivado do valor</dd></div>
              <div><dt>Configuração ativa</dt><dd>Sim</dd></div>
              <div><dt>Criado em</dt><dd>Data e hora atuais</dd></div>
              <div><dt>Atualizado em</dt><dd>Automático</dd></div>
            </dl>
          </div>

          <div className="card p-4" style={{ borderColor: 'rgba(123,29,52,.26)', background: 'rgba(123,29,52,.045)' }}>
            <div className="flex items-start gap-3">
              <Info style={{ width: 17, height: 17, color: 'var(--gold)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Depois de salvar, a tela de imagens abrirá automaticamente. Você poderá cadastrar até as posições permitidas e definir a foto principal.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {quickAddResource && <div
        className={`modal-overlay${quickAddResource ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-modal-title"
        onClick={(event) => {
          if (event.target === event.currentTarget && !savingQuickAdd) setQuickAddResource(null);
        }}
      >
        <div className="modal-box" style={{ width: 480 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div id="quick-add-modal-title" style={{ fontWeight: 700, fontSize: 17 }}>
                {quickAddResource === 'material' ? 'Cadastrar material' : 'Cadastrar acabamento'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Fornecedor: {selectedSupplier?.nome} — fica disponível no dropdown pra qualquer produto deste fornecedor.
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              aria-label="Fechar"
              disabled={savingQuickAdd}
              onClick={() => setQuickAddResource(null)}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="form-label" htmlFor="quick-add-nome">Nome *</label>
              <input
                id="quick-add-nome"
                className="form-input"
                placeholder={quickAddResource === 'material' ? 'Ex.: MDF 18mm' : 'Ex.: Linho Areia'}
                value={quickAddForm.nome}
                onChange={(event) => setQuickAddForm((f) => ({ ...f, nome: event.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label" htmlFor="quick-add-categoria">Categoria *</label>
                <Combobox
                  id="quick-add-categoria"
                  value={quickAddForm.categoria}
                  onChange={(value) => setQuickAddForm((f) => ({ ...f, categoria: value }))}
                  options={quickAddCategoriaOptions}
                  placeholder="Ex.: Madeira, Tecido..."
                />
              </div>
              <div>
                <label className="form-label" htmlFor="quick-add-classificacao">Classificação</label>
                <input
                  id="quick-add-classificacao"
                  className="form-input"
                  placeholder="Opcional"
                  value={quickAddForm.classificacao}
                  onChange={(event) => setQuickAddForm((f) => ({ ...f, classificacao: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-outline" disabled={savingQuickAdd} onClick={() => setQuickAddResource(null)}>Cancelar</button>
              <button className="btn btn-gold" disabled={savingQuickAdd} onClick={handleQuickAddSave}>
                {savingQuickAdd && <Loader2 className="spin" style={{ width: 14, height: 14 }} />}
                Cadastrar e usar
              </button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
