import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown, Contact, FilePlus, FileText, History, LayoutDashboard,
  Package, PanelLeftClose, PanelLeftOpen, PencilRuler, Settings, ShieldCheck, Truck, Users,
} from 'lucide-react';
import { useProposalDraft } from '../../context/ProposalDraftContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onNavigate: () => void;
  isAdmin: boolean;
}

function navClass({ isActive }: { isActive: boolean }) {
  return `nav-item tooltip${isActive ? ' active' : ''}`;
}

function GroupHeader({
  icon: Icon, label, open, onToggle, active,
}: { icon: typeof FileText; label: string; open: boolean; onToggle: () => void; active: boolean }) {
  return (
    <div
      className={`nav-item tooltip${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <Icon className="nav-icon" />
      <span className="nav-label">{label}</span>
      <ChevronDown
        style={{
          width: 16, height: 16, marginLeft: 'auto',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform .2s',
        }}
        className="nav-label"
      />
    </div>
  );
}

/** Componente estável (fora do Sidebar) de propósito: se fosse declarado dentro da função
 * Sidebar, toda vez que o hover chamasse setFlyout (causando um re-render do Sidebar) o React
 * veria uma NOVA identidade de função aqui e desmontaria/remontaria o <div> real por debaixo
 * do cursor do mouse — o que quebra silenciosamente o rastreamento de hover (o navegador não
 * gera um novo mouseenter pra um elemento recriado sob um cursor parado) e fazia o flyout
 * fechar sozinho mesmo com o mouse ainda "em cima" dele, impedindo o clique de navegar. */
function NavGroup({
  onEnter, onLeave, children,
}: { onEnter: (e: { currentTarget: HTMLElement }) => void; onLeave: () => void; children: ReactNode }) {
  return (
    <div
      className="nav-group"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={(e) => {
        // Foco só saiu de verdade se o novo elemento focado não é mais um descendente deste
        // grupo — sem essa checagem, tabular/clicar de um link do flyout pro outro (ainda
        // dentro do mesmo grupo) fecha e reabre o flyout à toa.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        onLeave();
      }}
    >
      {children}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onNavigate, isAdmin }: SidebarProps) {
  const { resetDraft } = useProposalDraft();
  const { pathname } = useLocation();
  // Accordion de verdade: só um grupo aberto por vez — abrir um fecha o que já estava aberto,
  // em vez de acumular vários abertos ao mesmo tempo (era o comportamento antigo, com 4
  // booleans independentes). Clicar no grupo já aberto fecha ele (volta a null).
  const [openGroup, setOpenGroup] = useState<string | null>('comercial');
  function toggleGroup(key: string) {
    setOpenGroup((current) => (current === key ? null : key));
  }

  function groupIsActive(prefixes: string[]) {
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }

  // Abaixo de 900px o CSS (@media) já força o visual "só ícones" independente do toggle manual
  // (ver index.css) — precisamos saber disso aqui também pra decidir quando os grupos viram flyout.
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    setIsNarrowViewport(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrowViewport(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const iconOnly = collapsed || isNarrowViewport;

  // Com o menu só-ícones, o accordion de cada grupo nunca aparece (fica escondido pelo CSS) —
  // os links viram um flyout posicionado via JS (position:fixed, escapando do overflow do
  // sidebar/nav) que some/aparece ao passar o mouse ou focar o grupo pelo teclado.
  const [flyout, setFlyout] = useState<{ key: string; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  useEffect(() => clearCloseTimer, []);

  function groupEnter(key: string) {
    return (e: { currentTarget: HTMLElement }) => {
      if (!iconOnly) return;
      clearCloseTimer();
      setFlyout({ key, top: e.currentTarget.getBoundingClientRect().top });
    };
  }
  // Espera um instante antes de fechar (cancelado se o mouse voltar a entrar) — rede de
  // segurança pra quando o mouse realmente sai pra longe de verdade.
  function groupLeave() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setFlyout(null), 350);
  }
  function submenuStyle(key: string, open: boolean): CSSProperties {
    if (iconOnly) {
      // left: 72 encosta exatamente na borda direita do menu recolhido (#sidebar.collapsed
      // tem width:72px) — sem vão entre ícone e flyout, o mouse nunca sai do .nav-group ao
      // mover na horizontal do ícone pro link.
      return flyout?.key === key
        ? { display: 'block', position: 'fixed', top: flyout.top, left: 72 }
        : { display: 'none' };
    }
    return { display: open ? 'block' : 'none' };
  }
  const submenuClass = iconOnly ? 'submenu submenu-flyout' : 'submenu';

  return (
    <aside
      id="sidebar"
      className={`flex flex-col z-20${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
      style={{ flexShrink: 0 }}
    >
      <div className="sidebar-brand-row flex items-center gap-3 px-4 py-4 border-b border-white/10" style={{ minHeight: 68 }}>
        <div className="brand-name flex items-center" style={{ overflow: 'hidden' }}>
          <img src="/logo-galpao-bege.avif" alt="Galpão Design" draggable={false} className="brand-logo-full" />
          <img src="/logo-galpao-branca.png" alt="Galpão Design" draggable={false} className="brand-logo-compact" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3" style={{ minHeight: 0 }}>
        <NavLink to="/" end className={navClass} onClick={onNavigate}>
          <LayoutDashboard className="nav-icon" />
          <span className="nav-label">Dashboard</span>
          <span className="tt">Dashboard</span>
        </NavLink>

        <NavGroup onEnter={groupEnter('comercial')} onLeave={groupLeave}>
          <GroupHeader icon={FileText} label="Comercial" open={openGroup === 'comercial'} onToggle={() => toggleGroup('comercial')} active={groupIsActive(['/propostas'])} />
          <div className={submenuClass} style={submenuStyle('comercial', openGroup === 'comercial')}>
            <NavLink to="/propostas/nova" className={navClass} onClick={() => { resetDraft(); onNavigate(); }}>
              <FilePlus className="nav-icon" style={{ width: 16, height: 16 }} />
              <span className="nav-label">Nova Proposta</span>
            </NavLink>
            <NavLink to="/propostas/historico" className={navClass} onClick={onNavigate}>
              <History className="nav-icon" style={{ width: 16, height: 16 }} />
              <span className="nav-label">Propostas</span>
            </NavLink>
            {/* Rascunhos de Voz — modo de gravação por áudio adiado para a v2 */}
          </div>
        </NavGroup>

        <NavGroup onEnter={groupEnter('catalogo')} onLeave={groupLeave}>
          <GroupHeader icon={Package} label="Catálogo" open={openGroup === 'catalogo'} onToggle={() => toggleGroup('catalogo')} active={groupIsActive(['/catalogo'])} />
          <div className={submenuClass} style={submenuStyle('catalogo', openGroup === 'catalogo')}>
            <NavLink to="/catalogo" className={navClass} onClick={onNavigate}>
              <Package className="nav-icon" style={{ width: 16, height: 16 }} />
              <span className="nav-label">Produtos</span>
            </NavLink>
            <NavLink to="/catalogo/qualidade" className={navClass} onClick={onNavigate}>
              <ShieldCheck className="nav-icon" style={{ width: 16, height: 16 }} />
              <span className="nav-label">Qualidade do Catálogo</span>
            </NavLink>
          </div>
        </NavGroup>

        {isAdmin && (
          <>
            <NavGroup onEnter={groupEnter('gestao')} onLeave={groupLeave}>
              <GroupHeader icon={Users} label="Gestão" open={openGroup === 'gestao'} onToggle={() => toggleGroup('gestao')} active={groupIsActive(['/gestao'])} />
              <div className={submenuClass} style={submenuStyle('gestao', openGroup === 'gestao')}>
                <NavLink to="/gestao/clientes" className={navClass} onClick={onNavigate}>
                  <Contact className="nav-icon" style={{ width: 16, height: 16 }} />
                  <span className="nav-label">Clientes</span>
                </NavLink>
                <NavLink to="/gestao/arquitetos" className={navClass} onClick={onNavigate}>
                  <PencilRuler className="nav-icon" style={{ width: 16, height: 16 }} />
                  <span className="nav-label">Arquitetos</span>
                </NavLink>
                <NavLink to="/gestao/fornecedores" className={navClass} onClick={onNavigate}>
                  <Truck className="nav-icon" style={{ width: 16, height: 16 }} />
                  <span className="nav-label">Fornecedores</span>
                </NavLink>
                <NavLink to="/gestao/usuarios" className={navClass} onClick={onNavigate}>
                  <Users className="nav-icon" style={{ width: 16, height: 16 }} />
                  <span className="nav-label">Usuários</span>
                </NavLink>
              </div>
            </NavGroup>

            <NavGroup onEnter={groupEnter('sistema')} onLeave={groupLeave}>
              <GroupHeader icon={Settings} label="Sistema" open={openGroup === 'sistema'} onToggle={() => toggleGroup('sistema')} active={groupIsActive(['/config'])} />
              <div className={submenuClass} style={submenuStyle('sistema', openGroup === 'sistema')}>
                <NavLink to="/config" className={navClass} onClick={onNavigate}>
                  <Settings className="nav-icon" style={{ width: 16, height: 16 }} />
                  <span className="nav-label">Configurações</span>
                </NavLink>
              </div>
            </NavGroup>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          id="collapse-btn"
          className="nav-item w-full justify-center"
          style={{ margin: 0, padding: 9 }}
          aria-label="Retrair menu"
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen className="nav-icon" /> : <PanelLeftClose className="nav-icon" />}
        </button>
      </div>
    </aside>
  );
}
