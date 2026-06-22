import { useEffect, useState, useCallback } from 'react';
import {
  Smartphone, Trash2, RefreshCw, Loader2, AlertCircle, CheckCircle,
  Copy, KeyRound, Wifi, WifiOff,
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

interface WhatsAppInstance {
  id: number;
  instance_name: string;
  phone_number: string | null;
  status: string;
  connected_at: string | null;
}

interface ConfigData {
  id: number;
  confirmation_message: string;
  send_confirmation: boolean;
  default_instance_id: number | null;
  evo_client_id: string | null;
  has_api_key: boolean;
  has_webhook_secret: boolean;
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; color: string; icon: any }> = {
    open: { label: 'Conectado', color: 'bg-green-500/10 text-green-400 border-green-500/30', icon: Wifi },
    disconnected: { label: 'Desconectado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30', icon: WifiOff },
  };
  const cfg = map[status] || map['disconnected'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

export default function WhatsApp() {
  const [loading, setLoading] = useState(true);
  const [savingCreds, setSavingCreds] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [config, setConfig] = useState<ConfigData | null>(null);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');

  const [credForm, setCredForm] = useState({ evo_client_id: '', evo_api_key: '', webhook_signing_secret: '' });
  const [msgForm, setMsgForm] = useState({ send_confirmation: true, default_instance_id: null as number | null, confirmation_message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/whatsapp-config');
      setConfig(r.data.config);
      setInstances(r.data.instances || []);
      setWebhookUrl(r.data.webhook_url);
      setCredForm((f) => ({ ...f, evo_client_id: r.data.config.evo_client_id || '' }));
      setMsgForm({
        send_confirmation: r.data.config.send_confirmation,
        default_instance_id: r.data.config.default_instance_id,
        confirmation_message: r.data.config.confirmation_message,
      });
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveCredentials = async () => {
    setSavingCreds(true);
    try {
      const payload: Record<string, string> = { evo_client_id: credForm.evo_client_id };
      if (credForm.evo_api_key.trim()) payload.evo_api_key = credForm.evo_api_key.trim();
      if (credForm.webhook_signing_secret.trim()) payload.webhook_signing_secret = credForm.webhook_signing_secret.trim();

      await api.put('/whatsapp-config', payload);
      setCredForm((f) => ({ ...f, evo_api_key: '', webhook_signing_secret: '' }));
      await load();
      alert('Credenciais salvas com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar credenciais');
    } finally {
      setSavingCreds(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const r = await api.post('/whatsapp-config/test-connection');
      setInstances(r.data.instances || []);
      alert(`Conexão validada! ${r.data.instances?.length || 0} instância(s) encontrada(s) no Evo Manager.`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveMessageConfig = async () => {
    setSavingMsg(true);
    try {
      await api.put('/whatsapp-config', msgForm);
      alert('Configuração salva com sucesso!');
      await load();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar configuração');
    } finally {
      setSavingMsg(false);
    }
  };

  const handleDeleteInstance = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/whatsapp/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao remover instância');
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin mx-auto text-gray-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
        <p className="text-sm text-gray-400 mt-1">
          A conexão do WhatsApp agora é feita no painel do Evo Manager — aqui você só conecta as credenciais e o webhook.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Conexão com Evo Manager</h2>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-gray-300 space-y-1">
          <p className="font-medium text-blue-400">Como conectar:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>No painel do Evo Manager, conecte seu WhatsApp (escaneie o QR Code lá) em "WhatsApp".</li>
            <li>Crie uma credencial em "API Keys" e copie o Client ID e a API Key.</li>
            <li>Cole as credenciais abaixo e clique em "Testar conexão".</li>
            <li>Em "Webhooks" no painel do Evo Manager, cadastre a URL abaixo para esta instância e copie o Signing Secret gerado.</li>
            <li>Cole o Signing Secret abaixo e salve.</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Client ID</label>
            <input
              className="input"
              placeholder="evo_..."
              value={credForm.evo_client_id}
              onChange={(e) => setCredForm({ ...credForm, evo_client_id: e.target.value })}
            />
          </div>
          <div>
            <label className="label">API Key</label>
            <input
              className="input"
              type="password"
              placeholder={config?.has_api_key ? 'sk_•••••••• (já configurada)' : 'sk_...'}
              value={credForm.evo_api_key}
              onChange={(e) => setCredForm({ ...credForm, evo_api_key: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label">URL do Webhook (cole no painel do Evo Manager)</label>
          <div className="flex gap-2">
            <input className="input flex-1" readOnly value={webhookUrl} />
            <button className="btn-secondary" onClick={handleCopyWebhookUrl} title="Copiar">
              <Copy size={15} />
            </button>
          </div>
        </div>

        <div>
          <label className="label">Webhook Signing Secret</label>
          <input
            className="input"
            type="password"
            placeholder={config?.has_webhook_secret ? 'whsec_•••••••• (já configurado)' : 'whsec_...'}
            value={credForm.webhook_signing_secret}
            onChange={(e) => setCredForm({ ...credForm, webhook_signing_secret: e.target.value })}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-gray-700">
          <button className="btn-secondary flex items-center gap-2" onClick={handleTestConnection} disabled={testing || !credForm.evo_client_id}>
            {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Testar conexão
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={handleSaveCredentials} disabled={savingCreds}>
            {savingCreds ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Salvar credenciais
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h2 className="text-lg font-semibold text-white mb-4">Instâncias conectadas</h2>
        {instances.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">Nenhuma instância encontrada ainda</p>
            <p className="text-xs text-gray-600 mt-1">Conecte o WhatsApp no painel do Evo Manager e clique em "Testar conexão"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((instance) => (
              <div key={instance.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                    <Smartphone size={20} className="text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{instance.instance_name}</h3>
                    {instance.phone_number && <p className="text-xs text-gray-500">{instance.phone_number}</p>}
                  </div>
                </div>
                {getStatusBadge(instance.status)}
                {instance.connected_at && (
                  <p className="text-xs text-gray-500">Conectado em {new Date(instance.connected_at).toLocaleString('pt-BR')}</p>
                )}
                <button
                  className="w-full px-3 py-2 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors flex items-center justify-center gap-1"
                  onClick={() => setDeleteId(instance.id)}
                >
                  <Trash2 size={14} />
                  Remover do cache local
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Mensagens de Confirmação</h2>
        <p className="text-sm text-gray-400">Configure o envio automático de mensagens de confirmação de agendamento via WhatsApp</p>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="send_confirmation"
            checked={msgForm.send_confirmation}
            onChange={(e) => setMsgForm({ ...msgForm, send_confirmation: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
          />
          <label htmlFor="send_confirmation" className="text-sm font-medium text-gray-300">
            Enviar mensagem de confirmação automaticamente
          </label>
        </div>

        <div>
          <label className="label">Instância Padrão</label>
          <select
            className="input"
            value={msgForm.default_instance_id || ''}
            onChange={(e) => setMsgForm({ ...msgForm, default_instance_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Primeira instância conectada</option>
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.instance_name} ({instance.status})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Template da Mensagem</label>
          <textarea
            className="input min-h-[200px] font-mono text-sm"
            value={msgForm.confirmation_message}
            onChange={(e) => setMsgForm({ ...msgForm, confirmation_message: e.target.value })}
          />
          <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs font-medium text-blue-400 mb-2">Variáveis disponíveis:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div><code className="text-blue-300">{'{{cliente}}'}</code> - Nome do cliente</div>
              <div><code className="text-blue-300">{'{{data}}'}</code> - Data do agendamento</div>
              <div><code className="text-blue-300">{'{{horario}}'}</code> - Horário do agendamento</div>
              <div><code className="text-blue-300">{'{{servico}}'}</code> - Nome do serviço</div>
              <div><code className="text-blue-300">{'{{profissional}}'}</code> - Nome do profissional</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-700">
          <button className="btn-primary flex items-center gap-2" onClick={handleSaveMessageConfig} disabled={savingMsg}>
            {savingMsg ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Salvar Configuração
          </button>
        </div>
      </div>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover instância do cache local" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <p className="text-gray-400 text-sm">
              Isso remove apenas o registro local. Se a instância ainda estiver conectada no Evo Manager,
              ela volta a aparecer na próxima vez que você clicar em "Testar conexão".
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
            <button className="btn-danger flex items-center gap-2" onClick={handleDeleteInstance}>
              <Trash2 size={15} />
              Remover
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
