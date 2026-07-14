import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut, Save, ShieldCheck, Upload, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../utils/format';

export default function Perfil() {
  const { usuario, updatePerfil, changePassword, updateFotoUrl, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [setor, setSetor] = useState(usuario?.setor ?? '');
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [fotoModalOpen, setFotoModalOpen] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  if (!usuario) return null;

  function openFotoModal() {
    setFotoPreview(usuario?.fotoUrl ?? null);
    setFotoModalOpen(true);
  }

  function handleFotoFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleSalvarFoto() {
    updateFotoUrl(fotoPreview ?? undefined);
    showToast('Foto de perfil atualizada.', 'success');
    setFotoModalOpen(false);
  }

  async function handleSalvarPerfil(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      showToast('Nome e e-mail são obrigatórios.', 'warning');
      return;
    }
    setSavingPerfil(true);
    const resultado = await updatePerfil({ nome: nome.trim(), email: email.trim(), setor: setor.trim() });
    setSavingPerfil(false);
    showToast(resultado.ok ? 'Perfil atualizado.' : resultado.erro, resultado.ok ? 'success' : 'error');
  }

  async function handleTrocarSenha(e: FormEvent) {
    e.preventDefault();
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      showToast('Preencha os três campos de senha.', 'warning');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      showToast('A confirmação não coincide com a nova senha.', 'error');
      return;
    }
    setTrocandoSenha(true);
    const resultado = await changePassword(senhaAtual, novaSenha);
    setTrocandoSenha(false);
    showToast(resultado.ok ? 'Senha atualizada com sucesso.' : resultado.erro, resultado.ok ? 'success' : 'error');
    if (resultado.ok) {
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    }
  }

  async function handleSair() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div id="view-perfil" className="view active fade-in p-6" style={{ maxWidth: 640 }}>
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-4 mb-1">
          <div className="relative flex-shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden"
              style={{ background: 'var(--avatar-bg)', fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontSize: 18 }}
            >
              {usuario.fotoUrl
                ? <img src={usuario.fotoUrl} alt={usuario.nome} className="w-full h-full object-cover" />
                : initials(usuario.nome)}
            </div>
            <button
              type="button"
              aria-label="Alterar foto de perfil"
              title="Alterar foto de perfil"
              onClick={openFotoModal}
              style={{
                position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%',
                background: 'var(--gold)', color: '#fefefe', border: '2px solid #fefefe', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Camera style={{ width: 11, height: 11 }} />
            </button>
          </div>
          <div>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 18 }}>{usuario.nome}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="mono badge badge-gold">{usuario.codigoVendedor ?? '—'}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{usuario.perfil} · {usuario.setor}</span>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={handleSair}>
            <LogOut style={{ width: 13, height: 13 }} /> Sair
          </button>
        </div>
      </div>

      <div className="card p-6 mb-5">
        <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          Meus Dados
        </div>
        <form onSubmit={handleSalvarPerfil}>
          <div className="mb-4">
            <label className="form-label" htmlFor="perfil-nome">Nome</label>
            <input id="perfil-nome" className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="perfil-email">E-mail</label>
            <input id="perfil-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="perfil-setor">Setor</label>
            <input id="perfil-setor" className="form-input" value={setor} onChange={(e) => setSetor(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-gold" disabled={savingPerfil}>
            <Save style={{ width: 13, height: 13 }} /> {savingPerfil ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck style={{ width: 16, height: 16, color: 'var(--gold-text)' }} />
          <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15 }}>Trocar Senha</div>
        </div>
        <form onSubmit={handleTrocarSenha}>
          <div className="mb-4">
            <label className="form-label" htmlFor="senha-atual">Senha atual</label>
            <input id="senha-atual" type="password" className="form-input" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="nova-senha">Nova senha</label>
            <input id="nova-senha" type="password" className="form-input" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="confirmar-senha">Confirmar nova senha</label>
            <input id="confirmar-senha" type="password" className="form-input" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-outline" disabled={trocandoSenha}>{trocandoSenha ? 'Atualizando...' : 'Atualizar Senha'}</button>
        </form>
      </div>

      <div className={`modal-overlay${fotoModalOpen ? ' open' : ''}`} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setFotoModalOpen(false); }}>
        <div className="modal-box" style={{ width: 380 }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 16 }}>
              Foto de Perfil
            </div>
            <button className="btn btn-ghost btn-sm" aria-label="Fechar" onClick={() => setFotoModalOpen(false)}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div className="p-6 flex flex-col items-center">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-white font-bold overflow-hidden mb-5"
              style={{ background: 'var(--avatar-bg)', fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontSize: 32 }}
            >
              {fotoPreview
                ? <img src={fotoPreview} alt="Pré-visualização" className="w-full h-full object-cover" />
                : <User style={{ width: 40, height: 40 }} />}
            </div>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <Upload style={{ width: 13, height: 13 }} /> {fotoPreview ? 'Trocar imagem' : 'Escolher imagem'}
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFotoFile(file); e.target.value = ''; }}
              />
            </label>
            {fotoPreview && (
              <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setFotoPreview(null)}>
                Remover foto
              </button>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 12 }}>
              Fica salva só neste navegador — ainda não é gravada no banco. Você pode voltar aqui e trocar a qualquer momento.
            </div>
            <div className="flex justify-end gap-2 mt-5" style={{ width: '100%' }}>
              <button type="button" className="btn btn-outline" onClick={() => setFotoModalOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-gold" onClick={handleSalvarFoto}>Salvar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
