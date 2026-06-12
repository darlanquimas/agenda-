import { useEffect, useState, useCallback } from 'react';
import { Plus, Smartphone, Trash2, RefreshCw, Loader2, AlertCircle, CheckCircle, QrCode, X, WifiOff, Wifi, Settings, Webhook } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

interface WhatsAppInstance {
  id: number;
  tenant_id: number;
  instance_name: string;
  instance_id: string | null;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateFormData {
  instance_name: string;
}

function CreateInstanceForm({ 
  onSave, 
  onCancel, 
  loading, 
  error 
}: {
  onSave: (f: CreateFormData) => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}) {
  const [form, setForm] = useState<CreateFormData>({ instance_name: '' });

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      <div>
        <label className="label">Nome da Instância *</label>
        <input
          className="input"
          placeholder="ex: atendimento, vendas, suporte..."
          value={form.instance_name}
          onChange={(e) => setForm({ instance_name: e.target.value })}
          autoFocus
        />
        <p className="text-xs text-gray-500 mt-1">
          Use apenas letras minúsculas, números e hífens. Sem espaços ou caracteres especiais.
        </p>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button className="btn-secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button
          className="btn-primary"
          onClick={() => onSave(form)}
          disabled={loading || !form.instance_name.trim()}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Criar Instância
        </button>
      </div>
    </div>
  );
}

function QRCodeModal({ qrCode, onClose }: { qrCode: string; onClose: () => void }) {
  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Conectar WhatsApp</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        
        {qrCode ? (
          <>
            <div className="bg-white p-4 rounded-lg flex justify-center items-center min-h-[250px]">
              {qrCode.startsWith('data:image') ? (
                <img src={qrCode} alt="QR Code" className="max-w-full h-auto" />
              ) : (
                <div className="font-mono text-xs break-all text-gray-800 p-2">{qrCode}</div>
              )}
            </div>

            <div className="space-y-2 text-sm text-gray-400">
              <p className="font-medium text-white">Como conectar:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Abra o WhatsApp no seu celular</li>
                <li>Toque em Menu (⋮) ou Configurações e selecione Aparelhos conectados</li>
                <li>Toque em Conectar um aparelho</li>
                <li>Aponte seu celular para esta tela para escanear o QR Code</li>
              </ol>
            </div>
          </>
        ) : (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle size={20} />
              <p className="text-sm">
                QR Code não disponível. Verifique os logs do servidor ou tente novamente.
              </p>
            </div>
          </div>
        )}

        <button className="btn-secondary w-full" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}

function WhatsAppConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    send_confirmation: true,
    default_instance_id: null as number | null,
    confirmation_message: '',
  });

  const loadConfig = useCallback(async () => {
    try {
      const response = await api.get('/whatsapp-config');
      setConfig(response.data.config);
      setInstances(response.data.instances || []);
      setFormData({
        send_confirmation: response.data.config.send_confirmation,
        default_instance_id: response.data.config.default_instance_id,
        confirmation_message: response.data.config.confirmation_message,
      });
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/whatsapp-config', formData);
      alert('Configuração salva com sucesso!');
      loadConfig();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const response = await api.delete('/whatsapp-config/cleanup');
      const { deletedFromApi, deletedFromDb, errors } = response.data;
      
      let message = `Limpeza concluída!\n\n`;
      message += `✅ ${deletedFromApi} instâncias removidas da Evolution API\n`;
      message += `✅ ${deletedFromDb} registros removidos do banco de dados`;
      
      if (errors && errors.length > 0) {
        message += `\n\n⚠️ Erros:\n${errors.join('\n')}`;
      }
      
      alert(message);
      setShowCleanupModal(false);
      loadConfig();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao limpar instâncias');
    } finally {
      setCleaning(false);
    }
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
    <>
      <div className="card space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Mensagens de Confirmação</h2>
            <p className="text-sm text-gray-400 mb-4">
              Configure o envio automático de mensagens de confirmação de agendamento via WhatsApp
            </p>
          </div>
          <button
            className="btn-danger flex items-center gap-2 shrink-0"
            onClick={() => setShowCleanupModal(true)}
            disabled={cleaning}
          >
            {cleaning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Limpar Evolution API
              </>
            )}
          </button>
        </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="send_confirmation"
            checked={formData.send_confirmation}
            onChange={(e) => setFormData({ ...formData, send_confirmation: e.target.checked })}
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
            value={formData.default_instance_id || ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              default_instance_id: e.target.value ? Number(e.target.value) : null 
            })}
          >
            <option value="">Primeira instância conectada</option>
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.instance_name} ({instance.status})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Selecione qual instância será usada para enviar as mensagens
          </p>
        </div>

        <div>
          <label className="label">Template da Mensagem</label>
          <textarea
            className="input min-h-[200px] font-mono text-sm"
            value={formData.confirmation_message}
            onChange={(e) => setFormData({ ...formData, confirmation_message: e.target.value })}
            placeholder="Digite o template da mensagem..."
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
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Salvar Configuração
              </>
            )}
          </button>
        </div>
      </div>
      </div>

      {/* Modal de confirmação de limpeza */}
      {showCleanupModal && (
        <Modal isOpen={true} onClose={() => setShowCleanupModal(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Limpar Evolution API</h3>
                <p className="text-gray-400 text-sm">
                  Esta ação irá <strong className="text-red-400">deletar TODAS as instâncias</strong> da Evolution API 
                  e seus registros no banco de dados.
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Isso é útil para limpar instâncias de teste, mas <strong>não pode ser desfeito</strong>.
                </p>
              </div>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-xs text-yellow-400 font-medium">
                ⚠️ Todas as conversas e configurações das instâncias serão perdidas permanentemente.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                className="btn-secondary" 
                onClick={() => setShowCleanupModal(false)}
                disabled={cleaning}
              >
                Cancelar
              </button>
              <button 
                className="btn-danger flex items-center gap-2" 
                onClick={handleCleanup}
                disabled={cleaning}
              >
                {cleaning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Sim, Limpar Tudo
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function WhatsApp() {
  const [activeTab, setActiveTab] = useState<'instances' | 'config'>('instances');
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/whatsapp');
      setInstances(r.data.data);
    } catch (err: any) {
      console.error('Erro ao carregar instâncias:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const handleCreate = async (form: CreateFormData) => {
    setSaving(true);
    setFormError('');
    try {
      const response = await api.post('/whatsapp', { instance_name: form.instance_name });
      console.log('[WhatsApp] Resposta da criação:', response.data);
      console.log('[WhatsApp] QR Code:', response.data.qr_code ? 'presente' : 'ausente');
      
      setCreateModal(false);
      
      if (response.data.qr_code) {
        setQrCodeData(response.data.qr_code);
      } else {
        alert('QR Code não retornado. Verifique os logs do servidor.');
      }
      
      fetchInstances();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao criar instância');
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    try {
      const response = await api.post(`/whatsapp/${instance.id}/reconnect`);
      console.log('[WhatsApp] Resposta da reconexão:', response.data);
      console.log('[WhatsApp] QR Code:', response.data.qr_code ? 'presente' : 'ausente');
      
      if (response.data.qr_code) {
        setQrCodeData(response.data.qr_code);
      } else {
        alert('QR Code não retornado. Verifique os logs do servidor.');
      }
      
      fetchInstances();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao reconectar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (instance: WhatsAppInstance) => {
    if (!confirm(`Desconectar a instância "${instance.instance_name}"?`)) return;
    
    setActionLoading(instance.id);
    try {
      await api.post(`/whatsapp/${instance.id}/disconnect`);
      fetchInstances();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao desconectar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await api.delete(`/whatsapp/${deleteId}`);
      setDeleteId(null);
      fetchInstances();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao deletar instância');
    }
  };

  const handleCheckStatus = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    try {
      await api.get(`/whatsapp/${instance.id}/status`);
      fetchInstances();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao consultar status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetupWebhook = async (instance: WhatsAppInstance) => {
    if (!confirm(`Configurar webhook para "${instance.instance_name}"?\n\nIsso permitirá que o sistema receba respostas de confirmação dos clientes.`)) return;
    
    setActionLoading(instance.id);
    try {
      const response = await api.post(`/whatsapp-config/webhook/setup/${instance.id}`);
      alert(`✅ Webhook configurado com sucesso!\n\nURL: ${response.data.webhookUrl}`);
      fetchInstances();
    } catch (err: any) {
      alert(`❌ Erro ao configurar webhook:\n\n${err.response?.data?.details || err.response?.data?.error || 'Erro desconhecido'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      open: { label: 'Conectado', color: 'bg-green-500/10 text-green-400 border-green-500/30', icon: Wifi },
      connecting: { label: 'Conectando', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', icon: RefreshCw },
      close: { label: 'Desconectado', color: 'bg-red-500/10 text-red-400 border-red-500/30', icon: WifiOff },
      disconnected: { label: 'Desconectado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30', icon: WifiOff },
    };

    const config = statusConfig[status] || statusConfig['disconnected'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
          <p className="text-sm text-gray-400 mt-1">Gerencie suas instâncias e configurações do WhatsApp</p>
        </div>
        {activeTab === 'instances' && (
          <button
            className="btn-primary shrink-0"
            onClick={() => {
              setFormError('');
              setCreateModal(true);
            }}
          >
            <Plus size={16} />
            Nova Instância
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-700/50">
        <button
          onClick={() => setActiveTab('instances')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'instances'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Smartphone size={16} />
            Instâncias
          </div>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'config'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings size={16} />
            Configurações
          </div>
        </button>
      </div>

      {activeTab === 'instances' && (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-600">
              <Loader2 size={24} className="animate-spin mx-auto" />
            </div>
          ) : instances.length === 0 ? (
          <div className="text-center py-12">
            <Smartphone size={48} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400">Nenhuma instância criada ainda</p>
            <p className="text-sm text-gray-600 mt-1">Crie sua primeira instância para começar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                      <Smartphone size={20} className="text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{instance.instance_name}</h3>
                      {instance.phone_number && (
                        <p className="text-xs text-gray-500">{instance.phone_number}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(instance.status)}
                </div>

                {instance.connected_at && (
                  <p className="text-xs text-gray-500">
                    Conectado em {new Date(instance.connected_at).toLocaleString('pt-BR')}
                  </p>
                )}

                <div className="space-y-2 pt-2 border-t border-gray-700">
                  <div className="flex gap-2">
                    {instance.status !== 'open' && (
                      <button
                        className="flex-1 px-3 py-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors flex items-center justify-center gap-1"
                        onClick={() => handleReconnect(instance)}
                        disabled={actionLoading === instance.id}
                      >
                        {actionLoading === instance.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <QrCode size={14} />
                        )}
                        Conectar
                      </button>
                    )}
                    
                    {instance.status === 'open' && (
                      <button
                        className="flex-1 px-3 py-2 text-xs font-medium text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg transition-colors flex items-center justify-center gap-1"
                        onClick={() => handleDisconnect(instance)}
                        disabled={actionLoading === instance.id}
                      >
                        {actionLoading === instance.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <WifiOff size={14} />
                        )}
                        Desconectar
                      </button>
                    )}

                    <button
                      className="flex-1 px-3 py-2 text-xs font-medium text-gray-400 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/30 rounded-lg transition-colors flex items-center justify-center gap-1"
                      onClick={() => handleCheckStatus(instance)}
                      disabled={actionLoading === instance.id}
                    >
                      {actionLoading === instance.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Status
                    </button>

                    <button
                      className="px-3 py-2 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
                      onClick={() => setDeleteId(instance.id)}
                      disabled={actionLoading === instance.id}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  {instance.status === 'open' && (
                    <button
                      className="w-full px-3 py-2 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors flex items-center justify-center gap-1"
                      onClick={() => handleSetupWebhook(instance)}
                      disabled={actionLoading === instance.id}
                      title="Configurar webhook para receber confirmações dos clientes"
                    >
                      {actionLoading === instance.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Webhook size={14} />
                      )}
                      Configurar Webhook
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {activeTab === 'config' && <WhatsAppConfig />}

      {createModal && (
        <Modal isOpen={true} onClose={() => setCreateModal(false)}>
          <h3 className="text-lg font-semibold mb-4 text-white">Nova Instância WhatsApp</h3>
          <CreateInstanceForm
            onSave={handleCreate}
            onCancel={() => setCreateModal(false)}
            loading={saving}
            error={formError}
          />
        </Modal>
      )}

      {qrCodeData && <QRCodeModal qrCode={qrCodeData} onClose={() => setQrCodeData(null)} />}

      {deleteId && (
        <Modal isOpen={true} onClose={() => setDeleteId(null)}>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Confirmar exclusão</h3>
            <p className="text-gray-400">
              Tem certeza que deseja excluir esta instância? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setDeleteId(null)}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                <Trash2 size={15} />
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
