import { useEffect, useState, useCallback } from 'react';
import { Activity, ChevronLeft, ChevronRight, Loader2, UserCircle, Pencil, Plus, Trash2, ShieldOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

interface ActivityItem {
  id: number; action: string; entity: string | null; details: string | null;
  created_at: string; user_name: string | null;
}

const actionConfig: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  create: { label: 'Criação', icon: Plus, cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  update: { label: 'Atualização', icon: Pencil, cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  delete: { label: 'Exclusão', icon: Trash2, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const entityLabels: Record<string, string> = { appointment: 'Agendamento', client: 'Cliente', user: 'Usuário' };

export default function History() {
  const { user } = useAuth();
  const [data, setData] = useState<{ data: ActivityItem[]; total: number; pages: number }>({ data: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/dashboard/activity', { params: { page, limit: 20 } }); setData(r.data); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { if (user?.role !== 'professional') fetchData(); }, [fetchData, user]);

  if (user?.role === 'professional') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <ShieldOff size={36} className="text-gray-700" />
        <p className="text-gray-500 text-sm">Você não tem permissão para acessar o histórico de atividades.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Registro de atividades</h2>
          <span className="ml-auto text-xs text-gray-500">{data.total} eventos</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-600" /></div>
        ) : data.data.length === 0 ? (
          <p className="text-center text-gray-600 py-16">Nenhuma atividade registrada</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[2.75rem] top-0 bottom-0 w-px bg-gray-800" />
            <div className="space-y-0">
              {data.data.map((item) => {
                const act = actionConfig[item.action] ?? actionConfig.update;
                const Icon = act.icon;
                return (
                  <div key={item.id} className="flex gap-4 px-5 py-4 hover:bg-gray-800/20 transition-colors">
                    <div className="relative shrink-0 z-10">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${act.cls}`}>
                        <Icon size={14} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                        <span className="text-sm font-medium text-gray-200">{item.details}</span>
                        {item.entity && (
                          <span className="text-xs text-gray-600 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded">
                            {entityLabels[item.entity] ?? item.entity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <UserCircle size={12} />
                        <span>{item.user_name || 'Sistema'}</span>
                        <span className="text-gray-700">•</span>
                        <span>{format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                    <div className="shrink-0 pt-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${act.cls}`}>{act.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {data.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-500">Página {page} de {data.pages}</p>
            <div className="flex gap-2">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage((p) => p - 1)} disabled={page === 1}><ChevronLeft size={14} /></button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage((p) => p + 1)} disabled={page === data.pages}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
