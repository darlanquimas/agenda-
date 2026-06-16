import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Phone, Mail, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatPhone } from '../lib/phone';

interface Client {
  id: number; name: string; email: string | null; phone: string | null;
  document: string | null; address: string | null; notes: string | null; active: boolean;
}
interface ClientFormData { name: string; email: string; phone: string; document: string; address: string; notes: string }

function ClientForm({ initial, onSave, onCancel, loading, error }: {
  initial: Partial<ClientFormData>; onSave: (f: ClientFormData) => void;
  onCancel: () => void; loading: boolean; error: string;
}) {
  const [form, setForm] = useState<ClientFormData>({ name: '', email: '', phone: '', document: '', address: '', notes: '', ...initial, phone: formatPhone(initial?.phone ?? '') });
  const set = (k: keyof ClientFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'phone' ? formatPhone(e.target.value) : e.target.value }));

  return (
    <div className="space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={15} />{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Nome *</label><input className="input" placeholder="Nome completo" value={form.name} onChange={set('name')} /></div>
        <div><label className="label">Email</label><input className="input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={set('email')} /></div>
        <div><label className="label">Telefone</label><input className="input" placeholder="(00) 00000-0000" value={form.phone} onChange={set('phone')} /></div>
        <div><label className="label">CPF / CNPJ</label><input className="input" placeholder="000.000.000-00" value={form.document} onChange={set('document')} /></div>
        <div><label className="label">Endereço</label><input className="input" placeholder="Rua, número, cidade" value={form.address} onChange={set('address')} /></div>
        <div className="sm:col-span-2"><label className="label">Observações</label><textarea className="input resize-none" rows={3} placeholder="Anotações sobre o cliente..." value={form.notes} onChange={set('notes')} /></div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)} disabled={loading || !form.name}>
          {loading && <Loader2 size={15} className="animate-spin" />}Salvar
        </button>
      </div>
    </div>
  );
}

export default function Clients() {
  const [data, setData] = useState<{ data: Client[]; total: number; pages: number }>({ data: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ client: Client | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/clients', { params: { q: search, page, limit: 10 } }); setData(r.data); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => { setSearch(q); setPage(1); }, 400); return () => clearTimeout(t); }, [q]);

  const handleSave = async (form: ClientFormData) => {
    setSaving(true); setFormError('');
    try {
      if (modal?.client) await api.put(`/clients/${modal.client.id}`, form);
      else await api.post('/clients', form);
      setModal(null); fetchData();
    } catch (err: any) { setFormError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/clients/${deleteId}`); setDeleteId(null); fetchData(); } catch {}
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Buscar por nome, email, telefone..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary shrink-0" onClick={() => { setFormError(''); setModal({ client: null }); }}>
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Contato</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Documento</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden xl:table-cell">Status</th>
              <th className="px-4 py-3 w-20" />
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-12 text-gray-600"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>}
              {!loading && data.data.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-600">Nenhum cliente encontrado</td></tr>}
              {!loading && data.data.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-600/20 border border-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">{c.name}</p>
                        <p className="text-xs text-gray-500 md:hidden">{c.phone ? formatPhone(c.phone) : c.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {c.email && <p className="text-gray-400 flex items-center gap-1.5"><Mail size={12} />{c.email}</p>}
                      {c.phone && <p className="text-gray-400 flex items-center gap-1.5"><Phone size={12} />{formatPhone(c.phone)}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400">{c.document || '—'}</td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className={c.active ? 'badge-finished' : 'badge-failed'}>{c.active ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setFormError(''); setModal({ client: c }); }} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-500">{data.total} clientes • página {page} de {data.pages}</p>
            <div className="flex gap-2">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage((p) => p - 1)} disabled={page === 1}><ChevronLeft size={14} /></button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage((p) => p + 1)} disabled={page === data.pages}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.client ? 'Editar cliente' : 'Novo cliente'} size="lg">
        <ClientForm initial={modal?.client ? { ...modal.client, email: modal.client.email ?? '', phone: modal.client.phone ?? '', document: modal.client.document ?? '', address: modal.client.address ?? '', notes: modal.client.notes ?? '' } : {}} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar exclusão" size="sm">
        <p className="text-gray-400 text-sm mb-6">Tem certeza que deseja desativar este cliente?</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
          <button className="btn-danger" onClick={handleDelete}>Desativar</button>
        </div>
      </Modal>
    </div>
  );
}
