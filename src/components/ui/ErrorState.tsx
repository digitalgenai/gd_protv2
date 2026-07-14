import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/** Estado de erro genérico — usado sempre que um fetch ao backend real falha (rede caiu, 4xx/5xx). */
export default function ErrorState({ message = 'Não foi possível carregar os dados.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-secondary)' }}>
      <AlertTriangle style={{ width: 36, height: 36, color: 'var(--error)', opacity: 0.7 }} />
      <div style={{ fontSize: 14, textAlign: 'center', maxWidth: 380 }}>{message}</div>
      {onRetry && (
        <button className="btn btn-outline btn-sm" onClick={onRetry}>
          <RefreshCw style={{ width: 13, height: 13 }} /> Tentar novamente
        </button>
      )}
    </div>
  );
}
