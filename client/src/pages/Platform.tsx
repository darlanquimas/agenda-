import { useEffect, useState } from 'react';
import { Building2, Users, Plus, Loader2, AlertCircle, Pencil } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

interface Tenant { id: number; name: string; slug: string; active: boolean; user_count: number; client_count: number }
interface PlatformUser { id: number; name: string; email: string; tenant_id: number | null; active: boolean; tenant_name: string | null }

export default function Platform() {
  const [tab, setTab] = useState<'tenants' | 'users'>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenantModal, setTenantModal] = useState<Partial<Tenant> | null>(null);
  const [userModal, setUserModal] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [t, u] = await Promise.all([api.get('/platform/tenants'), api.get('/platform/users')]);
      setTenants(t.data); setUsers(u.data);
    } catch (err: any) { setError(err.response?.data?.error || 'Erro ao carregar dados'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveTenant = async (form: any) => {
    setSaving(true);
    try {
      if (tenantModal?.id) await api.put(`/platform/tenants/${tenantModal.id}`, form);
      else await api.post('/platform/tenants', form);
      setTenantModal(null); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao salvar organização'); }
    finally { setSaving(false); }
  };

  const saveUser = async (form: any) => {
    setSaving(true);
    try {
      if (userModal?.id) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/platform/users/${userModal.id}`, payload);
      } else { await api.post('/platform/users', form); }
      setUserModal(null); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao salvar usuário'); }
    finally { setSaving(false); }
  };

  const bookingUrl = (slug: string) => `${window.location.origin}/book/${slug}`;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-100">Plataforma</h1><p className="text-sm text-gray-500 mt-1">Gerenciamento de organizações e usuários (super admin)</p></div>
      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={16} />{error}</div>}

      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button type="button" onClick={() => setTab('tenants')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${tab === 'tenants' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:bg-gray-800'}`}>
          <Building2 size={16} /> Organizações
        </button>
        <button type="button" onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${tab === 'users' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:bg-gray-800'}`}>
          <Users size={16} /> Usuários
        </button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
      : tab === 'tenants' ? (
        <>
          <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setTenantModal({ name: '', slug: '', active: true })}><Plus size={16} /> Nova organização</button></div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 text-gray-400 text-left">
                <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Usuários</th><th className="px-4 py-3">Clientes</th><th className="px-4 py-3">Agendamento</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-200">{t.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{t.slug}</td>
                    <td className="px-4 py-3 text-gray-400">{t.user_count}</td>
                    <td className="px-4 py-3 text-gray-400">{t.client_count}</td>
                    <td className="px-4 py-3"><a href={bookingUrl(t.slug)} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline text-xs">/book/{t.slug}</a></td>
                    <td className="px-4 py-3"><span className={t.active ? 'text-green-400' : 'text-red-400'}>{t.active ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="px-4 py-3"><button type="button" className="p-1.5 text-gray-400 hover:text-indigo-400" onClick={() => setTenantModal({ ...t })}><Pencil size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setUserModal({ name: '', email: '', password: '', tenant_id: '', active: 1 })}><Plus size={16} /> Novo usuário</button></div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 text-gray-400 text-left">
                <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Organização</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-200">{u.name}</td>
                    <td className="px-4 py-3 text-gray-400">{u.email}</td>
                    <td className="px-4 py-3 text-gray-400">{u.tenant_name || '—'}</td>
                    <td className="px-4 py-3"><span className={u.active ? 'text-green-400' : 'text-red-400'}>{u.active ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="px-4 py-3"><button type="button" className="p-1.5 text-gray-400 hover:text-indigo-400" onClick={() => setUserModal({ ...u, password: '' })}><Pencil size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tenantModal && <TenantFormModal initial={tenantModal} saving={saving} onClose={() => setTenantModal(null)} onSave={saveTenant} />}
      {userModal && <UserFormModal initial={userModal} tenants={tenants} saving={saving} onClose={() => setUserModal(null)} onSave={saveUser} />}
    </div>
  );
}

function TenantFormModal({ initial, saving, onClose, onSave }: { initial: Partial<Tenant>; saving: boolean; onClose: () => void; onSave: (f: any) => void }) {
  const [form, setForm] = useState({ name: initial.name ?? '', slug: initial.slug ?? '', active: initial.active ?? true });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <Modal title={initial.id ? 'Editar organização' : 'Nova organização'} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label">Nome</label><input className="input" value={form.name} onChange={set('name')} /></div>
        <div><label className="label">Slug (URL pública)</label><input className="input font-mono text-sm" value={form.slug} onChange={set('slug')} placeholder="minha-empresa" /></div>
        <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={!!form.active} onChange={set('active')} />Organização ativa</label>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => onSave(form)}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UserFormModal({ initial, tenants, saving, onClose, onSave }: { initial: any; tenants: Tenant[]; saving: boolean; onClose: () => void; onSave: (f: any) => void }) {
  const [form, setForm] = useState({ name: initial.name ?? '', email: initial.email ?? '', password: '', tenant_id: initial.tenant_id ?? '', active: initial.active ?? 1 });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: (e.target as HTMLInputElement).type === 'checkbox' ? ((e.target as HTMLInputElement).checked ? 1 : 0) : e.target.value }));
  return (
    <Modal title={initial.id ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label">Nome</label><input className="input" value={form.name} onChange={set('name')} /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
        <div><label className="label">{initial.id ? 'Nova senha (opcional)' : 'Senha'}</label><input className="input" type="password" value={form.password} onChange={set('password')} /></div>
        <div>
          <label className="label">Organização</label>
          <select className="input" value={form.tenant_id} onChange={set('tenant_id')}>
            <option value="">Selecione...</option>
            {tenants.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={!!form.active} onChange={set('active')} />Usuário ativo</label>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => onSave({ ...form, tenant_id: Number(form.tenant_id) })}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
