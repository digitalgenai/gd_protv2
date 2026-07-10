import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { ToastType } from '../types';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<ToastType, string> = {
  success: 'var(--success)',
  error: 'var(--error)',
  info: '#3182CE',
  warning: 'var(--warning)',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3200);
  }, []);

  const Icon = ICONS[toast.type];

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div id="toast" className={toast.visible ? 'show' : ''} role="status" aria-live="polite">
        <div id="toast-inner" className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl" style={{ background: '#111111', color: '#fff', minWidth: 240, maxWidth: 360 }}>
          <Icon style={{ width: 18, height: 18, flexShrink: 0, color: COLORS[toast.type] }} />
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{toast.message}</span>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
