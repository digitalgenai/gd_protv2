import type { ProposalDetail, ProposalSummary } from '../types';

export const MOCK_PROPOSALS: ProposalSummary[] = [
  { code: 'GD-05.26.MES.001.v1', cliente: 'Família Mendes',   arquiteto: 'Arq. Beatriz Costa', vendedor: 'Marcos E.',   valor: 47200,  data: '07/05/2026', versao: 1, status: 'Aprovada', pdfGerado: true },
  { code: 'GD-05.26.CAR.002.v2', cliente: 'Ricardo Campos',   arquiteto: null,                 vendedor: 'Carolina R.', valor: 23850,  data: '05/05/2026', versao: 2, status: 'Enviada', pdfGerado: true },
  { code: 'GD-05.26.MES.003.v1', cliente: 'BRK Advocacia',    arquiteto: 'Arq. Fábio Lima',     vendedor: 'Marcos E.',   valor: 91400,  data: '04/05/2026', versao: 1, status: 'Rascunho', pdfGerado: false },
  { code: 'GD-04.26.ROD.004.v1', cliente: 'Hotel Palmeiras',  arquiteto: 'Arq. Marina V.',      vendedor: 'Rodrigo S.',  valor: 138000, data: '22/04/2026', versao: 1, status: 'Reprovada', pdfGerado: true },
  { code: 'GD-05.26.ANA.005.v1', cliente: 'Studio Ateliê',    arquiteto: null,                 vendedor: 'Ana Paula M.',valor: 19300,  data: '08/05/2026', versao: 1, status: 'Revisão', pdfGerado: true },
];

const CAR_002_VERSOES = [
  { code: 'GD-05.26.CAR.002.v1', versao: 1, status: 'Revisão' as const, data: '04/05/2026', pdfGerado: false },
  { code: 'GD-05.26.CAR.002.v2', versao: 2, status: 'Enviada' as const, data: '05/05/2026', pdfGerado: true },
];

/**
 * Detalhe completo das 5 propostas mock — itens ilustrativos (não recalculados a partir do
 * `valor` do resumo; servem para popular a tela de detalhe/PDF/versões enquanto o backend real
 * não existe).
 */
