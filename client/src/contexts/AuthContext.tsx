import { createContext, useContext, useState, ReactNode } from 'react';
import api from '../api/axios';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  tenant_id: number | null;
  tenant_slug: string | null;
  tenant_name: string | null;
  is_super_admin: boolean;
  active: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ user: AuthUser }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('user') ?? 'null'); } catch { return null; }
  });
  const [loading] = useState(false);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>('/auth/login', { email, password });
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignora erros de rede */ }
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
