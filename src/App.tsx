import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ProductsProvider } from './context/ProductsContext';
import { VendedoresProvider } from './context/VendedoresContext';
import { VozProvider } from './context/VozContext';
import { ProposalDraftProvider } from './context/ProposalDraftContext';
import { ImageModalProvider } from './context/ImageModalContext';
import RequireAuth from './components/auth/RequireAuth';
import Layout from './components/layout/Layout';
import PrintProposal from './components/proposal/PrintProposal';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import CatalogQuality from './pages/CatalogQuality';
import NewProposal from './pages/NewProposal';
import ProposalDetail from './pages/ProposalDetail';
import ReviewProposals from './pages/ReviewProposals';
import History from './pages/History';
// Voz: modo de gravação por áudio adiado para a v2 — ver Layout.tsx/Dashboard.tsx/Sidebar.tsx.
// import Voice from './pages/Voice';
import Settings from './pages/Settings';
import Usuarios from './pages/Usuarios';
import Clientes from './pages/Clientes';
import Arquitetos from './pages/Arquitetos';
import Fornecedores from './pages/Fornecedores';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ProductsProvider>
          <VendedoresProvider>
          <VozProvider>
            <ProposalDraftProvider>
              <ImageModalProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<RequireAuth />}>
                      <Route element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="catalogo" element={<Catalog />} />
                        <Route path="catalogo/qualidade" element={<CatalogQuality />} />
                        <Route path="propostas/nova" element={<NewProposal />} />
                        <Route path="propostas/revisao" element={<ReviewProposals />} />
                        <Route path="propostas/historico" element={<History />} />
                        <Route path="propostas/:codigo" element={<ProposalDetail />} />
                        {/* <Route path="voz" element={<Voice />} /> — v2 */}
                        <Route path="gestao/clientes" element={<Clientes />} />
                        <Route path="gestao/arquitetos" element={<Arquitetos />} />
                        <Route path="gestao/fornecedores" element={<Fornecedores />} />
                        <Route path="gestao/usuarios" element={<Usuarios />} />
                        <Route path="perfil" element={<Perfil />} />
                        <Route path="config" element={<Settings />} />
                      </Route>
                    </Route>
                  </Routes>
                </BrowserRouter>
                <PrintProposal />
              </ImageModalProvider>
            </ProposalDraftProvider>
          </VozProvider>
          </VendedoresProvider>
          </ProductsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