export const MOCK_PROPOSAL_DETAILS: Record<string, ProposalDetail> = {
  'GD-05.26.MES.001.v1': {
    ...MOCK_PROPOSALS[0],
    validade: '2026-05-09',
    pagamento: 'À vista (5% desc.)',
    observacoes: 'Entrega combinada para a segunda quinzena de junho.',
    telefoneCliente: '(11) 98745-2210',
    emailCliente: null,
    enderecoCliente: 'Rua dos Pinheiros, 340 — Pinheiros, São Paulo/SP',
    ambientes: ['Sala de Estar', 'Sala de Jantar'],
    itens: [
      { id: 1, ambiente: 'Sala de Estar', code: 'GD-SOF-005', desc: 'Sofá Modulare', qty: 1, price: 12400, disc: 0, materiais: [] },
      { id: 2, ambiente: 'Sala de Estar', code: 'GD-MES-013', desc: 'Mesa de Centro Float', qty: 1, price: 3200, disc: 0, materiais: [] },
      { id: 3, ambiente: 'Sala de Jantar', code: 'GD-MES-003', desc: 'Mesa de Jantar Carrara', qty: 1, price: 8750, disc: 0, materiais: [] },
      { id: 4, ambiente: 'Sala de Jantar', code: 'GD-CAD-001', desc: 'Cadeira Barcelona', qty: 5, price: 4890, disc: 10, materiais: [] },
    ],
    versoes: [
      { code: 'GD-05.26.MES.001.v1', versao: 1, status: 'Aprovada', data: '07/05/2026', pdfGerado: true },
    ],
  },
  'GD-05.26.CAR.002.v1': {
    ...MOCK_PROPOSALS[1],
    code: 'GD-05.26.CAR.002.v1',
    versao: 1,
    status: 'Revisão',
    data: '04/05/2026',
    pdfGerado: false,
    validade: '2026-05-06',
    pagamento: '30/60/90 dias',
    observacoes: 'Rascunho anterior — cliente pediu para incluir prateleiras extras (ver v2).',
    telefoneCliente: '(21) 99887-3345',
    emailCliente: null,
    enderecoCliente: null,
    ambientes: ['Escritório'],
    itens: [
      { id: 1, ambiente: 'Escritório', code: 'GD-ARM-009', desc: 'Armário Ripado', qty: 1, price: 6300, disc: 5, materiais: [] },
      { id: 2, ambiente: 'Escritório', code: 'GD-LUM-019', desc: 'Luminária de Piso Arco', qty: 2, price: 1850, disc: 0, materiais: [] },
    ],
    versoes: CAR_002_VERSOES,
  },
  'GD-05.26.CAR.002.v2': {
    ...MOCK_PROPOSALS[1],
    validade: '2026-05-07',
    pagamento: '30/60/90 dias',
    observacoes: '',
    telefoneCliente: '(21) 99887-3345',
    emailCliente: null,
    enderecoCliente: null,
    ambientes: ['Escritório'],
    itens: [
      { id: 1, ambiente: 'Escritório', code: 'GD-ARM-009', desc: 'Armário Ripado', qty: 1, price: 6300, disc: 5, materiais: [] },
      { id: 2, ambiente: 'Escritório', code: 'GD-LUM-019', desc: 'Luminária de Piso Arco', qty: 2, price: 1850, disc: 0, materiais: [] },
      { id: 3, ambiente: 'Escritório', code: 'GD-EST-021', desc: 'Prateleiras Flotante', qty: 5, price: 2300, disc: 15, materiais: [] },
    ],
    versoes: CAR_002_VERSOES,
  },
  'GD-05.26.MES.003.v1': {
    ...MOCK_PROPOSALS[2],
    validade: '2026-05-06',
    pagamento: '10x sem juros no cartão',
    observacoes: 'Cliente pediu revisão do prazo de entrega das poltronas.',
    telefoneCliente: '(11) 3345-8800',
    emailCliente: null,
    enderecoCliente: 'Av. Faria Lima, 1900 — Itaim Bibi, São Paulo/SP',
    ambientes: ['Recepção'],
    itens: [
      { id: 1, ambiente: 'Recepção', code: 'GD-POL-011', desc: 'Poltrona Egg Bouclê', qty: 4, price: 3950, disc: 0, materiais: [] },
      { id: 2, ambiente: 'Recepção', code: 'GD-TAP-023', desc: 'Tapete Geométrico', qty: 2, price: 3600, disc: 0, materiais: [] },
      { id: 3, ambiente: 'Recepção', code: 'GD-APA-017', desc: 'Aparador Brutalist', qty: 3, price: 4500, disc: 5, materiais: [] },
    ],
    versoes: [
      { code: 'GD-05.26.MES.003.v1', versao: 1, status: 'Rascunho', data: '04/05/2026', pdfGerado: false },
    ],
  },
  'GD-04.26.ROD.004.v1': {
    ...MOCK_PROPOSALS[3],
    validade: '2026-04-24',
    pagamento: 'Financiamento direto',
    observacoes: '',
    telefoneCliente: '(48) 3222-1090',
    emailCliente: null,
    enderecoCliente: 'Rodovia SC-401, km 12 — Florianópolis/SC',
    ambientes: ['Suíte Master', 'Área Externa'],
    itens: [
      { id: 1, ambiente: 'Suíte Master', code: 'GD-CAM-015', desc: 'Cama Platform', qty: 8, price: 7800, disc: 10, materiais: [] },
      { id: 2, ambiente: 'Área Externa', code: 'GD-SOF-005', desc: 'Sofá Modulare', qty: 3, price: 12400, disc: 5, materiais: [] },
      { id: 3, ambiente: 'Área Externa', code: 'GD-LUM-007', desc: 'Luminária Suspensa Arc', qty: 6, price: 2100, disc: 0, materiais: [] },
    ],
    versoes: [
      { code: 'GD-04.26.ROD.004.v1', versao: 1, status: 'Reprovada', data: '22/04/2026', pdfGerado: true },
    ],
  },
  'GD-05.26.ANA.005.v1': {
    ...MOCK_PROPOSALS[4],
    validade: '2026-05-10',
    pagamento: 'À vista (5% desc.)',
    observacoes: 'Aguardando confirmação da paleta de cores com o cliente.',
    telefoneCliente: '(11) 97612-4498',
    emailCliente: null,
    enderecoCliente: null,
    ambientes: ['Estúdio'],
    itens: [
      { id: 1, ambiente: 'Estúdio', code: 'GD-MES-013', desc: 'Mesa de Centro Float', qty: 2, price: 3200, disc: 0, materiais: [] },
      { id: 2, ambiente: 'Estúdio', code: 'GD-LUM-019', desc: 'Luminária de Piso Arco', qty: 3, price: 1850, disc: 0, materiais: [] },
      { id: 3, ambiente: 'Estúdio', code: 'GD-TAP-023', desc: 'Tapete Geométrico', qty: 1, price: 3600, disc: 0, materiais: [] },
    ],
    versoes: [
      { code: 'GD-05.26.ANA.005.v1', versao: 1, status: 'Revisão', data: '08/05/2026', pdfGerado: true },
    ],
  },
};
