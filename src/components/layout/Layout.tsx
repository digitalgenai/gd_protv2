import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useProducts } from '../../context/ProductsContext';
import VoiceRecorderFab from '../voice/VoiceRecorderFab';
import ImageModal from '../catalog/ImageModal';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/catalogo': 'Catálogo',
  '/catalogo/qualidade': 'Qualidade do Catálogo',
  '/propostas/nova': 'Nova Proposta',
  '/propostas/revisao': 'Propostas para Revisão',
  '/propostas/historico': 'Histórico de Propostas',
  '/voz': 'Rascunhos de Voz',
  '/config': 'Configurações',
};

const STATIC_PROPOSTAS_ROUTES = ['nova', 'revisao', 'historico'];

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const propostaMatch = pathname.match(/^\/propostas\/(.+)$/);
  if (propostaMatch && !STATIC_PROPOSTAS_ROUTES.includes(propostaMatch[1])) return 'Detalhe da Proposta';
  return '';
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { products } = useProducts();
  const location = useLocation();

  const title = getPageTitle(location.pathname);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div id="mobile-overlay" className={mobileOpen ? 'open' : ''} onClick={closeMobile} />

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onNavigate={closeMobile}
        voiceDraftCount={2}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} onOpenMobileDrawer={() => setMobileOpen(true)} products={products} />
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          <Outlet />
        </div>
      </main>

      <VoiceRecorderFab />
      <ImageModal />
    </div>
  );
}
