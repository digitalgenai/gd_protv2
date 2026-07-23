import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Database, ImagePlus, Info, Loader2, PackagePlus, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createCatalogMaterial, createProduct, type CreateProductPayload } from '../api/products';
import { fetchFornecedores } from '../api/fornecedores';
import CurrencyInput from '../components/ui/CurrencyInput';
import DimensionsInput from '../components/ui/DimensionsInput';
import Dropdown from '../components/ui/Dropdown';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { useImageModal } from '../context/ImageModalContext';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { useToast } from '../context/ToastContext';
import type { FornecedorSummary } from '../types';

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
const EMPTY_FABRIC_FORM = { name: '', reference: '', supplierId: '' };

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
  const [fabricModalOpen, setFabricModalOpen] = useState(false);
  const [savingFabric, setSavingFabric] = useState(false);
  const [fabricForm, setFabricForm] = useState(EMPTY_FABRIC_FORM);
  const [registeredMaterials, setRegisteredMaterials] = useState<string[]>([]);
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

  const categoryOptions = useMemo(
    () => unique([...facets.categories.map((item) => item.value), ...products.map((item) => item.cat)]),
    [facets.categories, products],
  );
  const supplierNames = fornecedores.map((item) => item.nome);
  const selectedSupplier = fornecedores.find((item) => item.id === form.supplierId);
  const selectedFabricSupplier = fornecedores.find((item) => item.id === fabricForm.supplierId);
  const materialOptions = unique([...facets.materials, ...registeredMaterials]);
  const saleUnitOptions = unique([...facets.units, ...SALE_UNIT_OPTIONS]);

  function patch<K extends keyof CreateProductPayload>(key: K, value: CreateProductPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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

  async function handleCreateFabric() {
    if (!fabricForm.name.trim()) {
      showToast('Informe o nome do tecido.', 'warning');
      return;
    }
    if (!fabricForm.supplierId) {
      showToast('Selecione o fornecedor do tecido.', 'warning');
      return;
    }
    setSavingFabric(true);
    try {
      const created = await createCatalogMaterial({
        name: fabricForm.name.trim(),
        reference: fabricForm.reference.trim(),
        supplierId: fabricForm.supplierId,
      });
      setRegisteredMaterials((current) => unique([...current, created.displayName]));
      patch('material', created.displayName);
      reload();
      setFabricModalOpen(false);
      setFabricForm(EMPTY_FABRIC_FORM);
      showToast('Tecido cadastrado e selecionado no produto.', 'success');
    } catch (error) {
      showToast(errorText(error), 'error');
    } finally {
      setSavingFabric(false);
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
                <label className="form-label" htmlFor="product-finish">Acabamento</label>
                <Dropdown id="product-finish" value={form.finish} onChange={(value) => patch('finish', value)} options={unique(facets.finishes)} placeholder="Selecione o acabamento" />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="form-label" htmlFor="product-material">Material ou tecido</label>
                  <button
                    type="button"
                    className="inline-field-action"
                    onClick={() => setFabricModalOpen(true)}
                  >
                    <Plus style={{ width: 11, height: 11 }} /> Cadastrar tecido
                  </button>
                </div>
                <Dropdown id="product-material" value={form.material} onChange={(value) => patch('material', value)} options={materialOptions} placeholder="Selecione o material ou tecido" />
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
              <div>
                <label className="form-label" htmlFor="product-sale-price">Preço de venda</label>
                <CurrencyInput id="product-sale-price" value={form.salePrice} onChange={(value) => patch('salePrice', value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="product-final-price">Preço final</label>
                <CurrencyInput id="product-final-price" value={form.finalPrice} onChange={(value) => patch('finalPrice', value)} />
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

      {fabricModalOpen && <div
        className={`modal-overlay${fabricModalOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fabric-modal-title"
        onClick={(event) => {
          if (event.target === event.currentTarget && !savingFabric) setFabricModalOpen(false);
        }}
      >
        <div className="modal-box" style={{ width: 520 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div id="fabric-modal-title" style={{ fontWeight: 700, fontSize: 17 }}>Cadastrar tecido</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                O tecido ficará disponível no dropdown de materiais.
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar cadastro de tecido" disabled={savingFabric} onClick={() => setFabricModalOpen(false)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="form-label" htmlFor="fabric-name">Nome do tecido *</label>
              <input
                id="fabric-name"
                className="form-input"
                placeholder="Ex.: Linho Areia"
                value={fabricForm.name}
                onChange={(event) => setFabricForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label" htmlFor="fabric-reference">Código ou referência</label>
                <input
                  id="fabric-reference"
                  className="form-input"
                  placeholder="Ex.: TEC-204"
                  value={fabricForm.reference}
                  onChange={(event) => setFabricForm((current) => ({ ...current, reference: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="fabric-supplier">Fornecedor *</label>
                <Dropdown
                  id="fabric-supplier"
                  value={selectedFabricSupplier?.nome ?? ''}
                  onChange={(name) => setFabricForm((current) => ({
                    ...current,
                    supplierId: fornecedores.find((item) => item.nome === name)?.id ?? '',
                  }))}
                  options={supplierNames}
                  placeholder="Selecione o fornecedor"
                  allowEmpty={false}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-outline" disabled={savingFabric} onClick={() => setFabricModalOpen(false)}>Cancelar</button>
              <button className="btn btn-gold" disabled={savingFabric} onClick={handleCreateFabric}>
                {savingFabric && <Loader2 className="spin" style={{ width: 14, height: 14 }} />}
                Cadastrar e usar tecido
              </button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
