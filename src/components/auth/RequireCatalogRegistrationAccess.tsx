import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSystemSettings } from '../../context/SystemSettingsContext';

export default function RequireCatalogRegistrationAccess({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const { sellersCanManageCatalog, loading } = useSystemSettings();

  if (loading) return null;
  const alwaysAllowed = usuario?.perfil === 'Administrador' || usuario?.perfil === 'Supervisor';
  if (!alwaysAllowed && !sellersCanManageCatalog) return <Navigate to="/catalogo" replace />;
  return children;
}
