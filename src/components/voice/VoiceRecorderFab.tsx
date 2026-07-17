import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Home, Loader2, Mail, MapPin, Mic, PencilRuler, Phone, Square, User, X } from 'lucide-react';
import { useProposalDraft } from '../../context/ProposalDraftContext';
import { useToast } from '../../context/ToastContext';
import { transcreverAudio } from '../../api/voice';
import { useAudioRecorder } from './useAudioRecorder';
import { formatCurrency } from '../../utils/format';
import type { ParsedVoiceResult } from '../../types';

const FAB_ROUTES: Record<string, string> = {
  '/': 'Inicie uma nova proposta por voz',
  '/catalogo': 'Fale o produto — será adicionado à proposta',
  '/propostas/nova': 'Diga produtos, cliente e desconto',
};

export default function VoiceRecorderFab() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applyVoiceResult } = useProposalDraft();
  const { showToast } = useToast();

  const subtitle = FAB_ROUTES[location.pathname];
  const visible = subtitle !== undefined;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<ParsedVoiceResult | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleStop(blob: Blob) {
    setProcessing(true);
    try {
      const result = await transcreverAudio(blob);
      setTranscript(result.transcricao);
      setParsed(result.parsed);
      setStatus('Gravação processada.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível transcrever o áudio.', 'error');
      setStatus('Falha ao processar — tente gravar de novo.');
    } finally {
      setProcessing(false);
    }
  }

  const { isRecording, status, setStatus, start, stop } = useAudioRecorder(
    handleStop,
    (message) => showToast(message, 'error'),
  );

  useEffect(() => {
    if (!visible && popoverOpen) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!popoverOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popoverOpen]);

  function close() {
    stop();
    setPopoverOpen(false);
  }

  function applyToProposal() {
    close();
    if (!parsed) return;
    applyVoiceResult(parsed);
    if (location.pathname !== '/propostas/nova') navigate('/propostas/nova');
    showToast(`Proposta preenchida com ${parsed.items.length} item(ns) via voz!`, 'success');
  }

  if (!visible) return null;

  const hasContent = Boolean(parsed && (
    parsed.client || parsed.clientPhone || parsed.clientEmail || parsed.clientAddress
    || parsed.architect || parsed.discount || parsed.items.length
  ));
  const applyEnabled = Boolean(parsed && (parsed.items.length > 0 || parsed.client));
  const estimatedTotal = parsed ? parsed.items.reduce((s, it) => s + it.qty * it.product.price, 0) * (1 - (parsed.discount || 0) / 100) : 0;

  return (
    <>
      <button
        id="rec-fab"
        className={`rec-fab visible${isRecording ? ' recording' : ''}`}
        aria-label="Gravar proposta por voz"
        title="Criar proposta por voz"
        onClick={() => setPopoverOpen((o) => !o)}
      >
        <Mic style={{ width: 24, height: 24, color: '#fefefe', pointerEvents: 'none' }} />
      </button>

      <div id="rec-popover" className={`rec-popover${popoverOpen ? ' open' : ''}`} role="dialog" aria-label="Gravação de voz">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isRecording ? 'var(--error)' : 'var(--text-secondary)', transition: 'background .3s' }} />
            <div>
              <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>
                {isRecording ? 'Gravando…' : processing ? 'Processando…' : 'Criar Proposta por Voz'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.2 }}>{subtitle}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} aria-label="Fechar" onClick={close}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="px-4 py-3" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
          <div className="flex items-center gap-3 mb-3">
            <button
              id="btn-rec-toggle"
              style={{
                width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E53E3E',
                boxShadow: isRecording ? '0 4px 16px rgba(229,62,62,.55)' : '0 4px 12px rgba(229,62,62,.35)',
                transition: 'background .2s, box-shadow .2s', opacity: processing ? 0.6 : 1,
              }}
              aria-label="Iniciar / parar gravação"
              disabled={processing}
              onClick={() => {
                if (isRecording) {
                  stop();
                  return;
                }
                setTranscript('');
                setParsed(null);
                start();
              }}
            >
              {processing
                ? <Loader2 className="spin" style={{ width: 22, height: 22, color: '#fefefe' }} />
                : isRecording ? <Square style={{ width: 22, height: 22, color: '#fefefe' }} /> : <Mic style={{ width: 22, height: 22, color: '#fefefe' }} />}
            </button>

            <div className="flex-1">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{status}</div>
              <div className={`flex items-end gap-1${isRecording ? '' : ' wave-bars-idle'}`} style={{ height: 24 }}>
                {Array.from({ length: 7 }).map((_, i) => <div key={i} className="wave-bar" />)}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', minHeight: 52, border: '1.5px solid var(--border)', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-secondary)', marginBottom: 4 }}>Transcrição</div>
            <p style={{ fontSize: 13, color: 'var(--primary)', lineHeight: 1.55, minHeight: 18 }}>
              {transcript || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Grave e a transcrição aparece aqui assim que terminar de processar...</span>}
            </p>
          </div>

          {hasContent && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-secondary)', marginBottom: 6 }}>Extraído</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {parsed?.client && <span className="extracted-tag tag-client"><User style={{ width: 11, height: 11 }} />{parsed.client}</span>}
                {parsed?.clientPhone && <span className="extracted-tag tag-client"><Phone style={{ width: 11, height: 11 }} />{parsed.clientPhone}</span>}
                {parsed?.clientEmail && <span className="extracted-tag tag-client"><Mail style={{ width: 11, height: 11 }} />{parsed.clientEmail}</span>}
                {parsed?.clientAddress && <span className="extracted-tag tag-client"><MapPin style={{ width: 11, height: 11 }} />{parsed.clientAddress}</span>}
                {parsed?.architect && <span className="extracted-tag tag-client"><PencilRuler style={{ width: 11, height: 11 }} />Arq. {parsed.architect}</span>}
                {Boolean(parsed?.discount) && <span className="extracted-tag tag-discount">{parsed?.discount}% desconto</span>}
                {Array.from(new Set(parsed?.items.map((i) => i.ambiente).filter((a): a is string => Boolean(a)))).map((ambiente) => (
                  <span key={ambiente} className="extracted-tag tag-client"><Home style={{ width: 11, height: 11 }} />{ambiente}</span>
                ))}
                {parsed?.items.map((item, i) => (
                  <span key={i} className="extracted-tag tag-product">{item.qty}× {item.product.name}</span>
                ))}
              </div>
            </div>
          )}

          {Boolean(parsed?.items.length) && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-secondary)', marginBottom: 6 }}>Itens detectados</div>
              <div className="space-y-1.5">
                {parsed?.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    <div className="flex-1">
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.product.id} · {item.product.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Qtd: {item.qty} · {formatCurrency(item.product.price)} cada
                        {item.ambiente && <> · <Home style={{ width: 10, height: 10, display: 'inline', verticalAlign: -1 }} /> {item.ambiente}</>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg mt-3" style={{ background: 'rgba(133,34,40,.08)', border: '1px solid rgba(133,34,40,.3)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gold-text)', marginBottom: 2 }}>Valor estimado</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(estimatedTotal)}</div>
              </div>
            </div>
          )}

          {!hasContent && (
            <div id="rec-hint" style={{ background: 'rgba(133,34,40,.07)', border: '1px solid rgba(133,34,40,.25)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11.5, color: '#852228', fontWeight: 600, marginBottom: 4 }}>Exemplos</div>
              <ul style={{ fontSize: 11.5, color: '#641A1E', lineHeight: 1.75, listStyle: 'disc', paddingLeft: 16 }}>
                <li>&quot;<em>Três cadeiras barcelona, cliente Studio Lima</em>&quot;</li>
                <li>&quot;<em>Duas mesas carrara para a sala de jantar, desconto dez por cento</em>&quot;</li>
                <li>&quot;<em>Um sofá modulare cinza para a sala de estar, arquiteto Beatriz</em>&quot;</li>
              </ul>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
          <button className="btn btn-outline btn-sm flex-1" onClick={close}>Cancelar</button>
          <button
            className="btn btn-gold btn-sm flex-1"
            style={{ opacity: applyEnabled ? 1 : 0.45, cursor: applyEnabled ? 'pointer' : 'not-allowed' }}
            disabled={!applyEnabled}
            onClick={applyToProposal}
          >
            <Check style={{ width: 13, height: 13 }} /> Aplicar
          </button>
        </div>
      </div>
    </>
  );
}
