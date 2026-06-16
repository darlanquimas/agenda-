import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Appointments from './pages/Appointments';
import History from './pages/History';
import Professionals from './pages/Professionals';
import ServicesPage from './pages/ServicesPage';
import Booking from './pages/Booking';
import Platform from './pages/Platform';
import TenantUsers from './pages/TenantUsers';
import WhatsApp from './pages/WhatsApp';
import Profile from './pages/Profile';
import { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_super_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ToastContainer />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/book/:tenantSlug" element={<Booking />} />
            <Route path="/book" element={<Navigate to="/book/demo" replace />} />
            <Route path="/platform" element={<SuperAdminRoute><Layout /></SuperAdminRoute>}>
              <Route index element={<Platform />} />
            </Route>
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="clients" element={<Clients />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="professionals" element={<Professionals />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="users" element={<TenantUsers />} />
              <Route path="whatsapp" element={<WhatsApp />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
