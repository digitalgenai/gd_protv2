import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronDown, Contact, FilePlus, FileText, History, LayoutDashboard,
  Package, PanelLeftClose, PanelLeftOpen, PencilRuler, Settings, ShieldCheck, Truck, Users,
} from 'lucide-react';

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
      <span className="tt">{label}</span>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onNavigate, isAdmin }: SidebarProps) {
  const [comercialOpen, setComercialOpen] = useState(true);
  const [catalogoOpen, setCatalogoOpen] = useState(true);
  const [gestaoOpen, setGestaoOpen] = useState(false);
  const [sistemaOpen, setSistemaOpen] = useState(false);

  return (
    <aside
      id="sidebar"
      className={`flex flex-col overflow-hidden z-20${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
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

        <GroupHeader icon={FileText} label="Comercial" open={comercialOpen} onToggle={() => setComercialOpen((o) => !o)} />
        <div className="submenu" style={{ display: comercialOpen ? 'block' : 'none' }}>
          <NavLink to="/propostas/nova" className={navClass} onClick={onNavigate}>
            <FilePlus className="nav-icon" style={{ width: 16, height: 16 }} />
            <span className="nav-label">Nova Proposta</span>
          </NavLink>
          <NavLink to="/propostas/historico" className={navClass} onClick={onNavigate}>
            <History className="nav-icon" style={{ width: 16, height: 16 }} />
            <span className="nav-label">Propostas</span>
          </NavLink>
          {/* Rascunhos de Voz — modo de gravação por áudio adiado para a v2 */}
        </div>

        <GroupHeader icon={Package} label="Catálogo" open={catalogoOpen} onToggle={() => setCatalogoOpen((o) => !o)} />
        <div className="submenu" style={{ display: catalogoOpen ? 'block' : 'none' }}>
          <NavLink to="/catalogo" className={navClass} onClick={onNavigate}>
            <Package className="nav-icon" style={{ width: 16, height: 16 }} />
            <span className="nav-label">Produtos</span>
          </NavLink>
          <NavLink to="/catalogo/qualidade" className={navClass} onClick={onNavigate}>
            <ShieldCheck className="nav-icon" style={{ width: 16, height: 16 }} />
            <span className="nav-label">Qualidade do Catálogo</span>
          </NavLink>
        </div>

        {isAdmin && (
          <>
            <GroupHeader icon={Users} label="Gestão" open={gestaoOpen} onToggle={() => setGestaoOpen((o) => !o)} />
            <div className="submenu" style={{ display: gestaoOpen ? 'block' : 'none' }}>
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

            <GroupHeader icon={Settings} label="Sistema" open={sistemaOpen} onToggle={() => setSistemaOpen((o) => !o)} />
            <div className="submenu" style={{ display: sistemaOpen ? 'block' : 'none' }}>
              <NavLink to="/config" className={navClass} onClick={onNavigate}>
                <Settings className="nav-icon" style={{ width: 16, height: 16 }} />
                <span className="nav-label">Configurações</span>
              </NavLink>
            </div>
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
