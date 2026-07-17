import { useRef, useState } from 'react';

/** Grava áudio de verdade (MediaRecorder) pra mandar pro Whisper — diferente da Web Speech API
 * usada antes, aqui não tem transcrição ao vivo: o texto só sai depois de parar de gravar e o
 * áudio ser processado no backend (ver api/voice.ts).
 *
 * Deixa o navegador escolher o mimeType (não força codec) — forçar explicitamente já causou
 * gravações vindo sem áudio de verdade em teste real; `recorder.mimeType` (lido depois, em
 * onstop) já reflete o formato que o navegador realmente usou, então api/voice.ts consegue
 * mandar a extensão certa pro Whisper sem precisar fixar o codec aqui. */
export function useAudioRecorder(onStop: (blob: Blob) => void, onError?: (message: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Toque para começar a gravar');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onStop(blob);
      };

      recorder.start();
      setIsRecording(true);
      setStatus('Ouvindo… fale agora');
    } catch {
      onError?.('Permissão de microfone negada pelo navegador.');
    }
  }

  function stop() {
    if (!isRecording) return;
    setIsRecording(false);
    setStatus('Processando gravação…');
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  return { isRecording, status, setStatus, start, stop };
}
