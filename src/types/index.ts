export interface Product {
  id: string;
  name: string;
  cat: string;
  supplier: string;
  finish: string;
  price: number;
  img: string;
  /** Dimensões do produto (L × P × A em cm, ou L × C para tapetes). */
  dimensions: string;
  /** Até 3 imagens reais do produto (RN-004), por posição — vem do backend real. */
  images?: { id: number; url: string; posicao: number }[];
}

/** Material complementar do item (ex.: tecido, ferragem) vindo de um fornecedor à parte. */
export interface ProposalMaterial {
  id: number;
  descricao: string;
  fornecedor: string;
}

export interface ProposalRow {
  id: number;
  ambiente: string;
  code: string;
  desc: string;
  qty: number;
  price: number;
  disc: number;
  materiais: ProposalMaterial[];
  /**
   * Foto usada na página "Itens em Destaque" do PDF, escolhida manualmente pelo vendedor.
   * `undefined` = escolhe automaticamente a primeira foto de ambiente do produto (padrão);
   * `null` = não mostrar este item na página de destaque; número = id da imagem escolhida.
   */
  highlightImageId?: number | null;
}

export type ProposalStatus = 'Aprovada' | 'Enviada' | 'Rascunho' | 'Reprovada' | 'Revisão';

export interface ProposalSummary {
  code: string;
  cliente: string;
  arquiteto: string | null;
  vendedor: string;
  valor: number;
  data: string;
  versao: number;
  status: ProposalStatus;
  pdfGerado: boolean;
}

/** Uma versão no histórico de uma proposta (cada versão tem seu próprio código `.vN`). */
export interface ProposalVersion {
  code: string;
  versao: number;
  status: ProposalStatus;
  data: string;
  pdfGerado: boolean;
}

/** Dados completos de uma proposta para a tela de detalhe/gerenciamento. */
export interface ProposalDetail extends ProposalSummary {
  validade: string;
  pagamento: string;
  vendaDireta: boolean;
  observacoes: string;
  ambientes: string[];
  itens: ProposalRow[];
  versoes: ProposalVersion[];
}

export interface VoiceDraftItem {
  product: Product;
  qty: number;
}

export interface VoiceNotFoundItem {
  phrase: string;
  suggestion: Product | null;
}

export interface ParsedVoiceResult {
  client: string | null;
  architect: string | null;
  discount: number;
  items: VoiceDraftItem[];
  notFound: VoiceNotFoundItem[];
}

export interface VoiceDraft {
  id: number;
  vendedor: string;
  criadoEm: string;
  transcricao: string;
  status: 'aguardando_revisao' | 'processado';
  itensDetectados: number;
  temErro: boolean;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface FilterState {
  search: string;
  categories: string[];
  suppliers: string[];
  finishes: string[];
  priceRange: 'all' | '0-3000' | '3000-8000' | '8000+';
  sort: 'relevance' | 'price-asc' | 'price-desc' | 'name-asc';
}
