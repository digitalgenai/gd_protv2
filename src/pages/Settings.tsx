import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Cloud, CloudUpload, Database, Loader2, Mic, PackagePlus, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { checkBackendHealth } from '../api/health';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { useSystemSettings } from '../context/SystemSettingsContext';
import { useToast } from '../context/ToastContext';

const IMPORT_LOGS = [
  { titulo: 'Import automático — Hoje 09:14', detalhe: '18 imagens importadas · 0 erros · Pasta: /catalogo-maio-2026', status: 'Sucesso' as const },
  { titulo: 'Import automático — Ontem 09:00', detalhe: '42 imagens · 3 rejeitadas (abaixo de 600×600px)', status: 'Aviso' as const },
  { titulo: 'Import manual — 07/05/2026', detalhe: '8 imagens importadas · 0 erros', status: 'Sucesso' as const },
];

export default function Settings() {
  const { showToast } = useToast();
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);
  const [savingCatalogAccess, setSavingCatalogAccess] = useState(false);
  const { sellersCanManageCatalog, saveSellersCanManageCatalog } = useSystemSettings();

  useEffect(() => {
    checkBackendHealth().then(setDbOnline);
  }, []);

  async function changeCatalogAccess(enabled: boolean) {
    setSavingCatalogAccess(true);
    try {
      await saveSellersCanManageCatalog(enabled);
      showToast(
        enabled
          ? 'Vendedores agora podem cadastrar e editar produtos.'
          : 'Cadastro de produtos desativado para vendedores.',
        'success',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível alterar essa permissão.', 'error');
    } finally {
      setSavingCatalogAccess(false);
    }
  }

  return (
    <div id="view-settings" className="view active fade-in p-6" style={{ maxWidth: 960 }}>
      <div className="flex items-center gap-2 mb-5">
        <SettingsIcon style={{ width: 18, height: 18, color: 'var(--gold-text)' }} />
        <span style={{ fontFamily: "'Kamerik205', 'Montserrat',sans-serif", fontWeight: 700, fontSize: 20 }}>Configurações</span>
      </div>

      <div className="grid gap-5">
        <div className="card p-5" style={{ borderColor: 'rgba(123,29,52,.3)' }}>
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div className="flex items-start gap-3" style={{ maxWidth: 620 }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(123,29,52,.1)' }}>
                <PackagePlus style={{ width: 18, height: 18, color: 'var(--gold-text)' }} />
              </div>
              <div>
                <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 14 }}>
                  Cadastro colaborativo do catálogo
                  {savingCatalogAccess && <Loader2 className="spin" style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                  Libera a aba “Cadastrar Produto” para vendedores durante a força-tarefa. Administradores e supervisores continuam com acesso mesmo quando esta opção estiver desligada.
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={sellersCanManageCatalog}
              onChange={changeCatalogAccess}
              onLabel="Liberado"
              offLabel="Somente gestão"
              badgeLabel={sellersCanManageCatalog ? 'Força-tarefa ativa' : undefined}
              ariaLabel="Permitir vendedores cadastrarem produtos"
              disabled={savingCatalogAccess}
            />
          </div>
        </div>

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
                  Transcrição de propostas por voz — recurso adiado para a v2 do projeto.
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
    </div>
  );
}
