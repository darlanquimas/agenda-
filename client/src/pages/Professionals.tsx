import { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Search, Pencil, Trash2, Loader2, AlertCircle, UserCheck, Clock } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatPhone } from '../lib/phone';

interface AvailSlot { weekday: number; start_time: string; end_time: string }
interface Specialty { id: number; name: string; service_ids: number[] }
interface Service { id: number; name: string }
interface Professional { id: number; name: string; email: string | null; phone: string | null; bio: string | null; active: boolean; specialties: Specialty[]; services: Service[]; availability: AvailSlot[] }

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function AvailabilityEditor({ value, onChange }: { value: AvailSlot[]; onChange: (v: AvailSlot[]) => void }) {
  const activeWds = [...new Set(value.map((a) => a.weekday))].sort((a, b) => a - b);
  const sorted = (arr: AvailSlot[]) => [...arr].sort((a, b) => a.weekday !== b.weekday ? a.weekday - b.weekday : a.start_time.localeCompare(b.start_time));
  
  const toggleDay = (e: React.MouseEvent, wd: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeWds.includes(wd)) onChange(value.filter((a) => a.weekday !== wd));
    else onChange(sorted([...value, { weekday: wd, start_time: '08:00', end_time: '18:00' }]));
  };
  
  const addPeriod = (e: React.MouseEvent, wd: number) => {
    e.preventDefault();
    e.stopPropagation();
    const last = value.filter((a) => a.weekday === wd).at(-1);
    onChange(sorted([...value, { weekday: wd, start_time: last?.end_time ?? '13:00', end_time: '18:00' }]));
  };
  
  const removePeriod = (e: React.MouseEvent, wd: number, pIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    let count = -1;
    onChange(value.filter((a) => { if (a.weekday !== wd) return true; count++; return count !== pIdx; }));
  };
  
  const updatePeriod = (wd: number, pIdx: number, key: keyof AvailSlot, val: string | number) => {
    let count = -1;
    onChange(value.map((a) => { if (a.weekday !== wd) return a; count++; return count === pIdx ? { ...a, [key]: val } : a; }));
  };
  
  const grouped = activeWds.map((wd) => ({ wd, periods: value.filter((a) => a.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time)) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
          const active = activeWds.includes(wd);
          return (
            <button 
              key={wd} 
              type="button" 
              onClick={(e) => toggleDay(e, wd)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}>
              {DAYS[wd]}
            </button>
          );
        })}
      </div>
      {grouped.length === 0 && <p className="text-xs text-gray-600 pl-1">Nenhum dia selecionado</p>}
      {grouped.map(({ wd, periods }) => (
        <div key={wd} className="rounded-lg border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-800/60">
            <span className="text-xs font-semibold text-gray-300">{DAYS[wd]}</span>
            <button 
              type="button" 
              onClick={(e) => addPeriod(e, wd)} 
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <Plus size={12} /> Faixa
            </button>
          </div>
          <div className="divide-y divide-gray-800/60">
            {periods.map((period, pIdx) => (
              <div key={`${wd}-${pIdx}-${period.start_time}`} className="flex items-center gap-2 px-3 py-2.5">
                <Clock size={13} className="text-gray-600 shrink-0" />
                <input 
                  type="time" 
                  className="input py-1.5 text-xs w-28" 
                  value={period.start_time} 
                  onChange={(e) => updatePeriod(wd, pIdx, 'start_time', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-gray-600 text-xs shrink-0">às</span>
                <input 
                  type="time" 
                  className="input py-1.5 text-xs w-28" 
                  value={period.end_time} 
                  onChange={(e) => updatePeriod(wd, pIdx, 'end_time', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                {periods.length > 1 && (
                  <button 
                    type="button" 
                    onClick={(e) => removePeriod(e, wd, pIdx)} 
                    className="ml-auto p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                    <Minus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfessionalForm({ initial, allSpecialties, allServices, onSave, onCancel, loading, error }: {
  initial: Partial<Professional>; allSpecialties: Specialty[]; allServices: Service[];
  onSave: (f: any) => void; onCancel: () => void; loading: boolean; error: string;
}) {
  const defaultAvailability = [1, 2, 3, 4, 5].map((wd) => ({ weekday: wd, start_time: '08:00', end_time: '18:00' }));
  const [form, setForm] = useState({
    name: initial?.name ?? '', email: initial?.email ?? '', phone: formatPhone(initial?.phone ?? ''), bio: initial?.bio ?? '',
    specialty_ids: initial?.specialties?.map((s) => s.id) ?? [],
    service_ids: initial?.services?.map((s) => s.id) ?? [],
    availability: initial?.availability?.length ? initial.availability : defaultAvailability,
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'phone' ? formatPhone(e.target.value) : e.target.value }));
  const toggleService = (id: number) =>
    setForm((f) => ({ ...f, service_ids: f.service_ids.includes(id) ? f.service_ids.filter((x) => x !== id) : [...f.service_ids, id] }));
  const toggleSpecialty = (specialty: Specialty) =>
    setForm((f) => {
      const adding = !f.specialty_ids.includes(specialty.id);
      const specialty_ids = adding ? [...f.specialty_ids, specialty.id] : f.specialty_ids.filter((x) => x !== specialty.id);
      const service_ids = adding
        ? [...new Set([...f.service_ids, ...specialty.service_ids])]
        : f.service_ids;
      return { ...f, specialty_ids, service_ids };
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading && form.name) {
      onSave(form);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={15} />{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Nome *</label><input className="input" placeholder="Nome completo" value={form.name} onChange={set('name')} /></div>
        <div><label className="label">Email</label><input className="input" type="email" placeholder="email@exemplo.com" value={form.email || ''} onChange={set('email')} /></div>
        <div><label className="label">Telefone</label><input className="input" placeholder="(00) 00000-0000" value={form.phone || ''} onChange={set('phone')} /></div>
        <div className="sm:col-span-2"><label className="label">Bio</label><textarea className="input resize-none" rows={2} placeholder="Breve descrição do profissional..." value={form.bio || ''} onChange={set('bio')} /></div>
      </div>
      <div>
        <label className="label">Especialidades</label>
        <div className="flex flex-wrap gap-2">
          {allSpecialties.map((s) => { const active = form.specialty_ids.includes(s.id); return (
            <button key={s.id} type="button" onClick={(e) => { e.preventDefault(); toggleSpecialty(s); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              {s.name}
            </button>
          ); })}
        </div>
      </div>
      <div>
        <label className="label">Serviços oferecidos</label>
        <div className="flex flex-wrap gap-2">
          {allServices.map((s) => { const active = form.service_ids.includes(s.id); return (
            <button key={s.id} type="button" onClick={(e) => { e.preventDefault(); toggleService(s.id); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-purple-600/20 border-purple-500/40 text-purple-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              {s.name}
            </button>
          ); })}
        </div>
      </div>
      <div><label className="label">Disponibilidade</label><AvailabilityEditor value={form.availability} onChange={(av) => setForm((f) => ({ ...f, availability: av }))} /></div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-800">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading || !form.name}>
          {loading && <Loader2 size={15} className="animate-spin" />}Salvar
        </button>
      </div>
    </form>
  );
}

export default function Professionals() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<Specialty[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ professional: Professional | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pros, specs, svcs] = await Promise.all([api.get('/professionals', { params: { q: search } }), api.get('/specialties'), api.get('/services')]);
      setProfessionals(pros.data); setAllSpecialties(specs.data); setAllServices(svcs.data);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => setSearch(q), 400); return () => clearTimeout(t); }, [q]);

  const handleSave = async (form: any) => {
    setSaving(true); setFormError('');
    try {
      if (modal?.professional) await api.put(`/professionals/${modal.professional.id}`, form);
      else await api.post('/professionals', form);
      setModal(null); fetchData();
    } catch (err: any) { setFormError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/professionals/${deleteId}`); setDeleteId(null); fetchData(); } catch {}
  };

  const filtered = professionals.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Buscar profissional..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary shrink-0" onClick={() => { setFormError(''); setModal({ professional: null }); }}><Plus size={16} /> Novo profissional</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-600" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 && <p className="text-gray-600 col-span-3 text-center py-12">Nenhum profissional cadastrado</p>}
          {filtered.map((p) => (
            <div key={p.id} className="card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-lg shrink-0">
                    {p.name[0].toUpperCase()}
                  </div>
                  <div><p className="font-semibold text-gray-100">{p.name}</p><p className="text-xs text-gray-500">{p.email || (p.phone ? formatPhone(p.phone) : '—')}</p></div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setFormError(''); setModal({ professional: p }); }} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Pencil size={15} /></button>
                  <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={15} /></button>
                </div>
              </div>
              {p.bio && <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{p.bio}</p>}
              {p.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.specialties.map((s) => <span key={s.id} className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-xs rounded-full">{s.name}</span>)}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
                <span className="flex items-center gap-1.5"><UserCheck size={12} />{p.services?.length || 0} serviços</span>
                <span className="flex items-center gap-1.5"><Clock size={12} />{p.availability?.length ? `${p.availability.length}d/sem` : 'Sem horário'}</span>
                <span className={p.active ? 'badge-finished' : 'badge-failed'}>{p.active ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.professional ? 'Editar profissional' : 'Novo profissional'} size="xl">
        <ProfessionalForm initial={modal?.professional ?? {}} allSpecialties={allSpecialties} allServices={allServices} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar desativação" size="sm">
        <p className="text-gray-400 text-sm mb-6">Deseja desativar este profissional? Ele não aparecerá mais no link de agendamento.</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
          <button className="btn-danger" onClick={handleDelete}>Desativar</button>
        </div>
      </Modal>
    </div>
  );
}
