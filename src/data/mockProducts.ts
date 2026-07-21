import type { Product } from '../types';

export const MOCK_PRODUCTS: Product[] = [
  { id: 'GD-CAD-001', name: 'Cadeira Barcelona',      cat: 'Cadeiras',   supplier: 'Artefacto',       finish: 'Couro',   material: 'Couro / Aço inox', price: 4890,  img: 'https://picsum.photos/seed/gd001/400/400', dimensions: '76 × 68 × 84 cm (L×P×A)' },
  { id: 'GD-MES-003', name: 'Mesa de Jantar Carrara', cat: 'Mesas',      supplier: 'Casa da Mesa',     finish: 'Mármore', material: 'Mármore Carrara', price: 8750,  img: 'https://picsum.photos/seed/gd003/400/400', dimensions: '180 × 90 × 76 cm (L×P×A)' },
  { id: 'GD-SOF-005', name: 'Sofá Modulare',          cat: 'Sofás',      supplier: 'Artefacto',        finish: 'Veludo',  material: 'Veludo / Madeira', price: 12400, img: 'https://picsum.photos/seed/gd005/400/400', dimensions: '220 × 95 × 85 cm (L×P×A)' },
  { id: 'GD-LUM-007', name: 'Luminária Suspensa Arc', cat: 'Iluminação', supplier: 'Punto Luce',       finish: 'Metal',   material: 'Latão / Metalizado', price: 2100,  img: 'https://picsum.photos/seed/gd007/400/400', dimensions: '30 × 30 × 150 cm (Ø×Ø×cabo)' },
  { id: 'GD-ARM-009', name: 'Armário Ripado',         cat: 'Armários',   supplier: 'Dpot',             finish: 'Madeira', material: 'Tauari Classe 02', price: 6300,  img: 'https://picsum.photos/seed/gd009/400/400', dimensions: '160 × 45 × 200 cm (L×P×A)' },
  { id: 'GD-POL-011', name: 'Poltrona Egg Bouclê',    cat: 'Cadeiras',   supplier: 'Artefacto',        finish: 'Veludo',  material: 'Bouclê', price: 3950,  img: 'https://picsum.photos/seed/gd011/400/400', dimensions: '85 × 80 × 105 cm (L×P×A)' },
  { id: 'GD-MES-013', name: 'Mesa de Centro Float',   cat: 'Mesas',      supplier: 'Dpot',             finish: 'Mármore', material: 'Mármore / Madeira', price: 3200,  img: 'https://picsum.photos/seed/gd013/400/400', dimensions: '110 × 60 × 35 cm (L×P×A)' },
  { id: 'GD-CAM-015', name: 'Cama Platform',          cat: 'Acessórios', supplier: 'Artefacto',        finish: 'Madeira', material: 'Madeira / Tecido', price: 7800,  img: 'https://picsum.photos/seed/gd015/400/400', dimensions: '160 × 200 × 40 cm (L×C×A, colchão Queen)' },
  { id: 'GD-APA-017', name: 'Aparador Brutalist',     cat: 'Acessórios', supplier: 'Tok&Stok Premium', finish: 'Aço',     material: 'Aço / Concreto', price: 4500,  img: 'https://picsum.photos/seed/gd017/400/400', dimensions: '140 × 40 × 75 cm (L×P×A)' },
  { id: 'GD-LUM-019', name: 'Luminária de Piso Arco', cat: 'Iluminação', supplier: 'Punto Luce',       finish: 'Metal',   material: 'Latão / Mármore', price: 1850,  img: 'https://picsum.photos/seed/gd019/400/400', dimensions: '55 × 55 × 210 cm (base×base×A)' },
  { id: 'GD-EST-021', name: 'Prateleiras Flotante',   cat: 'Armários',   supplier: 'Tok&Stok Premium', finish: 'Madeira', material: 'MDF revestido', price: 2300,  img: 'https://picsum.photos/seed/gd021/400/400', dimensions: '100 × 25 × 20 cm (por módulo)' },
  { id: 'GD-TAP-023', name: 'Tapete Geométrico',      cat: 'Acessórios', supplier: 'Casa da Mesa',     finish: 'Veludo',  material: 'Lã / Algodão', price: 3600,  img: 'https://picsum.photos/seed/gd023/400/400', dimensions: '200 × 250 cm (L×C)' },
];

export const CATALOG_FACETS = {
  categories: [
    { value: 'Cadeiras', count: 38 },
    { value: 'Mesas', count: 29 },
    { value: 'Sofás', count: 22 },
    { value: 'Iluminação', count: 41 },
    { value: 'Armários', count: 17 },
    { value: 'Acessórios', count: 100 },
  ],
  suppliers: ['Artefacto', 'Dpot', 'Tok&Stok Premium', 'Casa da Mesa', 'Punto Luce'],
  finishes: ['Couro', 'Veludo', 'Mármore', 'Madeira', 'Aço', 'Metal'],
};
