import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PackageSearch, Plus, Trash2, X } from 'lucide-react';
import { useProposalDraft } from '../../context/ProposalDraftContext';
import { useProducts } from '../../context/ProductsContext';
import { isUpholsteredCategory, MATERIAL_SUGGESTIONS_BY_CATEGORY } from '../../data/materialSuggestions';
import CurrencyInput from '../ui/CurrencyInput';
import DimensionsInput from '../ui/DimensionsInput';
import Dropdown from '../ui/Dropdown';
import type { ProposalRow } from '../../types';

interface ProposalItemDetailModalProps {
  row: ProposalRow;
  index: number;
  open: boolean;
  onClose: () => void;
}

/** Detalhes de um item da proposta — junta em um só lugar o que antes eram duas linhas
 * expandindo dentro da tabela (Materiais de outros fornecedores + Imagem de destaque), mais
 * acabamento/material/preço/dimensões. Esses quatro são editáveis aqui — vendedor personaliza
 * o móvel pra esta venda (ex.: outra cor, outra medida) sem alterar o cadastro no Catálogo;
 * Categoria e Fornecedor continuam só leitura, são identidade do produto, não da venda. */
export default function ProposalItemDetailModal({ row, index, open, onClose }: ProposalItemDetailModalProps) {
  const { updateRow, addMaterial, updateMaterial, removeMaterial } = useProposalDraft();
  const { products, facets } = useProducts();

  const matchedProduct = products.find((p) => p.id.toLowerCase() === row.code.trim().toLowerCase());
  const currentFinish = row.acabamento ?? matchedProduct?.finish ?? '';
  const currentMaterial = row.material ?? matchedProduct?.material ?? '';
  const finishOptions = [
    ...(currentFinish && !facets.finishes.includes(currentFinish) ? [currentFinish] : []),
    ...facets.finishes,
  ];
  const materialOptions = [
    ...(currentMaterial && !facets.materials.includes(currentMaterial) ? [currentMaterial] : []),
    ...facets.materials,
  ];
  const supportsExternalMaterials = isUpholsteredCategory(matchedProduct?.cat);
  const usedDescricoes = row.materiais.map((m) => m.descricao.trim().toLowerCase());
  const materialSuggestions = (supportsExternalMaterials && matchedProduct ? MATERIAL_SUGGESTIONS_BY_CATEGORY[matchedProduct.cat] ?? [] : [])
    .filter((s) => !usedDescricoes.includes(s.toLowerCase()));
  const highlightCandidates = matchedProduct?.images ?? [];
  const hasHighlightChoice = highlightCandidates.length > 1;

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal pro <body>: este modal é montado de dentro da <tbody> da tabela de itens, que
  // fica num card com a classe "rise-in" — a animação dela deixa um transform:translateY(0)
  // "residual" mesmo depois de terminar (fill-mode both), e qualquer transform vira o
  // container de referência do position:fixed dos descendentes. Sem o portal, o modal
  // centralizava/cortava dentro do card em vez da tela toda (mesmo bug já visto no dropdown).
  return createPortal(
    <div
      className="modal-overlay open"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do item ${index + 1}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box proposal-item-detail-modal" style={{ width: 640 }}>
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 17 }}>
              {matchedProduct?.name || row.desc || 'Item sem descrição'}
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.code || '—'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Fechar detalhes" onClick={onClose}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-3 proposal-item-identity">
            <div>
              <div className="form-label">Categoria</div>
              <div style={{ fontSize: 14 }}>{matchedProduct?.cat || 'Item manual'}</div>
            </div>
            <div>
              <div className="form-label">Fornecedor</div>
              <div style={{ fontSize: 14 }}>{matchedProduct?.supplier || 'Não vinculado ao catálogo'}</div>
            </div>
          </div>

          {!matchedProduct && (
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              <PackageSearch style={{ width: 16, height: 16, flexShrink: 0 }} />
              Item inserido manualmente. Os dados abaixo valem somente para esta proposta.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-1 proposal-item-custom-fields">
            <div>
              <label className="form-label" htmlFor="pi-acabamento">Acabamento</label>
              <Dropdown
                id="pi-acabamento"
                placeholder="— Sem acabamento —"
                value={currentFinish}
                options={finishOptions}
                onChange={(acabamento) => updateRow(row.id, { acabamento })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="pi-material">Material</label>
              <Dropdown
                id="pi-material"
                placeholder="— Sem material —"
                value={currentMaterial}
                options={materialOptions}
                onChange={(material) => updateRow(row.id, { material })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="pi-preco">Preço (R$)</label>
              <CurrencyInput
                id="pi-preco"
                className="form-input"
                value={row.price}
                onChange={(price) => updateRow(row.id, { price })}
              />
            </div>
            <div>
              <DimensionsInput
                idPrefix={`proposal-item-${row.id}-dimensions`}
                value={row.dimensions ?? matchedProduct?.dimensions ?? ''}
                onChange={(dimensions) => updateRow(row.id, { dimensions })}
              />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 22 }}>
            Editável só nesta proposta — não altera o cadastro do produto no Catálogo.
          </div>

          {supportsExternalMaterials && (
          <div className="mb-6">
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Tecido de outro fornecedor
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Use quando o estofado é de um fornecedor, mas o tecido escolhido para esta proposta vem de outro.
            </div>

            {row.materiais.length > 0 && (
              <div className="space-y-2 mb-2">
                {row.materiais.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <input
                      className="form-input"
                      style={{ flex: 2, fontSize: 13, padding: '6px 10px' }}
                      placeholder="Descrição do tecido (ex.: Veludo Verde-Musgo)"
                      value={m.descricao}
                      onChange={(e) => updateMaterial(row.id, m.id, { descricao: e.target.value })}
                    />
                    <input
                      className="form-input"
                      style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                      placeholder="Fornecedor do tecido"
                      value={m.fornecedor}
                      onChange={(e) => updateMaterial(row.id, m.id, { fornecedor: e.target.value })}
                    />
                    <button className="btn btn-ghost btn-sm" aria-label="Remover tecido" onClick={() => removeMaterial(row.id, m.id)}>
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
              <Plus style={{ width: 12, height: 12 }} /> Adicionar tecido
            </button>
          </div>
          )}

          {hasHighlightChoice && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', marginBottom: 2 }}>
                Imagem de destaque no PDF
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Escolha qual foto deste produto aparece na página "Itens em Destaque" da proposta.
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
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
          <button className="btn btn-gold btn-sm" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
