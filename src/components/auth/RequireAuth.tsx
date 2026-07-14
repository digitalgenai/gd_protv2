import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RequireAuth() {
  const { usuario, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="spin" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
