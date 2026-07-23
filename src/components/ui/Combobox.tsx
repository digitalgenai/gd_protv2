import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface ComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
}

/** Como o Dropdown, mas digitável — pro Material/tecido, onde a lista de sugestões existentes
 * não pode impedir o vendedor de escrever um material novo, que ainda não tem esse cadastro
 * próprio (ver memory/projects: "Cadastrar Tecido" foi removido). Digitar filtra a lista;
 * clicar numa opção substitui o texto; texto que não bate com nenhuma opção é aceito do
 * mesmo jeito (fica só como valor livre). */
export default function Combobox({ id, value, onChange, options, placeholder, className }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleResize() {
      setOpen(false);
    }
    function handleScroll() {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  function openList() {
    if (wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(true);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    inputRef.current?.focus();
  }

  const query = value.trim().toLowerCase();
  const filtered = query ? options.filter((opt) => opt.toLowerCase().includes(query)) : options;

  return (
    <div className="combobox-wrap" ref={wrapRef}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        className={`form-input combobox-input ${className ?? ''}`}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={openList}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) openList();
        }}
      />
      <button
        type="button"
        className="combobox-chevron-btn"
        tabIndex={-1}
        aria-label="Ver sugestões"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            inputRef.current?.focus();
            openList();
          }
        }}
      >
        <ChevronDown style={{ width: 14, height: 14 }} />
      </button>
      {open && rect && createPortal(
        <div ref={listRef} className="dropdown-list" role="listbox" style={{ top: rect.top, left: rect.left, width: rect.width }}>
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`dropdown-option${opt === value ? ' selected' : ''}`}
                onClick={() => pick(opt)}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="dropdown-empty">Nenhuma sugestão — o texto digitado será usado direto.</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
