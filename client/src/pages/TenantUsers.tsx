import { useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, Pencil } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

interface User { id: number; name: string; email: string; active: boolean }
interface UserFormData { name: string; email: string; password: string; active: number | boolean }

function UserForm({ form: initial, saving, onSave, onClose }: {
  form: Partial<UserFormData & { id?: number }>; saving: boolean;
  onSave: (f: UserFormData) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<UserFormData>({ name: initial.name || '', email: initial.email || '', password: '', active: initial.active ?? 1 });
  const set = (k: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value }));

  return (
    <div className="space-y-4">
      <div><label className="label">Nome</label><input className="input" value={form.name} onChange={set('name')} required /></div>
      <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} required /></div>
      <div><label className="label">{initial.id ? 'Nova senha (opcional)' : 'Senha'}</label><input className="input" type="password" value={form.password} onChange={set('password')} required={!initial.id} /></div>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={!!form.active} onChange={set('active')} />
        Usuário ativo
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-primary" disabled={saving} onClick={() => onSave(form)}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

export default function TenantUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<(Partial<UserFormData> & { id?: number }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get('/users'); setUsers(data); }
    catch (err: any) { setError(err.response?.data?.error || 'Erro ao carregar usuários'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (form: UserFormData) => {
    setSaving(true);
    try {
      if (modal?.id) {
        const payload: any = { name: form.name, email: form.email, active: form.active };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${modal.id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setModal(null); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao salvar usuário'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">Administradores da sua organização</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setModal({ name: '', email: '', password: '', active: 1 })}>
          <Plus size={16} /> Novo usuário
        </button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={16} />{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 text-gray-400 text-left">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhum usuário cadastrado</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="text-gray-200">{u.name}</p>
                    <div className="sm:hidden mt-0.5 space-y-0.5">
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      <span className={`text-xs font-medium ${u.active ? 'text-green-400' : 'text-red-400'}`}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={u.active ? 'text-green-400' : 'text-red-400'}>{u.active ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="px-4 py-3 w-12">
                    <button type="button" className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" onClick={() => setModal({ ...u, password: '' })}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? 'Editar usuário' : 'Novo usuário'} onClose={() => setModal(null)}>
          <UserForm form={modal} saving={saving} onSave={save} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
