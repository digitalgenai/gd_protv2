import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { PerfilUsuario } from '../../api/usuarios';
import { useAuth } from '../../context/AuthContext';

interface RequireRoleProps {
  allowed: PerfilUsuario[];
  children: ReactNode;
}

/** Protege a rota de verdade no front — esconder apenas o item do menu ainda permitiria
 * abrir a URL diretamente. O backend continua sendo a autoridade final sobre dados sensíveis. */
export default function RequireRole({ allowed, children }: RequireRoleProps) {
  const { usuario } = useAuth();

  if (!usuario || !allowed.includes(usuario.perfil as PerfilUsuario)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
