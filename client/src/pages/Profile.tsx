import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, User, Lock } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSaveName = async () => {
    setNameMsg(null);
    setNameLoading(true);
    try {
      const { data } = await api.put('/auth/me', { name });
      updateUser({ name: data.name });
      setNameMsg({ ok: true, text: 'Nome atualizado com sucesso' });
    } catch (err: any) {
      setNameMsg({ ok: false, text: err.response?.data?.error || 'Erro ao salvar' });
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ ok: false, text: 'As senhas não coincidem' });
      return;
    }
    setPwLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwMsg({ ok: true, text: data.message || 'Senha alterada. Faça login novamente.' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.response?.data?.error || 'Erro ao alterar senha' });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Dados pessoais</h2>
        </div>

        <div>
          <label className="label">Nome</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label className="label">E-mail</label>
          <input className="input opacity-60 cursor-not-allowed" value={user?.email ?? ''} disabled />
          <p className="text-xs text-gray-600 mt-1">O e-mail não pode ser alterado por aqui</p>
        </div>

        {nameMsg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${nameMsg.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {nameMsg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {nameMsg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={handleSaveName}
            disabled={nameLoading || !name.trim()}
          >
            {nameLoading && <Loader2 size={15} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Alterar senha</h2>
        </div>

        <div>
          <label className="label">Senha atual</label>
          <input
            className="input"
            type="password"
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="label">Nova senha</label>
          <input
            className="input"
            type="password"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="label">Confirmar nova senha</label>
          <input
            className="input"
            type="password"
            value={pwForm.confirmPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            placeholder="••••••••"
          />
        </div>

        {pwMsg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${pwMsg.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {pwMsg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {pwMsg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={handleChangePassword}
            disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword}
          >
            {pwLoading && <Loader2 size={15} className="animate-spin" />}
            Alterar senha
          </button>
        </div>
      </div>
    </div>
  );
}
