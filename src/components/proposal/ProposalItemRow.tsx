import { useState } from 'react';
import { Image as ImageIcon, Layers, Plus, Trash2 } from 'lucide-react';
import { useProposalDraft } from '../../context/ProposalDraftContext';
import { useProducts } from '../../context/ProductsContext';
import { MATERIAL_SUGGESTIONS_BY_CATEGORY } from '../../data/materialSuggestions';
import { formatCurrency, parseClamped } from '../../utils/format';
import type { ProposalRow } from '../../types';

interface ProposalItemRowProps {
  row: ProposalRow;
  index: number;
}

export default function ProposalItemRow({ row, index }: ProposalItemRowProps) {
  const { header, updateRow, removeRow, addMaterial, updateMaterial, removeMaterial } = useProposalDraft();
  const { products } = useProducts();
  const [expanded, setExpanded] = useState(false);
  const [expandedImg, setExpandedImg] = useState(false);

  const line = row.qty * row.price * (1 - row.disc / 100);
  const materialCount = row.materiais.length;
  const matchedProduct = products.find((p) => p.id.toLowerCase() === row.code.trim().toLowerCase());
  const usedDescricoes = row.materiais.map((m) => m.descricao.trim().toLowerCase());
  const materialSuggestions = (matchedProduct ? MATERIAL_SUGGESTIONS_BY_CATEGORY[matchedProduct.cat] ?? [] : [])
    .filter((s) => !usedDescricoes.includes(s.toLowerCase()));
  const highlightCandidates = matchedProduct?.images ?? [];
  const hasHighlightChoice = highlightCandidates.length > 1;

  function handleCodeChange(value: string) {
    const product = products.find((p) => p.id.toLowerCase() === value.trim().toLowerCase());
    if (product) {
      // Código reconhecido no catálogo: preenche descrição e preço automaticamente.
      updateRow(row.id, { code: product.id, desc: product.name, price: product.price });
    } else {
      updateRow(row.id, { code: value });
    }
  }

  return (
    <>
      <tr>
        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{index + 1}</td>
        <td>
          <select
            className="proposal-input"
            style={{ width: 120 }}
            value={row.ambiente}
            disabled={header.ambientes.length === 0}
            title={header.ambientes.length === 0 ? 'Crie um ambiente acima para poder relacionar este item' : undefined}
            onChange={(e) => updateRow(row.id, { ambiente: e.target.value })}
            aria-label={`Ambiente do item ${index + 1}`}
          >
            <option value="">— Itens Gerais —</option>
            {header.ambientes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
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
              ? <img src={matchedProduct.img} alt={matchedProduct.name} className="row-thumb" title={`${matchedProduct.supplier} · ${matchedProduct.finish}`} />
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
              background: expanded ? 'rgba(133,34,40,.12)' : 'transparent',
              border: `1.5px solid ${materialCount > 0 || expanded ? 'var(--gold)' : 'var(--border)'}`,
              color: materialCount > 0 || expanded ? 'var(--gold-text)' : 'var(--text-secondary)',
              width: '100%', justifyContent: 'center',
            }}
            aria-expanded={expanded}
            aria-label={`Materiais de outros fornecedores do item ${index + 1} (ex.: tecido, ferragem)`}
            title="Adicione materiais de outros fornecedores usados neste item (ex.: tecido, ferragem)"
            onClick={() => setExpanded((e) => !e)}
          >
            <Layers style={{ width: 13, height: 13 }} />
            Materiais{materialCount > 0 ? ` (${materialCount})` : ''}
          </button>
        </td>
        <td>
          {hasHighlightChoice ? (
            <button
              className="btn btn-sm"
              style={{
                background: expandedImg ? 'rgba(133,34,40,.12)' : 'transparent',
                border: `1.5px solid ${row.highlightImageId !== undefined || expandedImg ? 'var(--gold)' : 'var(--border)'}`,
                color: row.highlightImageId !== undefined || expandedImg ? 'var(--gold-text)' : 'var(--text-secondary)',
                width: '100%', justifyContent: 'center',
              }}
              aria-expanded={expandedImg}
              aria-label={`Escolher imagem de destaque do item ${index + 1} para o PDF`}
              title="Escolha qual foto deste produto aparece na página &quot;Itens em Destaque&quot; do PDF"
              onClick={() => setExpandedImg((e) => !e)}
            >
              <ImageIcon style={{ width: 13, height: 13 }} />
              Destaque
            </button>
          ) : (
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>—</span>
          )}
        </td>
        <td>
          <button className="btn btn-ghost btn-sm" aria-label={`Remover item ${index + 1}`} onClick={() => removeRow(row.id)}>
            <Trash2 style={{ width: 13, height: 13, color: 'var(--error)' }} />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={11} style={{ background: 'var(--bg)', padding: '10px 16px 14px 46px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Materiais de outros fornecedores
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Use quando parte deste item vem de um fornecedor diferente — ex.: o sofá é da Artefacto, mas o tecido é de outro fornecedor.
            </div>

            {row.materiais.length > 0 && (
              <div className="space-y-2 mb-2">
                {row.materiais.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <input
                      className="form-input"
                      style={{ flex: 2, fontSize: 13, padding: '6px 10px' }}
                      placeholder="Descrição do material (ex.: Tecido Veludo Verde-Musgo)"
                      value={m.descricao}
                      onChange={(e) => updateMaterial(row.id, m.id, { descricao: e.target.value })}
                    />
                    <input
                      className="form-input"
                      style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                      placeholder="Fornecedor do material"
                      value={m.fornecedor}
                      onChange={(e) => updateMaterial(row.id, m.id, { fornecedor: e.target.value })}
                    />
                    <button className="btn btn-ghost btn-sm" aria-label="Remover material" onClick={() => removeMaterial(row.id, m.id)}>
                      <Trash2 style={{ width: 13, height: 13, color: 'var(--error)' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {matchedProduct && materialSuggestions.length > 0 && (
              <div className="mb-2">
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Sugestões para {matchedProduct.cat.toLowerCase()}:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {materialSuggestions.map((s) => (
                    <button
                      key={s}
                      className="btn btn-ghost btn-sm"
                      style={{ border: '1px dashed var(--border)', fontSize: 11.5 }}
                      onClick={() => addMaterial(row.id, s)}
                    >
                      <Plus style={{ width: 11, height: 11 }} /> {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-outline btn-sm" onClick={() => addMaterial(row.id)}>
              <Plus style={{ width: 12, height: 12 }} /> Adicionar material em branco
            </button>
          </td>
        </tr>
      )}

      {expandedImg && hasHighlightChoice && (
        <tr>
          <td colSpan={11} style={{ background: 'var(--bg)', padding: '10px 16px 14px 46px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Imagem de destaque no PDF
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Escolha qual foto deste produto aparece na página &quot;Itens em Destaque&quot; da proposta.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-sm"
                style={{
                  border: `1.5px solid ${row.highlightImageId === undefined ? 'var(--gold)' : 'var(--border)'}`,
                  color: row.highlightImageId === undefined ? 'var(--gold-text)' : 'var(--text-secondary)',
                }}
                onClick={() => updateRow(row.id, { highlightImageId: undefined })}
              >
                Automático
              </button>
              <button
                className="btn btn-sm"
                style={{
                  border: `1.5px solid ${row.highlightImageId === null ? 'var(--error)' : 'var(--border)'}`,
                  color: row.highlightImageId === null ? 'var(--error)' : 'var(--text-secondary)',
                }}
                onClick={() => updateRow(row.id, { highlightImageId: null })}
              >
                Nenhuma
              </button>
              {highlightCandidates.map((img) => (
                <button
                  key={img.id}
                  onClick={() => updateRow(row.id, { highlightImageId: img.id })}
                  aria-label={`Usar imagem ${img.posicao} como destaque`}
                  title={`Imagem ${img.posicao}`}
                  style={{
                    padding: 0, width: 52, height: 52, flexShrink: 0, cursor: 'pointer',
                    borderRadius: 8, overflow: 'hidden', background: '#fff',
                    border: `2px solid ${row.highlightImageId === img.id ? 'var(--gold)' : 'var(--border)'}`,
                  }}
                >
                  <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
