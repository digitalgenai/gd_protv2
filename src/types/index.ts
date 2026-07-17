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
  /**
   * Este produto pode ser vendido direto (sem intermediação) — nem todo produto pode.
   * Front-only por enquanto (sem coluna própria no banco ainda), guardado por produto e
   * não mais por proposta inteira, já que uma mesma proposta pode ter itens de ambos os tipos.
   */
  vendaDireta?: boolean;
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

/**
 * Diretório de clientes — hoje é agregado a partir das propostas (uma linha por cliente com
 * pelo menos 1 proposta), mas o cadastro manual (ver ClienteFormModal) permite criar um cliente
 * antes de qualquer proposta existir. Só front por enquanto — a fonte de verdade real virá do
 * CRM da empresa quando a integração existir; `cadastradoManualmente` distingue as duas origens
 * enquanto isso (registro manual só existe na sessão atual, não é persistido).
 */
export interface ClienteSummary {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  propostas: number;
  valorTotal: number;
  ultimaProposta: string;
  cadastradoManualmente?: boolean;
}

/** Mesma ideia de ClienteSummary, para o campo arquiteto (opcional em cada proposta). */
export interface ArquitetoSummary {
  id: string;
  nome: string;
  escritorio: string | null;
  propostas: number;
  valorTotal: number;
  ultimaProposta: string;
  cadastradoManualmente?: boolean;
}

/** Fornecedor — nome/id vêm do banco (tabela `fornecedores`); logo/site/contato ainda são só front-only. */
export interface FornecedorSummary {
  id: string;
  nome: string;
  logoUrl: string | null;
  site: string | null;
  contato: string | null;
}

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
  observacoes: string;
  telefoneCliente: string | null;
  enderecoCliente: string | null;
  emailCliente: string | null;
  ambientes: string[];
  itens: ProposalRow[];
  versoes: ProposalVersion[];
}

export interface VoiceDraftItem {
  product: Product;
  qty: number;
  /** Ambiente citado perto desse item na fala (ex.: "para a sala de estar"), quando identificado. */
  ambiente?: string | null;
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
  /** Dados de contato do cliente citados na fala (ex.: "o telefone dela é..."), quando identificados. */
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
}

export interface RascunhoVozItem {
  codigoExtraido: string;
  produto: Product | null;
  quantidade: number;
  desconto: number;
  status: 'encontrado' | 'nao_encontrado';
}

/** Rascunho de voz real (tabela `proposta_rascunhos`) — chega via um webhook externo
 * de captação por voz, ainda não implementado; por isso a lista costuma vir vazia. */
export interface RascunhoVoz {
  id: number;
  transcricaoOriginal: string;
  clienteNome: string | null;
  arquiteto: string | null;
  vendedorId: string | null;
  vendedorNome: string | null;
  descontoGlobal: number;
  criadoEm: string;
  itens: RascunhoVozItem[];
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
