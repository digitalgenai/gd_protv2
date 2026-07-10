import { Menu, Moon, Plus, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import GlobalSearch from '../search/GlobalSearch';
import type { Product } from '../../types';

interface HeaderProps {
  title: string;
  onOpenMobileDrawer: () => void;
  products: Product[];
}

export default function Header({ title, onOpenMobileDrawer, products }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="flex items-center gap-4 px-6 py-3.5 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
      <button
        id="btn-hamburger"
        aria-label="Abrir menu"
        style={{ display: 'none', width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0, color: 'var(--primary)' }}
        onClick={onOpenMobileDrawer}
      >
        <Menu style={{ width: 20, height: 20 }} />
      </button>
      <div id="page-title" style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>
        {title}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <GlobalSearch products={products} />
        <button id="theme-toggle" aria-label="Alternar modo claro/escuro" title="Alternar tema" onClick={toggleTheme}>
          {theme === 'dark'
            ? <Sun style={{ width: 16, height: 16, color: 'var(--gold)' }} />
            : <Moon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />}
        </button>
        <button id="btn-nova-proposta" className="btn btn-gold btn-sm" onClick={() => navigate('/propostas/nova')}>
          <Plus style={{ width: 14, height: 14 }} /> Nova Proposta
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: 'var(--avatar-bg)', fontFamily: "'Montserrat',sans-serif" }}
          aria-label="Usuário: Marcos Engel Silva"
        >
          MR
        </div>
      </div>
    </header>
  );
}
