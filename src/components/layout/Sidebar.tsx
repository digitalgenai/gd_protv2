import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
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
  icon: Icon, label, open, onToggle,
}: { icon: typeof FileText; label: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      className="nav-item tooltip"
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

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onNavigate, isAdmin }: SidebarProps) {
  const { resetDraft } = useProposalDraft();
  const [comercialOpen, setComercialOpen] = useState(true);
  const [catalogoOpen, setCatalogoOpen] = useState(true);
  const [gestaoOpen, setGestaoOpen] = useState(false);
  const [sistemaOpen, setSistemaOpen] = useState(false);

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

  function groupEnter(key: string) {
    return (e: { currentTarget: HTMLElement }) => {
      if (!iconOnly) return;
      setFlyout({ key, top: e.currentTarget.getBoundingClientRect().top });
    };
  }
  function groupLeave(key: string) {
    return () => setFlyout((f) => (f?.key === key ? null : f));
  }
  function submenuStyle(key: string, open: boolean): CSSProperties {
    if (iconOnly) {
      return flyout?.key === key
        ? { display: 'block', position: 'fixed', top: flyout.top, left: 76 }
        : { display: 'none' };
    }
    return { display: open ? 'block' : 'none' };
  }
  const submenuClass = iconOnly ? 'submenu submenu-flyout' : 'submenu';

  function NavGroup({ groupKey, children }: { groupKey: string; children: ReactNode }) {
    return (
      <div
        className="nav-group"
        onMouseEnter={groupEnter(groupKey)}
        onMouseLeave={groupLeave(groupKey)}
        onFocus={groupEnter(groupKey)}
        onBlur={groupLeave(groupKey)}
      >
        {children}
      </div>
    );
  }

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

        <NavGroup groupKey="comercial">
          <GroupHeader icon={FileText} label="Comercial" open={comercialOpen} onToggle={() => setComercialOpen((o) => !o)} />
          <div className={submenuClass} style={submenuStyle('comercial', comercialOpen)}>
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

        <NavGroup groupKey="catalogo">
          <GroupHeader icon={Package} label="Catálogo" open={catalogoOpen} onToggle={() => setCatalogoOpen((o) => !o)} />
          <div className={submenuClass} style={submenuStyle('catalogo', catalogoOpen)}>
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
            <NavGroup groupKey="gestao">
              <GroupHeader icon={Users} label="Gestão" open={gestaoOpen} onToggle={() => setGestaoOpen((o) => !o)} />
              <div className={submenuClass} style={submenuStyle('gestao', gestaoOpen)}>
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

            <NavGroup groupKey="sistema">
              <GroupHeader icon={Settings} label="Sistema" open={sistemaOpen} onToggle={() => setSistemaOpen((o) => !o)} />
              <div className={submenuClass} style={submenuStyle('sistema', sistemaOpen)}>
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
