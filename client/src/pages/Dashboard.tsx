import { useEffect, useState } from 'react';
import { Users, CalendarCheck, CheckCircle, XCircle, Clock, Play, TrendingUp, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';

interface StatCardProps { icon: React.ElementType; label: string; value: number; color: string; sub?: string }

function StatCard({ icon: Icon, label, value, color, sub }: StatCardProps) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    blue:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
    green:  'text-green-400 bg-green-500/10 border-green-500/20',
    red:    'text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-indigo-400 font-semibold">{payload[0].value} agendamentos</p>
    </div>
  );
}

const actionLabels: Record<string, { label: string; cls: string }> = {
  create: { label: 'Criado', cls: 'text-green-400' },
  update: { label: 'Atualizado', cls: 'text-blue-400' },
  delete: { label: 'Excluído', cls: 'text-red-400' },
};

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then((r) => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const chartData = stats?.last30Days?.map((d: { day: string; count: number }) => ({
    date: format(parseISO(d.day), 'dd/MM', { locale: ptBR }),
    count: d.count,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="col-span-2 lg:col-span-1 xl:col-span-2">
          <StatCard icon={Users} label="Clientes ativos" value={stats?.totalClients ?? 0} color="indigo" />
        </div>
        <div className="col-span-2 lg:col-span-1 xl:col-span-2">
          <StatCard icon={CalendarCheck} label="Total agendamentos" value={stats?.totalAppointments ?? 0} color="blue" />
        </div>
        <StatCard icon={Clock} label="Agendados" value={stats?.scheduled ?? 0} color="blue" />
        <StatCard icon={Play} label="Em execução" value={stats?.running ?? 0} color="yellow" />
        <StatCard icon={CheckCircle} label="Finalizados" value={stats?.finished ?? 0} color="green" />
        <StatCard icon={XCircle} label="Falharam" value={stats?.failed ?? 0} color="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-gray-200">Agendamentos — últimos 30 dias</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck size={18} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-gray-200">Próximos agendamentos</h2>
          </div>
          <div className="space-y-3">
            {stats?.upcomingAppointments?.length === 0 && <p className="text-gray-600 text-sm">Nenhum agendamento futuro</p>}
            {stats?.upcomingAppointments?.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 font-medium truncate">{a.title}</p>
                  <p className="text-xs text-gray-500 truncate">{a.client_name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {format(new Date(a.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Atividade recente</h2>
        </div>
        <div className="space-y-1">
          {stats?.recentActivity?.map((item: any) => {
            const act = actionLabels[item.action] ?? { label: item.action, cls: 'text-gray-400' };
            return (
              <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-800/50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className={`text-xs font-medium shrink-0 ${act.cls}`}>{act.label}</span>
                <span className="text-sm text-gray-300 flex-1 truncate">{item.details}</span>
                <span className="text-xs text-gray-600 shrink-0">
                  {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
