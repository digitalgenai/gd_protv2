import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { usuario, loading, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;

  if (usuario) {
    const destino = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={destino} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const resultado = await login(email, senha);
    setSubmitting(false);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setErro(null);
    const destino = (location.state as { from?: string } | null)?.from ?? '/';
    navigate(destino, { replace: true });
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <img src="/logo-galpao-bege.avif" alt="Galpão Design" className="login-hero-stacked-logo" />
        <div className="login-hero-title">Catálogo &amp; Propostas Comerciais</div>
        <div className="login-hero-subtitle">
          Gerencie seu acervo, crie propostas de alto padrão e acompanhe cada negociação. Tudo em um só lugar.
        </div>
      </div>

      <div className="login-panel">
        <div className="login-form-box">
          <div className="login-eyebrow">Bem-vindo</div>
          <div className="login-title">Acesse sua conta</div>
          <div className="login-subtitle">Insira suas credenciais para continuar.</div>

          {erro && <div className="login-error">{erro}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="form-label" htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-5">
              <label className="form-label" htmlFor="login-senha">Senha</label>
              <div className="relative">
                <input
                  id="login-senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: 40 }}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setMostrarSenha((v) => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {mostrarSenha ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting}>
              <LogIn style={{ width: 14, height: 14 }} /> {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="login-hint">
            Problemas de acesso?{' '}
            <a onClick={() => showToast('Fale com o administrador do sistema para recuperar o acesso.', 'info')}>
              Contate o administrador
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
