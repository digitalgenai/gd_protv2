import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../../types';

const MAX_RESULTS = 6;

function formatPriceShort(price: number): string {
  return 'R$ ' + price.toLocaleString('pt-BR');
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface GlobalSearchProps {
  products: Product[];
}

export default function GlobalSearch({ products }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? products
        .filter((p) => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
        .slice(0, MAX_RESULTS)
    : [];
  const total = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q)).length
    : 0;

  function goToCatalog(highlightId?: string) {
    setOpen(false);
    setQuery('');
    navigate('/catalogo');
    if (highlightId) {
      setTimeout(() => {
        const card = document.querySelector(`[data-product-id="${highlightId}"]`);
        if (card instanceof HTMLElement) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.outline = '2px solid var(--gold)';
          card.style.outlineOffset = '3px';
          setTimeout(() => {
            card.style.outline = '';
            card.style.outlineOffset = '';
          }, 1800);
        }
      }, 180);
    }
  }

  return (
    <div className="relative hidden md:block" ref={wrapRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 15, height: 15, color: '#979797' }} />
      <input
        id="global-search"
        type="text"
        placeholder="Buscar produto, proposta..."
        className="form-input"
        style={{ width: 280, paddingTop: 7, paddingBottom: 7, paddingLeft: 36, fontSize: 13.5 }}
        aria-label="Busca global"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setFocusedIdx(-1);
          setOpen(e.target.value.trim().length > 0);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIdx((i) => Math.min(results.length - 1, i + 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIdx((i) => Math.max(0, i - 1));
          }
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') {
            if (focusedIdx >= 0 && results[focusedIdx]) goToCatalog(results[focusedIdx].id);
            else if (query.trim()) goToCatalog();
          }
        }}
      />
      <div id="search-dropdown" className={open ? 'open' : ''}>
        {open && results.length === 0 && <div className="ac-empty">Nenhum produto encontrado para &quot;{query}&quot;</div>}
        {open && results.length > 0 && (
          <>
            <div className="ac-header">
              Produtos · {results.length} resultado{results.length > 1 ? 's' : ''}
            </div>
            {results.map((p, i) => (
              <div key={p.id} className={`ac-item${i === focusedIdx ? ' focused' : ''}`} onClick={() => goToCatalog(p.id)}>
                <img className="ac-thumb" src={p.img} alt={p.name} loading="lazy" />
                <div className="ac-info">
                  <div className="ac-name">{highlightMatch(p.name, query)}</div>
                  <div className="ac-meta">{p.cat} · {p.supplier}</div>
                </div>
                <div className="ac-price">{formatPriceShort(p.price)}</div>
              </div>
            ))}
            {total > MAX_RESULTS && (
              <div className="ac-footer" onClick={() => goToCatalog()}>
                Ver todos os {total} resultados no Catálogo →
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
