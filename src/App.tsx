import { createBrowserRouter, RouterProvider } from 'react-router-dom';
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

// createBrowserRouter (em vez do <BrowserRouter><Routes>... declarativo) é o que habilita
// useBlocker — usado em NewProposal.tsx pra avisar antes de sair da página com a proposta
// não salva. Estrutura de rotas idêntica à anterior, só a forma de declarar que muda.
const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'catalogo', element: <Catalog /> },
          { path: 'catalogo/qualidade', element: <CatalogQuality /> },
          { path: 'propostas/nova', element: <NewProposal /> },
          { path: 'propostas/revisao', element: <ReviewProposals /> },
          { path: 'propostas/historico', element: <History /> },
          { path: 'propostas/:codigo', element: <ProposalDetail /> },
          // { path: 'voz', element: <Voice /> }, — v2
          { path: 'gestao/clientes', element: <Clientes /> },
          { path: 'gestao/arquitetos', element: <Arquitetos /> },
          { path: 'gestao/fornecedores', element: <Fornecedores /> },
          { path: 'gestao/usuarios', element: <Usuarios /> },
          { path: 'perfil', element: <Perfil /> },
          { path: 'config', element: <Settings /> },
        ],
      },
    ],
  },
]);

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
                <RouterProvider router={router} />
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
