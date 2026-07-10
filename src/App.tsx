import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ProductsProvider } from './context/ProductsContext';
import { ProposalDraftProvider } from './context/ProposalDraftContext';
import { ImageModalProvider } from './context/ImageModalContext';
import Layout from './components/layout/Layout';
import PrintProposal from './components/proposal/PrintProposal';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import CatalogQuality from './pages/CatalogQuality';
import NewProposal from './pages/NewProposal';
import ProposalDetail from './pages/ProposalDetail';
import ReviewProposals from './pages/ReviewProposals';
import History from './pages/History';
import Voice from './pages/Voice';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ProductsProvider>
          <ProposalDraftProvider>
            <ImageModalProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="catalogo" element={<Catalog />} />
                    <Route path="catalogo/qualidade" element={<CatalogQuality />} />
                    <Route path="propostas/nova" element={<NewProposal />} />
                    <Route path="propostas/revisao" element={<ReviewProposals />} />
                    <Route path="propostas/historico" element={<History />} />
                    <Route path="propostas/:codigo" element={<ProposalDetail />} />
                    <Route path="voz" element={<Voice />} />
                    <Route path="config" element={<Settings />} />
                  </Route>
                </Routes>
              </BrowserRouter>
              <PrintProposal />
            </ImageModalProvider>
          </ProposalDraftProvider>
        </ProductsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
