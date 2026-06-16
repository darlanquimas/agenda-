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
        confirmPassword: pwForm.confirmPassword,
      });
      setPwMsg({ ok: true, text: data.message || 'Senha alterada. Redirecionando para login…' });
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
      {/* Dados pessoais */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSaveName(); }}
        autoComplete="on"
        className="card p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Dados pessoais</h2>
        </div>

        <div>
          <label htmlFor="profile-name" className="label">Nome</label>
          <input
            id="profile-name"
            name="name"
            className="input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="label">E-mail</label>
          <input
            id="profile-email"
            name="email"
            className="input opacity-60 cursor-not-allowed"
            autoComplete="email"
            value={user?.email ?? ''}
            disabled
          />
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
            type="submit"
            className="btn-primary"
            disabled={nameLoading || !name.trim()}
          >
            {nameLoading && <Loader2 size={15} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </form>

      {/* Alterar senha */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}
        autoComplete="on"
        className="card p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Alterar senha</h2>
        </div>

        {/* Hidden username field helps password managers associate credentials */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={user?.email ?? ''}
          readOnly
          className="hidden"
          aria-hidden="true"
        />

        <div>
          <label htmlFor="current-password" className="label">Senha atual</label>
          <input
            id="current-password"
            name="current-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="new-password" className="label">Nova senha</label>
          <input
            id="new-password"
            name="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="label">Confirmar nova senha</label>
          <input
            id="confirm-password"
            name="confirm-password"
            className="input"
            type="password"
            autoComplete="new-password"
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
            type="submit"
            className="btn-primary"
            disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword}
          >
            {pwLoading && <Loader2 size={15} className="animate-spin" />}
            Alterar senha
          </button>
        </div>
      </form>
    </div>
  );
}
