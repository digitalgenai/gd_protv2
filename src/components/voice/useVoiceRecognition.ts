import { useRef, useState } from 'react';
import { VOICE_SIMULATION_PHRASES } from './voiceParser';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function buildRecognition(): SpeechRecognitionLike | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'pt-BR';
  r.continuous = true;
  r.interimResults = true;
  return r;
}

/** Grava por voz via Web Speech API do navegador (com fallback simulado quando a API não existe). */
export function useVoiceRecognition(onText: (fullText: string) => void, onError?: (message: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Toque para começar a gravar');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fullTextRef = useRef('');
  const simulationTimerRef = useRef<ReturnType<typeof setInterval>>();
  const isRecordingRef = useRef(false);

  function start() {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    setIsRecording(true);
    fullTextRef.current = '';
    onText('');
    setStatus('Ouvindo… fale agora');

    const recognition = buildRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      recognition.onresult = (e: any) => {
        let newFinal = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) newFinal += e.results[i][0].transcript + ' ';
          else interim += e.results[i][0].transcript;
        }
        fullTextRef.current += newFinal;
        onText((fullTextRef.current + interim).trim());
      };
      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') onError?.('Permissão de microfone negada pelo navegador.');
        stop();
      };
      recognition.onend = () => {
        if (isRecordingRef.current) recognition.start();
      };
      recognition.start();
    } else {
      setStatus('Ouvindo… (simulação)');
      let i = 0;
      simulationTimerRef.current = setInterval(() => {
        fullTextRef.current += VOICE_SIMULATION_PHRASES[i] || '';
        i++;
        onText(fullTextRef.current.trim());
        if (i >= VOICE_SIMULATION_PHRASES.length) clearInterval(simulationTimerRef.current);
      }, 900);
    }
  }

  function stop() {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    clearInterval(simulationTimerRef.current);
    setStatus(fullTextRef.current.trim() ? 'Gravação concluída.' : 'Gravação encerrada.');
  }

  return { isRecording, status, start, stop };
}
