import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ParsedVoiceResult, Product, ProposalMaterial, ProposalRow } from '../types';
import { formatPhoneBR } from '../utils/format';

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

interface ProposalHeader {
  cliente: string;
  telefoneCliente: string;
  enderecoCliente: string;
  emailCliente: string;
  arquiteto: string;
  vendedor: string;
  validade: string;
  pagamento: string;
  versao: number;
  observacoes: string;
  globalDiscount: number;
  /** Ambientes definidos antecipadamente pelo consultor (ex.: "Sala de Estar", "Cozinha"), na ordem em que foram criados. */
  ambientes: string[];
  /** Ids dos vendedores adicionais da venda em conjunto (RF-039) — nunca inclui `vendedor` (o principal). */
  vendedoresConjuntos: string[];
}

interface ProposalDraftContextValue {
  header: ProposalHeader;
  rows: ProposalRow[];
  setHeaderField: <K extends keyof ProposalHeader>(field: K, value: ProposalHeader[K]) => void;
  addProductToProposal: (product: Product, ambiente?: string) => void;
  addEmptyRow: (ambiente?: string) => void;
  updateRow: (id: number, patch: Partial<ProposalRow>) => void;
  removeRow: (id: number) => void;
  addMaterial: (rowId: number, descricao?: string) => void;
  updateMaterial: (rowId: number, materialId: number, patch: Partial<ProposalMaterial>) => void;
  removeMaterial: (rowId: number, materialId: number) => void;
  addAmbiente: (name: string) => void;
  removeAmbiente: (name: string) => void;
  renameAmbiente: (oldName: string, newName: string) => void;
  /** Venda em conjunto (RF-039): adiciona/remove um vendedor adicional pelo id. */
  addCoVendedor: (vendedorId: string) => void;
  removeCoVendedor: (vendedorId: string) => void;
  applyVoiceResult: (result: ParsedVoiceResult) => void;
  /** Carrega um rascunho pré-existente (ex.: "Editar como nova versão" a partir do histórico).
   * `originalCode`, quando informado, marca que o próximo save deve virar uma versão nova da
   * proposta original (ver Nova Proposta > handleSave), não uma proposta solta. */
  loadDraft: (newHeader: Partial<ProposalHeader>, newRows: ProposalRow[], originalCode?: string) => void;
  /** Volta pro estado inicial (cliente novo, sem itens, sem vínculo com nenhuma proposta
   * original) — usado ao clicar em "Nova Proposta" pra não carregar sobras de um rascunho anterior. */
  resetDraft: () => void;
  /** Código da proposta original quando este rascunho é uma "nova versão" dela; null numa
   * proposta genuinamente nova. */
  originalCode: string | null;
  proposalCode: string;
  subtotal: number;
  total: number;
}

const PAYMENT_OPTIONS = ['À vista (5% desc.)', '30/60/90 dias', '10x sem juros no cartão', 'Financiamento direto'];

const DEFAULT_HEADER: ProposalHeader = {
  cliente: '',
  telefoneCliente: '',
  enderecoCliente: '',
  emailCliente: '',
  arquiteto: '',
  vendedor: '',
  validade: addDays(new Date(), 2), // 48h por padrão, a pedido do time comercial
  pagamento: PAYMENT_OPTIONS[0],
  versao: 1,
  observacoes: '',
  globalDiscount: 0,
  ambientes: [],
  vendedoresConjuntos: [],
};

const ProposalDraftContext = createContext<ProposalDraftContextValue | null>(null);

export function buildProposalCode(header: ProposalHeader): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(2);
  const cli = header.cliente.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 8) || 'CLIENTE';
  // header.vendedor é o id real do vendedor (uuid) — só um trecho curto aqui, é cosmético
  // (a prévia antes de salvar); o código de verdade é gerado no banco via trigger.
  const vendedorTag = header.vendedor ? header.vendedor.slice(0, 8).toUpperCase() : '---';
  return `GD-${mm}.${yy}.${vendedorTag}.001.v${header.versao}.${cli}`;
}

