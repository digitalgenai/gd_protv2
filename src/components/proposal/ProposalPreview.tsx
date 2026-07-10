import { useEffect } from 'react';
import { FileDown, X } from 'lucide-react';
import { useProducts } from '../../context/ProductsContext';
import { useProposalDraft, PAYMENT_OPTIONS } from '../../context/ProposalDraftContext';
import { groupByAmbiente, shouldShowAmbienteHeaders, orderGroupsByAmbientList } from '../../utils/groupByAmbiente';
import { vendedorLabel } from '../../data/vendedores';
import DocumentSheet from './DocumentSheet';

interface ProposalPreviewProps {
  open: boolean;
  onClose: () => void;
  onGeneratePdf: () => void;
}

/** Prévia em tela do documento — o mesmo visual que o cliente verá no PDF. */
export default function ProposalPreview({ open, onClose, onGeneratePdf }: ProposalPreviewProps) {
  const { header, rows, proposalCode, subtotal, total } = useProposalDraft();
  const { products } = useProducts();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const groups = orderGroupsByAmbientList(groupByAmbiente(rows), header.ambientes);
  const showAmbienteHeaders = shouldShowAmbienteHeaders(groups);
  const codeDisplay = proposalCode.replace(/\.CLIENTE$/, '');
  const vendedorDisplay = vendedorLabel(header.vendedor);
  const pagamento = PAYMENT_OPTIONS.includes(header.pagamento) ? header.pagamento : PAYMENT_OPTIONS[0];
  const validadeDate = header.validade ? new Date(`${header.validade}T00:00:00`) : null;

  return (
    <div
      className={`preview-overlay${open ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Prévia da proposta"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="preview-sheet">
        <div className="preview-toolbar">
          <span className="preview-toolbar-title">Prévia do documento</span>
          <span style={{ fontSize: 11.5, color: '#A1A1AA' }}>É assim que o cliente vai receber</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-gold btn-sm" onClick={onGeneratePdf}>
              <FileDown style={{ width: 13, height: 13 }} /> Gerar PDF
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#A1A1AA' }} aria-label="Fechar prévia" onClick={onClose}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        <DocumentSheet
          codeDisplay={codeDisplay}
          cliente={header.cliente}
          arquiteto={header.arquiteto}
          vendedorLabel={vendedorDisplay}
          pagamento={pagamento}
          validadeDate={validadeDate}
          vendaDireta={header.vendaDireta}
          groups={groups}
          showAmbienteHeaders={showAmbienteHeaders}
          products={products}
          subtotal={subtotal}
          globalDiscount={header.globalDiscount}
          total={total}
          observacoes={header.observacoes}
        />
      </div>
    </div>
  );
}
