import { useState } from 'react';
import { Info, Trash2 } from 'lucide-react';
import { useProposalDraft } from '../../context/ProposalDraftContext';
import { useProducts } from '../../context/ProductsContext';
import { isUpholsteredCategory } from '../../data/materialSuggestions';
import { formatCurrency, parseClamped } from '../../utils/format';
import ProposalItemDetailModal from './ProposalItemDetailModal';
import type { ProposalRow } from '../../types';

interface ProposalItemRowProps {
  row: ProposalRow;
  index: number;
}

export default function ProposalItemRow({ row, index }: ProposalItemRowProps) {
  const { header, updateRow, removeRow } = useProposalDraft();
  const { products } = useProducts();
  const [detailOpen, setDetailOpen] = useState(false);

  const line = row.qty * row.price * (1 - row.disc / 100);
  const matchedProduct = products.find((p) => p.id.toLowerCase() === row.code.trim().toLowerCase());
  const materialCount = isUpholsteredCategory(matchedProduct?.cat) ? row.materiais.length : 0;
  const hasHighlightChoice = (matchedProduct?.images ?? []).length > 1;
  const hasProductCustomization = matchedProduct
    ? (row.acabamento ?? matchedProduct.finish) !== matchedProduct.finish
      || (row.material ?? matchedProduct.material) !== matchedProduct.material
      || (row.dimensions ?? matchedProduct.dimensions) !== matchedProduct.dimensions
      || Math.abs(row.price - matchedProduct.price) > 0.009
    : Boolean(row.acabamento || row.material || row.dimensions);
  const hasCustomizations = materialCount > 0
    || hasProductCustomization
    || (hasHighlightChoice && row.highlightImageId !== undefined);

  function handleCodeChange(value: string) {
    const product = products.find((p) => p.id.toLowerCase() === value.trim().toLowerCase());
    if (product) {
      // Código reconhecido no catálogo: começa novamente com os dados do novo produto.
      // A escolha manual de foto também precisa ser limpa, pois o id pertencia ao produto anterior.
      updateRow(row.id, {
        code: product.id,
        desc: product.name,
        price: product.price,
        acabamento: product.finish,
        material: product.material,
        dimensions: product.dimensions,
        materiais: [],
        highlightImageId: undefined,
      });
    } else {
      updateRow(row.id, { code: value });
    }
  }

  return (
    <>
      <tr>
        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{index + 1}</td>
        <td>
          {header.ambientes.length === 0 ? (
            // Sem ambiente nenhum criado, não há pra onde reatribuir o item — um <select>
            // desabilitado ainda desenha a setinha de dropdown do navegador, sugerindo uma
            // interação que não existe. Texto simples em vez disso.
            <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', padding: '4px 6px', display: 'inline-block' }}>
              Itens Gerais
            </span>
          ) : (
            <select
              className="proposal-input"
              style={{ width: 120 }}
              value={row.ambiente}
              onChange={(e) => updateRow(row.id, { ambiente: e.target.value })}
              aria-label={`Ambiente do item ${index + 1}`}
            >
              <option value="">— Itens Gerais —</option>
              {header.ambientes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </td>
        <td>
          <input
            className="proposal-input mono"
            style={{ width: 110 }}
            placeholder="GD-..."
            title="Digite um código do catálogo para preencher descrição, preço e foto automaticamente"
            value={row.code}
            onChange={(e) => handleCodeChange(e.target.value)}
          />
        </td>
        <td>
          <div className="flex items-center gap-2">
            {matchedProduct
              ? (
                <img
                  src={matchedProduct.img}
                  alt={matchedProduct.name}
                  className="row-thumb"
                  title={[
                    matchedProduct.supplier,
                    row.acabamento ?? matchedProduct.finish,
                    row.material ?? matchedProduct.material,
                    row.dimensions ?? matchedProduct.dimensions,
                  ].filter(Boolean).join(' · ')}
                />
              )
              : <span className="row-thumb-empty" title="Sem produto do catálogo vinculado" />}
            <input className="proposal-input" style={{ width: '100%' }} value={row.desc} onChange={(e) => updateRow(row.id, { desc: e.target.value })} />
            {matchedProduct?.vendaDireta && (
              <span className="badge badge-gold" style={{ fontSize: 10, flexShrink: 0 }} title="Este produto pode ser vendido direto">
                Venda Direta
              </span>
            )}
          </div>
        </td>
        <td>
          <input type="number" min={1} className="proposal-input mono text-center" style={{ width: 65 }} value={row.qty} aria-label={`Quantidade do item ${index + 1}`} onChange={(e) => updateRow(row.id, { qty: parseClamped(e.target.value, 1, 9999) })} />
        </td>
        <td>
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>R$</span>
            <input type="number" min={0} className="proposal-input mono" style={{ width: 100 }} value={row.price} aria-label={`Preço unitário do item ${index + 1}`} onChange={(e) => updateRow(row.id, { price: parseClamped(e.target.value, 0, 99999999) })} />
          </div>
        </td>
        <td>
          <input type="number" min={0} max={100} className="proposal-input mono text-center" style={{ width: 65 }} value={row.disc} aria-label={`Desconto do item ${index + 1} em %`} onChange={(e) => updateRow(row.id, { disc: parseClamped(e.target.value, 0, 100) })} />
        </td>
        <td>
          <span className="mono font-semibold" style={{ color: 'var(--primary)' }}>{formatCurrency(line)}</span>
        </td>
        <td>
          <button
            className="btn btn-sm"
            style={{
              border: `1.5px solid ${hasCustomizations ? 'var(--gold)' : 'var(--border)'}`,
              color: hasCustomizations ? 'var(--gold-text)' : 'var(--text-secondary)',
              width: '100%', justifyContent: 'center',
            }}
            aria-label={`Ver detalhes do item ${index + 1} (personalização e imagem de destaque)`}
            title="Ver personalização do produto e imagem de destaque"
            onClick={() => setDetailOpen(true)}
          >
            <Info style={{ width: 13, height: 13 }} />
            Detalhes{materialCount > 0 ? ` (${materialCount})` : ''}
            {hasProductCustomization && <span className="proposal-detail-dot" aria-label="Item personalizado" />}
          </button>
        </td>
        <td>
          <button className="btn btn-ghost btn-sm" aria-label={`Remover item ${index + 1}`} onClick={() => removeRow(row.id)}>
            <Trash2 style={{ width: 13, height: 13, color: 'var(--error)' }} />
          </button>
        </td>
      </tr>

      <ProposalItemDetailModal row={row} index={index} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
}
