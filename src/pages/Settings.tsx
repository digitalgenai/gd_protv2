import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, Cloud, CloudUpload, Database, Loader2, Mic, Power, RefreshCw, Users, UserPlus, X,
} from 'lucide-react';
import { checkBackendHealth } from '../api/health';
import { createUsuario, fetchUsuarios, setUsuarioAtivo, type PerfilUsuario, type Usuario } from '../api/usuarios';
import ErrorState from '../components/ui/ErrorState';
import { useToast } from '../context/ToastContext';

type Tab = 'usuarios' | 'integracoes';

const PERFIS: PerfilUsuario[] = ['Administrador', 'Supervisor', 'Vendedor'];

const EMPTY_FORM = { nome: '', email: '', senha: '', perfil: 'Vendedor' as PerfilUsuario, setor: 'Vendas' };

const IMPORT_LOGS = [
  { titulo: 'Import automático — Hoje 09:14', detalhe: '18 imagens importadas · 0 erros · Pasta: /catalogo-maio-2026', status: 'Sucesso' as const },
  { titulo: 'Import automático — Ontem 09:00', detalhe: '42 imagens · 3 rejeitadas (abaixo de 600×600px)', status: 'Aviso' as const },
  { titulo: 'Import manual — 07/05/2026', detalhe: '8 imagens importadas · 0 erros', status: 'Sucesso' as const },
];

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'integracoes', label: 'Integrações', icon: Database },
];

export default function Settings() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'integracoes' ? 'integracoes' : 'usuarios');
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [errorUsuarios, setErrorUsuarios] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadUsuarios = useCallback(() => {
    setLoadingUsuarios(true);
    setErrorUsuarios(false);
    fetchUsuarios()
      .then(setUsuarios)
      .catch(() => setErrorUsuarios(true))
      .finally(() => setLoadingUsuarios(false));
  }, []);

  useEffect(() => {
    checkBackendHealth().then(setDbOnline);
  }, []);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'usuarios' || t === 'integracoes') setTab(t);
  }, [searchParams]);

  function selectTab(next: Tab) {
    setTab(next);
    setSearchParams({ tab: next });
  }

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

  return (
    <div id="view-settings" className="view active fade-in p-6" style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="btn btn-ghost btn-sm"
            style={{
              borderRadius: 0,
              borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent',
              color: tab === id ? 'var(--gold-text)' : 'var(--text-secondary)',
              fontWeight: 700,
            }}
            onClick={() => selectTab(id)}
          >
            <Icon style={{ width: 13, height: 13 }} /> {label}
          </button>
        ))}
      </div>

      {tab === 'usuarios' && (
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
                        <button
                          className="btn btn-ghost btn-sm"
                          aria-label={`${u.isActive ? 'Desativar' : 'Ativar'} ${u.nome}`}
                          title={`${u.isActive ? 'Desativar' : 'Ativar'} ${u.nome}`}
                          onClick={() => handleToggleAtivo(u)}
                        >
                          <Power style={{ width: 13, height: 13, color: u.isActive ? 'var(--success)' : 'var(--text-secondary)' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

      {tab === 'integracoes' && (
        <div className="grid gap-5">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(56,161,105,.1)' }}>
                  <Database style={{ width: 18, height: 18, color: 'var(--success)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>PostgreSQL</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Catálogo, propostas e usuários — banco de dados principal do sistema.
                  </div>
                </div>
              </div>
              {dbOnline === null ? (
                <span className="badge badge-draft">Verificando…</span>
              ) : (
                <span className={`badge ${dbOnline ? 'badge-success' : 'badge-error'}`}>{dbOnline ? 'Conectado' : 'Indisponível'}</span>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(133,34,40,.12)' }}>
                  <Cloud style={{ width: 18, height: 18, color: 'var(--gold-text)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Amazon S3</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Armazenamento das imagens de produtos.
                  </div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Bucket: galpao-design-imagens · us-east-1
                  </div>
                </div>
              </div>
              <span className="badge badge-info">Configurado</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg)' }}>
                  <CloudUpload style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Google Drive</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Importação automática de catálogos e imagens de fornecedores (RF-001 a RF-011) — ainda não implementada.
                  </div>
                </div>
              </div>
              <span className="badge badge-draft">Não configurado</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg)' }}>
                  <Mic style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>OpenAI / Whisper</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Transcrição de propostas por voz — hoje usamos o reconhecimento de fala do
                    próprio navegador (sem custo de API); Whisper ainda não está configurado.
                  </div>
                </div>
              </div>
              <span className="badge badge-draft">Não configurado</span>
            </div>
          </div>

          <div className="card p-5">
            <div style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Logs de Importação (Google Drive → S3)</div>
            <div className="space-y-3">
              {IMPORT_LOGS.map((log) => (
                <div key={log.titulo} className="flex items-center gap-4 p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                  {log.status === 'Sucesso'
                    ? <CheckCircle style={{ width: 18, height: 18, color: 'var(--success)', flexShrink: 0 }} />
                    : <AlertTriangle style={{ width: 18, height: 18, color: 'var(--warning)', flexShrink: 0 }} />}
                  <div className="flex-1">
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{log.titulo}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{log.detalhe}</div>
                  </div>
                  <span className={`badge ${log.status === 'Sucesso' ? 'badge-success' : 'badge-warning'}`}>{log.status}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-outline btn-sm mt-4" onClick={() => showToast('Import iniciado — aguarde...', 'info')}>
              <RefreshCw style={{ width: 13, height: 13 }} /> Forçar Import Agora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
