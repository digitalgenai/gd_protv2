import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Moon, Plus, Sun, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../utils/format';
import GlobalSearch from '../search/GlobalSearch';
import type { Product } from '../../types';

interface HeaderProps {
  title: string;
  onOpenMobileDrawer: () => void;
  products: Product[];
}

export default function Header({ title, onOpenMobileDrawer, products }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  async function handleSair() {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

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
      <div id="page-title" style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>
        {title}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <GlobalSearch products={products} />
        <button id="theme-toggle" aria-label="Alternar modo claro/escuro" title="Alternar tema" onClick={toggleTheme}>
          {theme === 'dark'
            ? <Sun style={{ width: 16, height: 16, color: 'var(--gold-text)' }} />
            : <Moon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />}
        </button>
        <button id="btn-nova-proposta" className="btn btn-gold btn-sm" onClick={() => navigate('/propostas/nova')}>
          <Plus style={{ width: 14, height: 14 }} /> Nova Proposta
        </button>
        {usuario && (
          <div className="relative" ref={menuRef}>
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
              style={{ background: 'var(--avatar-bg)', fontFamily: "'Kamerik205', 'Montserrat',sans-serif", border: 'none', cursor: 'pointer' }}
              aria-label={`Usuário: ${usuario.nome}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {usuario.fotoUrl
                ? <img src={usuario.fotoUrl} alt={usuario.nome} className="w-full h-full object-cover" />
                : initials(usuario.nome)}
            </button>
            {menuOpen && (
              <div
                className="card"
                style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 220, padding: 6, zIndex: 30 }}
              >
                <div className="flex items-center gap-2.5 px-2.5 py-2" style={{ borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 overflow-hidden"
                    style={{ background: 'var(--avatar-bg)', fontFamily: "'Kamerik205', 'Montserrat',sans-serif" }}
                  >
                    {usuario.fotoUrl
                      ? <img src={usuario.fotoUrl} alt={usuario.nome} className="w-full h-full object-cover" />
                      : initials(usuario.nome)}
                  </div>
                  <div className="overflow-hidden">
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nome}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.email}</div>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => { setMenuOpen(false); navigate('/perfil'); }}
                >
                  <UserCircle style={{ width: 14, height: 14 }} /> Meu Perfil
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--error)' }}
                  onClick={handleSair}
                >
                  <LogOut style={{ width: 14, height: 14 }} /> Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
