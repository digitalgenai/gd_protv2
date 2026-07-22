import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface DropdownProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  /** false pra campos obrigatórios (ex.: Fornecedor) — some a linha de "limpar seleção". */
  allowEmpty?: boolean;
  className?: string;
}

/** Substitui um <select> nativo quando a lista é longa o suficiente pra o navegador decidir
 * abrir "pra cima" perto do fim da tela (o <select> nativo escolhe a direção sozinho, sem
 * como controlar via CSS). Aqui a lista é nossa (position: fixed, calculada a partir do
 * próprio botão), então sempre abre pra baixo — e não fica presa pelo overflow do modal. */
export default function Dropdown({ id, value, onChange, options, placeholder, allowEmpty = true, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      // A lista vai por portal pro <body> — fora da subárvore do botão — então precisa
      // checar as duas refs; sem isso, clicar numa opção conta como "clique fora" no
      // mousedown e fecha a lista antes do click da opção disparar o pick().
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleClose() {
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [open]);

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen((o) => !o);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`form-input dropdown-trigger ${className ?? ''}`}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? '' : 'dropdown-placeholder'}>{value || placeholder}</span>
        <ChevronDown className="dropdown-chevron" style={{ width: 14, height: 14 }} />
      </button>
      {open && rect && createPortal(
        <div ref={listRef} className="dropdown-list" role="listbox" style={{ top: rect.top, left: rect.left, width: rect.width }}>
          {allowEmpty && (
            <button type="button" className={`dropdown-option${value ? '' : ' selected'}`} onClick={() => pick('')}>
              {placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`dropdown-option${opt === value ? ' selected' : ''}`}
              onClick={() => pick(opt)}
            >
              {opt}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
