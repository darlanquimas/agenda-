import { useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, Pencil, Link2 } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

interface User { id: number; name: string; email: string; role: string; active: boolean; professional_id: number | null }
interface Professional { id: number; name: string }
interface UserFormData { name: string; email: string; password: string; role: string; active: number | boolean; professional_id: number | '' }

function UserForm({ form: initial, professionals, saving, onSave, onClose }: {
  form: Partial<UserFormData & { id?: number }>; professionals: Professional[]; saving: boolean;
  onSave: (f: UserFormData) => void; onClose: () => void;
}) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState<UserFormData>({
    name: initial.name || '',
    email: initial.email || '',
    password: '',
    role: initial.role || 'admin',
    active: initial.active ?? 1,
    professional_id: initial.professional_id ?? '',
  });
  const set = (k: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked ? 1 : 0 : e.target.value }));

  const availableProfessionals = professionals.filter((p) => p.id === initial.professional_id || true);

  return (
    <div className="space-y-4">
      <div><label className="label">Nome</label><input className="input" value={form.name} onChange={set('name')} required /></div>
      <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} required /></div>
      <div>
        <label className="label">{isEdit ? 'Nova senha (opcional)' : 'Senha'}</label>
        <input className="input" type="password" value={form.password} onChange={set('password')} required={!isEdit} placeholder="Mín. 12 caracteres" />
      </div>
      <div>
        <label className="label">Perfil de acesso</label>
        <select className="input" value={form.role} onChange={set('role')}>
          <option value="admin">Administrador — acesso total ao tenant</option>
          <option value="professional">Profissional — apenas seus agendamentos</option>
        </select>
      </div>

      {!isEdit && availableProfessionals.length > 0 && (
        <div className="rounded-lg border border-gray-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-indigo-400" />
            <span className="text-sm font-medium text-gray-300">Vincular a profissional</span>
            <span className="text-xs text-gray-600">(opcional)</span>
          </div>
          <select className="input" value={form.professional_id} onChange={set('professional_id')}>
            <option value="">Sem vínculo — usuário admin</option>
            {availableProfessionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {form.professional_id !== '' && (
            <p className="text-xs text-gray-500">O usuário terá acesso restrito: apenas visualizará os próprios agendamentos.</p>
          )}
        </div>
      )}

      {isEdit && (
        <div className="rounded-lg border border-gray-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-indigo-400" />
            <span className="text-sm font-medium text-gray-300">Vínculo com profissional</span>
          </div>
          <select className="input" value={form.professional_id} onChange={set('professional_id')}>
            <option value="">Sem vínculo — usuário admin</option>
            {availableProfessionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

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
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<(Partial<UserFormData> & { id?: number }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [u, p] = await Promise.all([api.get('/users'), api.get('/professionals')]);
      setUsers(u.data);
      setProfessionals(p.data);
    } catch (err: any) { setError(err.response?.data?.error || 'Erro ao carregar usuários'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (form: UserFormData) => {
    setSaving(true);
    try {
      const proId = form.professional_id !== '' ? Number(form.professional_id) : null;
      if (modal?.id) {
        const payload: any = { name: form.name, email: form.email, role: form.role, active: form.active, professional_id: proId };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${modal.id}`, payload);
      } else {
        await api.post('/users', { ...form, professional_id: proId });
      }
      setModal(null); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao salvar usuário'); }
    finally { setSaving(false); }
  };

  const linkedProfessionalName = (u: User) => {
    if (!u.professional_id) return null;
    return professionals.find((p) => p.id === u.professional_id)?.name ?? null;
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
                <th className="px-4 py-3 hidden md:table-cell">Perfil</th>
                <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum usuário cadastrado</td></tr>
              ) : users.map((u) => {
                const proName = linkedProfessionalName(u);
                return (
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
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.role === 'professional'
                        ? <span className="flex items-center gap-1.5 text-xs text-purple-400"><Link2 size={11} />{proName ?? 'Profissional'}</span>
                        : <span className="text-xs text-indigo-400">Admin</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={u.active ? 'text-green-400' : 'text-red-400'}>{u.active ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    <td className="px-4 py-3 w-12">
                      <button type="button"
                        className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        onClick={() => setModal({ ...u, password: '', professional_id: u.professional_id ?? '', role: u.role })}>
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? 'Editar usuário' : 'Novo usuário'} onClose={() => setModal(null)}>
          <UserForm form={modal} professionals={professionals} saving={saving} onSave={save} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
