import { createPortal } from 'react-dom';
import { PackageSearch, Plus, Trash2, X } from 'lucide-react';
import { useProposalDraft } from '../../context/ProposalDraftContext';
import { useProducts } from '../../context/ProductsContext';
import { MATERIAL_SUGGESTIONS_BY_CATEGORY } from '../../data/materialSuggestions';
import { formatCurrency } from '../../utils/format';
import type { ProposalRow } from '../../types';

interface ProposalItemDetailModalProps {
  row: ProposalRow;
  index: number;
  open: boolean;
  onClose: () => void;
}

/** Detalhes de um item da proposta — junta em um só lugar o que antes eram duas linhas
 * expandindo dentro da tabela (Materiais de outros fornecedores + Imagem de destaque),
 * mais os dados do produto do catálogo (só leitura — editar o cadastro em si é lá no
 * Catálogo, não aqui). */
export default function ProposalItemDetailModal({ row, index, open, onClose }: ProposalItemDetailModalProps) {
  const { updateRow, addMaterial, updateMaterial, removeMaterial } = useProposalDraft();
  const { products } = useProducts();

  if (!open) return null;

  const matchedProduct = products.find((p) => p.id.toLowerCase() === row.code.trim().toLowerCase());
  const usedDescricoes = row.materiais.map((m) => m.descricao.trim().toLowerCase());
  const materialSuggestions = (matchedProduct ? MATERIAL_SUGGESTIONS_BY_CATEGORY[matchedProduct.cat] ?? [] : [])
    .filter((s) => !usedDescricoes.includes(s.toLowerCase()));
  const highlightCandidates = matchedProduct?.images ?? [];
  const hasHighlightChoice = highlightCandidates.length > 1;

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
      <div className="modal-box" style={{ width: 640 }}>
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
          {matchedProduct ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="form-label">Categoria</div>
                <div style={{ fontSize: 14 }}>{matchedProduct.cat || '—'}</div>
              </div>
              <div>
                <div className="form-label">Fornecedor</div>
                <div style={{ fontSize: 14 }}>{matchedProduct.supplier || '—'}</div>
              </div>
              <div>
                <div className="form-label">Acabamento</div>
                <div style={{ fontSize: 14 }}>{matchedProduct.finish || '—'}</div>
              </div>
              <div>
                <div className="form-label">Material</div>
                <div style={{ fontSize: 14 }}>{matchedProduct.material || '—'}</div>
              </div>
              <div>
                <div className="form-label">Preço (R$)</div>
                <div className="mono" style={{ fontSize: 14 }}>{matchedProduct.price ? formatCurrency(matchedProduct.price) : '—'}</div>
              </div>
              <div>
                <div className="form-label">Dimensões</div>
                <div style={{ fontSize: 14 }}>{matchedProduct.dimensions || '—'}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-6" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              <PackageSearch style={{ width: 16, height: 16, flexShrink: 0 }} />
              Este item não está vinculado a um produto do catálogo — sem informações adicionais.
            </div>
          )}

          <div className="mb-6">
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Materiais de outros fornecedores
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
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
          </div>

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
