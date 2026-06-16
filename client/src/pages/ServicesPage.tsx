import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Clock, DollarSign, Tag } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

interface Service { id: number; name: string; description: string | null; duration_minutes: number; price: number; active: boolean; specialty_ids: number[] }
interface Specialty { id: number; name: string; description: string | null }

function ServiceForm({ initial, allSpecialties, onSave, onCancel, loading, error }: {
  initial: Partial<Service>; allSpecialties: Specialty[];
  onSave: (f: any) => void; onCancel: () => void; loading: boolean; error: string;
}) {
  const [form, setForm] = useState({ name: '', description: '', duration_minutes: 60, price: 0, specialty_ids: [] as number[], ...initial });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleSpecialty = (id: number) =>
    setForm((f) => ({ ...f, specialty_ids: f.specialty_ids.includes(id) ? f.specialty_ids.filter((x) => x !== id) : [...f.specialty_ids, id] }));
  return (
    <div className="space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={15} />{error}</div>}
      <div><label className="label">Nome *</label><input className="input" placeholder="Nome do serviço" value={form.name} onChange={set('name')} /></div>
      <div><label className="label">Descrição</label><textarea className="input resize-none" rows={2} placeholder="Breve descrição..." value={form.description ?? ''} onChange={set('description')} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Duração (minutos)</label><input className="input" type="number" min={15} step={15} value={form.duration_minutes} onChange={set('duration_minutes')} /></div>
        <div><label className="label">Preço (R$)</label><input className="input" type="number" min={0} step={0.01} value={form.price} onChange={set('price')} /></div>
      </div>
      {allSpecialties.length > 0 && (
        <div>
          <label className="label">Especialidades vinculadas</label>
          <div className="flex flex-wrap gap-2">
            {allSpecialties.map((sp) => {
              const active = form.specialty_ids.includes(sp.id);
              return (
                <button key={sp.id} type="button" onClick={() => toggleSpecialty(sp.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-purple-600/20 border-purple-500/40 text-purple-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  {sp.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex gap-3 justify-end pt-2">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)} disabled={loading || !form.name}>
          {loading && <Loader2 size={15} className="animate-spin" />}Salvar
        </button>
      </div>
    </div>
  );
}

function SpecialtyForm({ initial, onSave, onCancel, loading, error }: { initial: Partial<Specialty>; onSave: (f: any) => void; onCancel: () => void; loading: boolean; error: string }) {
  const [form, setForm] = useState({ name: '', description: '', ...initial });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={15} />{error}</div>}
      <div><label className="label">Nome *</label><input className="input" placeholder="Nome da especialidade" value={form.name} onChange={set('name')} /></div>
      <div><label className="label">Descrição</label><input className="input" placeholder="Breve descrição..." value={form.description ?? ''} onChange={set('description')} /></div>
      <div className="flex gap-3 justify-end pt-2">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)} disabled={loading || !form.name}>
          {loading && <Loader2 size={15} className="animate-spin" />}Salvar
        </button>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [tab, setTab] = useState<'services' | 'specialties'>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ type: 'service' | 'specialty'; item: Service | Specialty | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; name: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try { const [sv, sp] = await Promise.all([api.get('/services'), api.get('/specialties')]); setServices(sv.data); setSpecialties(sp.data); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleSaveService = async (form: any) => {
    setSaving(true); setFormError('');
    try {
      if (modal?.item) await api.put(`/services/${modal.item.id}`, form);
      else await api.post('/services', form);
      setModal(null); fetchAll();
    } catch (err: any) { setFormError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleSaveSpecialty = async (form: any) => {
    setSaving(true); setFormError('');
    try {
      if (modal?.item) await api.put(`/specialties/${modal.item.id}`, form);
      else await api.post('/specialties', form);
      setModal(null); fetchAll();
    } catch (err: any) { setFormError(err.response?.data?.error || 'Especialidade já existe ou erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      if (deleteTarget?.type === 'service') await api.delete(`/services/${deleteTarget.id}`);
      else await api.delete(`/specialties/${deleteTarget!.id}`);
      setDeleteTarget(null); fetchAll();
    } catch {}
  };

  const fmtDuration = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;
  const fmtPrice = (p: number) => Number(p).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        {[{ key: 'services', label: 'Serviços' }, { key: 'specialties', label: 'Especialidades' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'services' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => { setFormError(''); setModal({ type: 'service', item: null }); }}>
              <Plus size={16} /> Novo serviço
            </button>
          </div>
          {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-600" /></div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {services.length === 0 && <p className="text-gray-600 col-span-3 text-center py-12">Nenhum serviço cadastrado</p>}
              {services.map((s) => (
                <div key={s.id} className="card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-semibold text-gray-100">{s.name}</p>{s.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>}</div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setFormError(''); setModal({ type: 'service', item: s }); }} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget({ type: 'service', id: s.id, name: s.name })} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {s.specialty_ids?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.specialty_ids.map((sid) => {
                        const sp = specialties.find((x) => x.id === sid);
                        return sp ? <span key={sid} className="px-2 py-0.5 rounded text-xs bg-purple-600/10 border border-purple-500/20 text-purple-400">{sp.name}</span> : null;
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-800">
                    <span className="flex items-center gap-1.5"><Clock size={12} />{fmtDuration(s.duration_minutes)}</span>
                    <span className="flex items-center gap-1.5"><DollarSign size={12} />{fmtPrice(s.price)}</span>
                    <span className={`ml-auto ${s.active ? 'badge-finished' : 'badge-failed'}`}>{s.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'specialties' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => { setFormError(''); setModal({ type: 'specialty', item: null }); }}>
              <Plus size={16} /> Nova especialidade
            </button>
          </div>
          {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-600" /></div> : (
            <div className="card overflow-hidden">
              {specialties.length === 0 && <p className="text-center text-gray-600 py-12">Nenhuma especialidade cadastrada</p>}
              {specialties.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 ${i < specialties.length - 1 ? 'border-b border-gray-800' : ''} hover:bg-gray-800/30 transition-colors`}>
                  <div className="w-8 h-8 bg-purple-600/10 border border-purple-500/20 rounded-lg flex items-center justify-center shrink-0"><Tag size={14} className="text-purple-400" /></div>
                  <div className="flex-1 min-w-0"><p className="font-medium text-gray-200">{s.name}</p>{s.description && <p className="text-xs text-gray-500 truncate">{s.description}</p>}</div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setFormError(''); setModal({ type: 'specialty', item: s }); }} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteTarget({ type: 'specialty', id: s.id, name: s.name })} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === 'service' ? (modal.item ? 'Editar serviço' : 'Novo serviço') : (modal?.item ? 'Editar especialidade' : 'Nova especialidade')} size="md">
        {modal?.type === 'service'
          ? <ServiceForm initial={(modal.item as Service) ?? {}} allSpecialties={specialties} onSave={handleSaveService} onCancel={() => setModal(null)} loading={saving} error={formError} />
          : <SpecialtyForm initial={(modal?.item as Specialty) ?? {}} onSave={handleSaveSpecialty} onCancel={() => setModal(null)} loading={saving} error={formError} />
        }
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar exclusão" size="sm">
        <p className="text-gray-400 text-sm mb-6">Deseja excluir <strong className="text-gray-300">{deleteTarget?.name}</strong>?</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
          <button className="btn-danger" onClick={handleDelete}>Excluir</button>
        </div>
      </Modal>
    </div>
  );
}
