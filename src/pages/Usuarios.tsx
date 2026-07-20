import { useCallback, useEffect, useState } from 'react';
import { Key, Loader2, Power, UserPlus, X, Users } from 'lucide-react';
import { createUsuario, fetchUsuarios, resetSenhaUsuario, setUsuarioAtivo, type PerfilUsuario, type Usuario } from '../api/usuarios';
import ErrorState from '../components/ui/ErrorState';
import { useToast } from '../context/ToastContext';

const PERFIS: PerfilUsuario[] = ['Administrador', 'Supervisor', 'Vendedor'];

const EMPTY_FORM = { nome: '', email: '', senha: '', perfil: 'Vendedor' as PerfilUsuario, setor: 'Vendas' };

export default function Usuarios() {
  const { showToast } = useToast();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [errorUsuarios, setErrorUsuarios] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [senhaModalUsuario, setSenhaModalUsuario] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [resettingSenha, setResettingSenha] = useState(false);

  const loadUsuarios = useCallback(() => {
    setLoadingUsuarios(true);
    setErrorUsuarios(false);
    fetchUsuarios()
      .then(setUsuarios)
      .catch(() => setErrorUsuarios(true))
      .finally(() => setLoadingUsuarios(false));
  }, []);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  function openNewUserModal() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  async function handleSaveUsuario() {
    const nome = form.nome.trim();
    const email = form.email.trim();
    if (!nome) {
      showToast('Informe o nome do usuário.', 'warning');
      return;
    }
    if (!email) {
      showToast('Informe o e-mail do usuário.', 'warning');
      return;
    }
    if (form.senha.length < 4) {
      showToast('A senha deve ter pelo menos 4 caracteres.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await createUsuario({ nome, email, senha: form.senha, perfil: form.perfil, setor: form.setor.trim() || undefined });
      showToast('Usuário criado com sucesso!', 'success');
      setModalOpen(false);
      loadUsuarios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível criar o usuário.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAtivo(u: Usuario) {
    try {
      await setUsuarioAtivo(u.id, !u.isActive);
      showToast(`${u.nome} agora está ${u.isActive ? 'inativo' : 'ativo'}.`, 'success');
      loadUsuarios();
    } catch {
      showToast('Não foi possível atualizar o status do usuário.', 'error');
    }
  }

  function openSenhaModal(u: Usuario) {
    setNovaSenha('');
    setSenhaModalUsuario(u);
  }

  async function handleResetSenha() {
    if (!senhaModalUsuario) return;
    if (novaSenha.length < 4) {
      showToast('A nova senha deve ter pelo menos 4 caracteres.', 'warning');
      return;
    }
    setResettingSenha(true);
    try {
      await resetSenhaUsuario(senhaModalUsuario.id, novaSenha);
      showToast(`Senha de ${senhaModalUsuario.nome} atualizada.`, 'success');
      setSenhaModalUsuario(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível trocar a senha.', 'error');
    } finally {
      setResettingSenha(false);
    }
  }

  return (
    <div id="view-usuarios" className="view active fade-in p-6" style={{ maxWidth: 960 }}>
      <div className="flex items-center gap-2 mb-5">
        <Users style={{ width: 18, height: 18, color: 'var(--gold-text)' }} />
        <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 20 }}>Usuários</span>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15 }}>Gestão de Usuários</span>
          <button className="btn btn-primary btn-sm" onClick={openNewUserModal}>
            <UserPlus style={{ width: 13, height: 13 }} /> Novo Usuário
          </button>
        </div>
        {loadingUsuarios ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="spin" style={{ width: 28, height: 28 }} />
            <div style={{ fontSize: 14 }}>Carregando usuários...</div>
          </div>
        ) : errorUsuarios ? (
          <ErrorState message="Não foi possível carregar os usuários — verifique se o backend está no ar." onRetry={loadUsuarios} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Nome</th><th>Código</th><th>E-mail</th><th>Perfil</th><th>Status</th><th /></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.nome}</td>
                    <td><span className="mono badge badge-gold">{u.codigoVendedor ?? '—'}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td>{u.perfil}</td>
                    <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-draft'}`}>{u.isActive ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost btn-sm"
                          aria-label={`Trocar senha de ${u.nome}`}
                          title={`Trocar senha de ${u.nome}`}
                          onClick={() => openSenhaModal(u)}
                        >
                          <Key style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          aria-label={`${u.isActive ? 'Desativar' : 'Ativar'} ${u.nome}`}
                          title={`${u.isActive ? 'Desativar' : 'Ativar'} ${u.nome}`}
                          onClick={() => handleToggleAtivo(u)}
                        >
                          <Power style={{ width: 13, height: 13, color: u.isActive ? 'var(--success)' : 'var(--text-secondary)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <div className="modal-box" style={{ width: 460 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 16 }}>Novo Usuário</div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar" onClick={() => setModalOpen(false)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="form-label" htmlFor="user-nome">Nome *</label>
              <input id="user-nome" className="form-input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="user-email">E-mail *</label>
              <input id="user-email" type="email" className="form-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="user-senha">Senha *</label>
              <input id="user-senha" type="password" className="form-input" value={form.senha} onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="user-perfil">Perfil (nível de acesso) *</label>
              <select id="user-perfil" className="form-input" value={form.perfil} onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value as PerfilUsuario }))}>
                {PERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label" htmlFor="user-setor">Setor</label>
              <input id="user-setor" className="form-input" value={form.setor} onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSaveUsuario} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${senhaModalUsuario ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => { if (e.target === e.currentTarget) setSenhaModalUsuario(null); }}
      >
        <div className="modal-box" style={{ width: 400 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 16 }}>
              Trocar senha{senhaModalUsuario ? ` — ${senhaModalUsuario.nome}` : ''}
            </div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar" onClick={() => setSenhaModalUsuario(null)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6">
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Define uma senha nova pra esse usuário sem precisar da senha atual dele — avise a
              pessoa pelo canal de sempre depois de trocar.
            </div>
            <div className="mb-2">
              <label className="form-label" htmlFor="reset-nova-senha">Nova senha *</label>
              <input
                id="reset-nova-senha"
                type="password"
                className="form-input"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-outline" onClick={() => setSenhaModalUsuario(null)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleResetSenha} disabled={resettingSenha}>
                {resettingSenha ? 'Salvando...' : 'Trocar senha'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
