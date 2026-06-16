import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatPhone } from '../lib/phone';
import { parseDateLocal } from '../lib/datetime';
import {
  ChevronLeft, ChevronRight, Clock, DollarSign, User,
  CalendarCheck, CheckCircle, Loader2, AlertCircle, Zap, Phone, Mail,
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  isPast, isToday, addMonths, subMonths, getDay, startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true 
});

const STEPS = ['Profissional', 'Serviço', 'Data & Hora', 'Seus dados', 'Confirmação'];
const fmtDuration = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;
const fmtPrice = (p: number | string) => Number(p).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto px-2">
      {STEPS.map((label, i) => {
        const num = i + 1; const done = num < step; const active = num === step;
        return (
          <div key={i} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${done ? 'text-indigo-400' : active ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300' : 'text-gray-600'}`}>
              {done ? <CheckCircle size={14} className="text-indigo-400 shrink-0" /> : <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border shrink-0 ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-600'}`}>{num}</span>}
              <span className={done ? 'hidden sm:inline' : ''}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-6 h-px mx-1 ${done ? 'bg-indigo-500/50' : 'bg-gray-800'}`} />}
          </div>
        );
      })}
    </div>
  );
}

function MiniCalendar({ availability, selectedDate, onSelect }: { availability: number[]; selectedDate: string | null; onSelect: (d: string) => void }) {
  const [month, setMonth] = useState(new Date());
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const today = startOfDay(new Date());
  const isAvailable = (day: Date) => {
    if (isPast(startOfDay(day)) && !isToday(day)) return false;
    return availability.includes(getDay(day));
  };
  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
        <span className="text-sm font-semibold text-gray-200 capitalize">{format(month, 'MMMM yyyy', { locale: ptBR })}</span>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const available = inMonth && isAvailable(day);
          const selected = selectedDate ? isSameDay(day, parseDateLocal(selectedDate)) : false;
          const todayMark = isToday(day);
          return (
            <button key={day.toISOString()} disabled={!available} onClick={() => available && onSelect(format(day, 'yyyy-MM-dd'))}
              className={`aspect-square rounded-lg text-xs font-medium transition-all ${!inMonth ? 'opacity-0 pointer-events-none' : ''} ${selected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : ''} ${!selected && available && todayMark ? 'border border-indigo-500/40 text-indigo-300' : ''} ${!selected && available && !todayMark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : ''} ${!available && inMonth ? 'text-gray-700 cursor-not-allowed' : ''}`}>
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Professional { id: number; name: string; bio: string | null; specialties: { id: number; name: string }[] }
interface Service { id: number; name: string; description: string | null; duration_minutes: number; price: number }
interface Confirmation { id: number; professional: string; service: string; scheduled_at: string; customer_name: string }

export default function Booking() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const bookingBase = `/booking/${tenantSlug}`;
  const [step, setStep] = useState(1);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [availability, setAvailability] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantSlug) return;
    setLoading(true);
    api.get(`${bookingBase}/professionals`)
      .then((r) => setProfessionals(r.data))
      .catch(() => setError('Organização não encontrada'))
      .finally(() => setLoading(false));
  }, [tenantSlug, bookingBase]);

  const selectProfessional = async (p: Professional) => {
    setSelectedPro(p);
    const [svcs, avail] = await Promise.all([
      api.get(`${bookingBase}/professionals/${p.id}/services`),
      api.get(`${bookingBase}/professionals/${p.id}/availability`),
    ]);
    setServices(svcs.data); setAvailability(avail.data);
    setSelectedService(null); setSelectedDate(null); setSelectedTime(null); setStep(2);
  };

  const selectService = (s: Service) => { setSelectedService(s); setSelectedDate(null); setSelectedTime(null); setSlots([]); setStep(3); };

  const selectDate = async (date: string) => {
    setSelectedDate(date); setSelectedTime(null); setLoadingSlots(true);
    try { const r = await api.get(`${bookingBase}/slots`, { params: { professionalId: selectedPro!.id, serviceId: selectedService!.id, date } }); setSlots(r.data); }
    catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setSubmitting(true); setError('');
    try {
      const r = await api.post(bookingBase, { professional_id: selectedPro!.id, service_id: selectedService!.id, date: selectedDate, time: selectedTime, customer_name: form.name, customer_email: form.email, customer_phone: form.phone, notes: form.notes });
      setConfirmation(r.data); setStep(5);
    } catch (err: any) { setError(err.response?.data?.error || 'Erro ao confirmar agendamento'); }
    finally { setSubmitting(false); }
  };

  const reset = () => { setStep(1); setSelectedPro(null); setSelectedService(null); setSelectedDate(null); setSelectedTime(null); setSlots([]); setForm({ name: '', email: '', phone: '', notes: '' }); setConfirmation(null); setError(''); };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-600/8 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-2xl mb-3 shadow-lg shadow-indigo-600/30"><Zap size={22} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-white">Agendar atendimento</h1>
          <p className="text-gray-500 text-sm mt-1">Escolha o profissional, serviço e horário de sua preferência</p>
        </div>
        {step < 5 && <Stepper step={step} />}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-5">Escolha o profissional</h2>
            {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-600" /></div>
              : professionals.length === 0 ? <div className="text-center py-16 text-gray-500">Nenhum profissional disponível no momento</div>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {professionals.map((p) => (
                    <button key={p.id} onClick={() => selectProfessional(p)} className="card p-5 text-left hover:border-indigo-500/40 hover:bg-gray-800/50 transition-all duration-200 group">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-xl group-hover:bg-indigo-600/30 transition-colors">{p.name[0].toUpperCase()}</div>
                        <div><p className="font-semibold text-gray-100">{p.name}</p>{p.specialties?.length > 0 && <p className="text-xs text-gray-500">{p.specialties[0].name}</p>}</div>
                      </div>
                      {p.bio && <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{p.bio}</p>}
                      {p.specialties?.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-3">{p.specialties.slice(1).map((s) => <span key={s.id} className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-500 text-xs rounded-full">{s.name}</span>)}</div>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end"><span className="text-xs text-indigo-400 font-medium group-hover:text-indigo-300">Selecionar →</span></div>
                    </button>
                  ))}
                </div>
              )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep(1)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
              <div><h2 className="text-lg font-semibold text-gray-100">Escolha o serviço</h2><p className="text-sm text-gray-500">Profissional: <span className="text-indigo-400">{selectedPro?.name}</span></p></div>
            </div>
            {services.length === 0 ? <div className="text-center py-12 text-gray-500">Nenhum serviço disponível para este profissional</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((s) => (
                  <button key={s.id} onClick={() => selectService(s)} className="card p-5 text-left hover:border-indigo-500/40 hover:bg-gray-800/50 transition-all group">
                    <p className="font-semibold text-gray-100 mb-1">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-500 mb-3 leading-relaxed">{s.description}</p>}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-gray-400"><Clock size={14} />{fmtDuration(s.duration_minutes)}</span>
                      <span className="flex items-center gap-1.5 text-green-400 font-medium"><DollarSign size={14} />{fmtPrice(s.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep(2)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
              <div><h2 className="text-lg font-semibold text-gray-100">Data e horário</h2><p className="text-sm text-gray-500"><span className="text-indigo-400">{selectedPro?.name}</span> · <span className="text-purple-400">{selectedService?.name}</span></p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5"><MiniCalendar availability={availability} selectedDate={selectedDate} onSelect={selectDate} /></div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">{selectedDate ? `Horários — ${format(parseDateLocal(selectedDate), "dd 'de' MMMM", { locale: ptBR })}` : 'Selecione um dia no calendário'}</h3>
                {loadingSlots ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-gray-600" /></div>
                  : !selectedDate ? <p className="text-gray-600 text-sm text-center py-8">← Escolha uma data</p>
                  : slots.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">Nenhum horário disponível neste dia</p>
                  : (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((t) => (
                        <button key={t} onClick={() => { setSelectedTime(t); setStep(4); }}
                          className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${selectedTime === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-indigo-500/50 hover:text-white'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep(3)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
              <div><h2 className="text-lg font-semibold text-gray-100">Seus dados</h2><p className="text-sm text-gray-500">{selectedDate && format(parseDateLocal(selectedDate), "dd/MM/yyyy", { locale: ptBR })} às {selectedTime}</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 card p-6 space-y-4">
                {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle size={15} />{error}</div>}
                <div><label className="label">Nome completo *</label><input className="input" placeholder="Seu nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Email</label><input className="input" type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Telefone / WhatsApp</label><input className="input" placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} /></div>
                <div><label className="label">Observações</label><textarea className="input resize-none" rows={3} placeholder="Alguma informação adicional..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                <button className="btn-primary w-full justify-center py-3 mt-2" onClick={handleSubmit} disabled={submitting || !form.name}>
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
                </button>
              </div>
              <div className="lg:col-span-2">
                <div className="card p-5 space-y-4 sticky top-6">
                  <h3 className="text-sm font-semibold text-gray-300">Resumo</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 font-bold shrink-0">{selectedPro?.name[0]}</div>
                    <div><p className="font-medium text-gray-200 text-sm">{selectedPro?.name}</p><p className="text-xs text-gray-500">Profissional</p></div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-gray-800 text-sm">
                    <div className="flex justify-between text-gray-400"><span>Serviço</span><span className="text-gray-200">{selectedService?.name}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Duração</span><span className="text-gray-200">{selectedService && fmtDuration(selectedService.duration_minutes)}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Data</span><span className="text-gray-200">{selectedDate && format(parseDateLocal(selectedDate), 'dd/MM/yyyy', { locale: ptBR })}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Horário</span><span className="text-gray-200">{selectedTime}</span></div>
                    <div className="flex justify-between pt-2 border-t border-gray-800 font-semibold"><span className="text-gray-400">Total</span><span className="text-green-400">{selectedService && fmtPrice(selectedService.price)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 5 && confirmation && (
          <div className="max-w-lg mx-auto">
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle size={32} className="text-green-400" /></div>
              <h2 className="text-2xl font-bold text-white mb-2">Agendado com sucesso!</h2>
              <p className="text-gray-500 text-sm mb-6">Você receberá um lembrete em breve.</p>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 text-left space-y-3 mb-6">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
                  <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 font-bold">{confirmation.professional?.[0]}</div>
                  <div><p className="font-semibold text-gray-100">{confirmation.professional}</p><p className="text-xs text-gray-500">{selectedService?.name}</p></div>
                </div>
                <div className="flex items-center gap-3 text-sm"><CalendarCheck size={16} className="text-indigo-400 shrink-0" /><span className="text-gray-300">{selectedDate && format(parseDateLocal(selectedDate), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {selectedTime}</span></div>
                <div className="flex items-center gap-3 text-sm"><User size={16} className="text-indigo-400 shrink-0" /><span className="text-gray-300">{confirmation.customer_name}</span></div>
                <div className="flex items-center gap-3 text-sm"><Clock size={16} className="text-indigo-400 shrink-0" /><span className="text-gray-300">{selectedService && fmtDuration(selectedService.duration_minutes)} · {selectedService && fmtPrice(selectedService.price)}</span></div>
              </div>
              <p className="text-xs text-gray-600 mb-5">Código do agendamento: <span className="text-gray-500 font-mono">#{String(confirmation.id).padStart(6, '0')}</span></p>
              <button className="btn-primary w-full justify-center py-3" onClick={reset}>Fazer outro agendamento</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
