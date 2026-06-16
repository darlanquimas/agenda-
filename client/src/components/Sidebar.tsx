import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, History, LogOut, Zap, X, UserCheck, Briefcase, ExternalLink, Check, Shield, UserCog, MessageCircle, LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

interface NavItem {
  to?: string;
  icon?: LucideIcon;
  label: string;
  divider?: boolean;
}

const links: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { divider: true, label: 'Cadastros' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/professionals', icon: UserCheck, label: 'Profissionais' },
  { to: '/services', icon: Briefcase, label: 'Serviços' },
  { to: '/users', icon: UserCog, label: 'Usuários' },
  { divider: true, label: 'Operação' },
  { to: '/appointments', icon: CalendarCheck, label: 'Agendamentos' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/history', icon: History, label: 'Histórico' },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const copyBookingLink = () => {
    if (!user?.tenant_slug) return;
    const url = `${window.location.origin}/book/${user.tenant_slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={onClose} />}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-30 flex flex-col
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Agenda+</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-gray-300 p-1"><X size={18} /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {user?.is_super_admin && (
            <NavLink
              to="/platform"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-1
                ${isActive ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`
              }
            >
              <Shield size={17} />
              Plataforma
            </NavLink>
          )}
          {!user?.is_super_admin && links.map((item, i) => {
            if (item.divider) {
              return (
                <div key={i} className="pt-3 pb-1 px-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{item.label}</p>
                </div>
              );
            }
            const Icon = item.icon!;
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800 space-y-2">
          {user?.tenant_slug && (
            <button
              onClick={copyBookingLink}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 transition-all"
            >
              {copied ? <Check size={15} className="text-green-400" /> : <ExternalLink size={15} />}
              {copied ? 'Link copiado!' : 'Link de agendamento'}
            </button>
          )}
          <button
            onClick={() => { navigate('/profile'); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              {user?.tenant_name && <p className="text-xs text-indigo-400/80 truncate">{user.tenant_name}</p>}
            </div>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150">
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
