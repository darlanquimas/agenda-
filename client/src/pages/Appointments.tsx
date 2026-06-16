import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, AlertCircle, CalendarClock, User, Briefcase, MessageCircle } from 'lucide-react';
import { toDateTimeLocal, fmtDateTime } from '../lib/datetime';
import api from '../api/axios';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

interface Appointment {
  id: number; title: string; description: string | null; scheduled_at: string;
  status: string; executor: string | null; client_name: string; client_id: number;
  professional_id: number | null; professional_name: string | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'running', label: 'Em Execução' },
  { value: 'finished', label: 'Finalizado' },
  { value: 'failed', label: 'Falhou' },
  { value: 'cancelled', label: 'Cancelado' },
];

function AppointmentForm({ initial, onSave, onCancel, loading, error }: {
  initial: Partial<Appointment>; onSave: (f: any) => void; onCancel: () => void; loading: boolean; error: string;
}) {
  const [form, setForm] = useState({
    client_id: String(initial.client_id ?? ''),
    title: initial.title ?? '',
    description: initial.description ?? '',
    scheduled_at: toDateTimeLocal(initial.scheduled_at ?? ''),
    status: initial.status ?? 'scheduled',
    executor: initial.executor ?? '',
    result: (initial as any).result ?? '',
    professional_id: initial.professional_id ? String(initial.professional_id) : '',
  });
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [professionals, setProfessionals] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    api.get('/clients', { params: { limit: 200 } }).then((r) => setClients(r.data.data));
    api.get('/professionals').then((r) => setProfessionals(r.data));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={15} />{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Cliente *</label>
          <select className="input" value={form.client_id} onChange={set('client_id')}>
            <option value="">Selecione um cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            <option value="pending">Pendente</option>
            <option value="scheduled">Agendado</option>
            <option value="running">Em Execução</option>
            <option value="finished">Finalizado</option>
            <option value="failed">Falhou</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="label">Profissional</label>
          <select className="input" value={form.professional_id} onChange={set('professional_id')}>
            <option value="">Sem profissional</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Executor</label><input className="input" placeholder="Responsável pela execução" value={form.executor ?? ''} onChange={set('executor')} /></div>
        <div className="sm:col-span-2"><label className="label">Título *</label><input className="input" placeholder="Título do agendamento" value={form.title} onChange={set('title')} /></div>
        <div className="sm:col-span-2"><label className="label">Data e hora *</label><input className="input" type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} /></div>
        <div className="sm:col-span-2"><label className="label">Descrição</label><textarea className="input resize-none" rows={2} placeholder="Detalhes do agendamento..." value={form.description ?? ''} onChange={set('description')} /></div>
        {(form.status === 'finished' || form.status === 'failed') && (
          <div className="sm:col-span-2"><label className="label">Resultado</label><textarea className="input resize-none" rows={2} placeholder="Resultado ou observações finais..." value={(form as any).result ?? ''} onChange={set('result')} /></div>
        )}
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)} disabled={loading || !form.title || !form.client_id || !form.scheduled_at}>
          {loading && <Loader2 size={15} className="animate-spin" />}Salvar
        </button>
      </div>
    </div>
  );
}

export default function Appointments() {
  const [data, setData] = useState<{ data: Appointment[]; total: number; pages: number }>({ data: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ appointment: Appointment | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/appointments', { params: { q: search, status, page, limit: 15 } }); setData(r.data); }
    finally { setLoading(false); }
  }, [search, status, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => { setSearch(q); setPage(1); }, 400); return () => clearTimeout(t); }, [q]);

  const handleSave = async (form: any) => {
    setSaving(true); setFormError('');
    try {
      if (modal?.appointment) await api.put(`/appointments/${modal.appointment.id}`, form);
      else await api.post('/appointments', form);
      setModal(null); fetchData();
    } catch (err: any) { setFormError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/appointments/${deleteId}`); setDeleteId(null); fetchData(); } catch {}
  };

  const openEdit = (a: Appointment) => {
    setFormError('');
    setModal({ appointment: a });
  };

  const handleResendWhatsApp = async (id: number) => {
    if (!confirm('Enviar mensagem de confirmação via WhatsApp?')) return;
    
    setSendingWhatsApp(id);
    try {
      const response = await api.post(`/appointments/${id}/resend-whatsapp`);
      alert(response.data.message || 'Mensagem enviada com sucesso!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSendingWhatsApp(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Buscar por título, cliente, profissional..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-48 shrink-0" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn-primary shrink-0" onClick={() => { setFormError(''); setModal({ appointment: null }); }}>
          <Plus size={16} /> Novo agendamento
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Agendamento</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Cliente</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Profissional</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Data</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden sm:table-cell">Status</th>
              <th className="px-4 py-3 w-20" />
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-12 text-gray-600"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>}
              {!loading && data.data.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-600">Nenhum agendamento encontrado</td></tr>}
              {!loading && data.data.map((a) => (
                <tr key={a.id} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarClock size={14} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">{a.title}</p>
                        {a.description && <p className="text-xs text-gray-500 truncate max-w-xs">{a.description}</p>}
                        <div className="sm:hidden mt-1"><StatusBadge status={a.status} /></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2 text-gray-400"><User size={13} />{a.client_name}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {a.professional_name
                      ? <div className="flex items-center gap-2 text-gray-400"><Briefcase size={13} />{a.professional_name}</div>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 whitespace-nowrap">
                    {fmtDateTime(a.scheduled_at)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button 
                        onClick={() => handleResendWhatsApp(a.id)} 
                        className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                        disabled={sendingWhatsApp === a.id}
                        title="Reenviar confirmação WhatsApp"
                      >
                        {sendingWhatsApp === a.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <MessageCircle size={15} />
                        )}
                      </button>
                      <button onClick={() => openEdit(a)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteId(a.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-500">{data.total} agendamentos • página {page} de {data.pages}</p>
            <div className="flex gap-2">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage((p) => p - 1)} disabled={page === 1}><ChevronLeft size={14} /></button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage((p) => p + 1)} disabled={page === data.pages}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.appointment ? 'Editar agendamento' : 'Novo agendamento'} size="lg">
        <AppointmentForm initial={modal?.appointment ?? {}} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar exclusão" size="sm">
        <p className="text-gray-400 text-sm mb-6">Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
          <button className="btn-danger" onClick={handleDelete}>Excluir</button>
        </div>
      </Modal>
    </div>
  );
}
