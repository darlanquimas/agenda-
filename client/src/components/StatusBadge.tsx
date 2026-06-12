import { Clock, Play, CheckCircle, XCircle, Ban, AlertCircle, LucideIcon } from 'lucide-react';

type Status = 'pending' | 'scheduled' | 'running' | 'finished' | 'failed' | 'cancelled';

const config: Record<Status, { label: string; icon: LucideIcon; cls: string }> = {
  pending:   { label: 'Pendente',    icon: AlertCircle, cls: 'badge-pending' },
  scheduled: { label: 'Agendado',    icon: Clock,       cls: 'badge-scheduled' },
  running:   { label: 'Em Execução', icon: Play,        cls: 'badge-running' },
  finished:  { label: 'Finalizado',  icon: CheckCircle, cls: 'badge-finished' },
  failed:    { label: 'Falhou',      icon: XCircle,     cls: 'badge-failed' },
  cancelled: { label: 'Cancelado',   icon: Ban,         cls: 'badge-cancelled' },
};

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status as Status] ?? config.scheduled;
  const Icon = c.icon;
  return (
    <span className={c.cls}>
      <Icon size={11} />
      {c.label}
    </span>
  );
}
