import { Check, Image as ImageIcon, Pencil, Plus } from 'lucide-react';
import type { Product } from '../../types';
import { formatCurrency } from '../../utils/format';
import { useImageModal } from '../../context/ImageModalContext';
import { useProducts } from '../../context/ProductsContext';
import { useProposalDraft } from '../../context/ProposalDraftContext';
import { useToast } from '../../context/ToastContext';
import ToggleSwitch from '../ui/ToggleSwitch';

interface ProductCardProps {
  product: Product;
  /** Ambiente para o qual "+ Proposta" adiciona o item — sem isso, o item cai em "Itens Gerais". */
  ambiente?: string;
  /** Este produto já está entre os itens do ambiente selecionado — mostra um selo no card. */
  alreadyInAmbiente?: boolean;
}

export default function ProductCard({ product, ambiente, alreadyInAmbiente }: ProductCardProps) {
  const { openImageModal } = useImageModal();
  const { setVendaDireta } = useProducts();
  const { addProductToProposal } = useProposalDraft();
  const { showToast } = useToast();

  return (
    <div
      className="card product-card overflow-hidden"
      data-product-id={product.id}
      style={{ cursor: 'pointer', ...(alreadyInAmbiente ? { borderColor: 'var(--success)' } : {}) }}
      title="Ver detalhes, imagens e analytics do produto"
      onClick={() => openImageModal(product, 'info')}
    >
      <div style={{ aspectRatio: '1/1', overflow: 'hidden', position: 'relative', background: '#fff' }}>
        <img src={product.img} alt={`${product.name} – imagem do produto`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        <span className="badge" style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(26,32,44,.75)', color: '#fefefe', fontSize: 10.5, backdropFilter: 'blur(4px)' }}>
          {product.id}
        </span>
        {alreadyInAmbiente && ambiente && (
          <span
            className="badge"
            style={{ position: 'absolute', bottom: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--success)', color: '#fefefe', fontSize: 10.5 }}
            title={`Já adicionado ao ambiente "${ambiente}"`}
          >
            <Check style={{ width: 10, height: 10 }} /> Já em {ambiente}
          </span>
        )}
        <button
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(26,32,44,.65)', border: 'none', borderRadius: 8, padding: 5, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
          title="Gerir Imagens"
          aria-label={`Gerir imagens de ${product.name}`}
          onClick={(e) => {
            e.stopPropagation();
            openImageModal(product, 'imagens');
          }}
        >
          <ImageIcon style={{ width: 14, height: 14, color: '#fefefe', display: 'block' }} />
        </button>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{product.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{[product.supplier, product.finish, product.material].filter(Boolean).join(' · ')}</div>
        {product.dimensions && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{product.dimensions}</div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <Pencil style={{ width: 10, height: 10, flexShrink: 0 }} /> Clique no card para editar informações
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: 4 }}>
          <ToggleSwitch
            checked={Boolean(product.vendaDireta)}
            onChange={(checked) => setVendaDireta(product.id, checked)}
            onLabel="Venda Direta"
            offLabel="Venda Direta"
            ariaLabel={`Venda direta: ${product.id}`}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(product.price)}</div>
          <button
            className="btn btn-primary btn-sm"
            aria-label={`Adicionar ${product.name} à proposta`}
            onClick={(e) => {
              e.stopPropagation();
              addProductToProposal(product, ambiente);
              showToast(
                ambiente ? `"${product.name}" adicionado ao ambiente "${ambiente}".` : `"${product.name}" adicionado à proposta.`,
                'success',
              );
            }}
          >
            <Plus style={{ width: 12, height: 12 }} /> Proposta
          </button>
        </div>
      </div>
    </div>
  );
}