export function ProposalDraftProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<ProposalHeader>(DEFAULT_HEADER);
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [originalCode, setOriginalCode] = useState<string | null>(null);
  const rowCounter = useRef(0);
  const materialCounter = useRef(0);

  const setHeaderField = <K extends keyof ProposalHeader>(field: K, value: ProposalHeader[K]) => {
    setHeader((h) => ({ ...h, [field]: value }));
  };

  const addProductToProposal = (product: Product, ambiente = '') => {
    rowCounter.current += 1;
    setRows((r) => [...r, { id: rowCounter.current, ambiente, code: product.id, desc: product.name, qty: 1, price: product.price, disc: 0, materiais: [] }]);
  };

  const addEmptyRow = (ambiente?: string) => {
    rowCounter.current += 1;
    setRows((r) => {
      const inheritedAmbiente = ambiente ?? (r.length ? r[r.length - 1].ambiente : '');
      return [...r, { id: rowCounter.current, ambiente: inheritedAmbiente, code: '', desc: '', qty: 1, price: 0, disc: 0, materiais: [] }];
    });
  };

  const updateRow = (id: number, patch: Partial<ProposalRow>) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: number) => {
    setRows((r) => r.filter((row) => row.id !== id));
  };

  const addMaterial = (rowId: number, descricao = '') => {
    materialCounter.current += 1;
    const newMaterial: ProposalMaterial = { id: materialCounter.current, descricao, fornecedor: '' };
    setRows((r) => r.map((row) => (row.id === rowId ? { ...row, materiais: [...row.materiais, newMaterial] } : row)));
  };

  const updateMaterial = (rowId: number, materialId: number, patch: Partial<ProposalMaterial>) => {
    setRows((r) =>
      r.map((row) =>
        row.id === rowId
          ? { ...row, materiais: row.materiais.map((m) => (m.id === materialId ? { ...m, ...patch } : m)) }
          : row,
      ),
    );
  };

  const removeMaterial = (rowId: number, materialId: number) => {
    setRows((r) =>
      r.map((row) => (row.id === rowId ? { ...row, materiais: row.materiais.filter((m) => m.id !== materialId) } : row)),
    );
  };

  const addAmbiente = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setHeader((h) => {
      if (h.ambientes.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return h;
      return { ...h, ambientes: [...h.ambientes, trimmed] };
    });
  };

  const removeAmbiente = (name: string) => {
    setHeader((h) => ({ ...h, ambientes: h.ambientes.filter((a) => a !== name) }));
    setRows((r) => r.map((row) => (row.ambiente === name ? { ...row, ambiente: '' } : row)));
  };

  const renameAmbiente = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setHeader((h) => ({ ...h, ambientes: h.ambientes.map((a) => (a === oldName ? trimmed : a)) }));
    setRows((r) => r.map((row) => (row.ambiente === oldName ? { ...row, ambiente: trimmed } : row)));
  };

  const addCoVendedor = (vendedorId: string) => {
    if (!vendedorId) return;
    setHeader((h) => {
      if (vendedorId === h.vendedor || h.vendedoresConjuntos.includes(vendedorId)) return h;
      return { ...h, vendedoresConjuntos: [...h.vendedoresConjuntos, vendedorId] };
    });
  };

  const removeCoVendedor = (vendedorId: string) => {
    setHeader((h) => ({ ...h, vendedoresConjuntos: h.vendedoresConjuntos.filter((id) => id !== vendedorId) }));
  };

  const loadDraft = (newHeader: Partial<ProposalHeader>, newRows: ProposalRow[], newOriginalCode?: string) => {
    const maxRowId = newRows.reduce((m, row) => Math.max(m, row.id), 0);
    const maxMaterialId = newRows.reduce((m, row) => Math.max(m, ...row.materiais.map((mat) => mat.id)), 0);
    rowCounter.current = maxRowId;
    materialCounter.current = maxMaterialId;
    setHeader((h) => ({ ...h, ...newHeader }));
    setRows(newRows);
    setOriginalCode(newOriginalCode ?? null);
  };

  const resetDraft = () => {
    rowCounter.current = 0;
    materialCounter.current = 0;
    setHeader(DEFAULT_HEADER);
    setRows([]);
    setOriginalCode(null);
  };

  const applyVoiceResult = (result: ParsedVoiceResult) => {
    if (result.client) setHeaderField('cliente', result.client);
    if (result.clientPhone) setHeaderField('telefoneCliente', formatPhoneBR(result.clientPhone));
    if (result.clientEmail) setHeaderField('emailCliente', result.clientEmail);
    if (result.clientAddress) setHeaderField('enderecoCliente', result.clientAddress);
    if (result.architect) setHeaderField('arquiteto', result.architect);
    if (result.discount) setHeaderField('globalDiscount', result.discount);
    const newRows = result.items.map((item) => {
      rowCounter.current += 1;
      return {
        id: rowCounter.current,
        ambiente: item.ambiente || '',
        code: item.product.id,
        desc: item.product.name,
        qty: item.qty,
        price: item.product.price,
        disc: result.discount || 0,
        materiais: [],
      };
    });
    setRows((r) => [...r, ...newRows]);

    // Qualquer ambiente citado na fala entra na lista de ambientes da proposta (mesma lista
    // que "+ Estar"/"+ Cozinha" preenchem manualmente), senão o item fica órfão da seção.
    const ambientesDetectados = Array.from(
      new Set(result.items.map((i) => i.ambiente).filter((a): a is string => Boolean(a))),
    );
    ambientesDetectados.forEach((a) => addAmbiente(a));
  };

  const subtotal = useMemo(() => rows.reduce((s, r) => s + r.qty * r.price * (1 - r.disc / 100), 0), [rows]);
  const total = subtotal * (1 - header.globalDiscount / 100);
  const proposalCode = useMemo(() => buildProposalCode(header), [header]);

  return (
    <ProposalDraftContext.Provider
      value={{
        header, rows, setHeaderField, addProductToProposal, addEmptyRow, updateRow, removeRow,
        addMaterial, updateMaterial, removeMaterial, addAmbiente, removeAmbiente, renameAmbiente,
        addCoVendedor, removeCoVendedor,
        applyVoiceResult, loadDraft, resetDraft, originalCode, proposalCode, subtotal, total,
      }}
    >
      {children}
    </ProposalDraftContext.Provider>
  );
}

export function useProposalDraft() {
  const ctx = useContext(ProposalDraftContext);
  if (!ctx) throw new Error('useProposalDraft deve ser usado dentro de ProposalDraftProvider');
  return ctx;
}

export { PAYMENT_OPTIONS };
