import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireClient, RequireAdmin } from './components/auth/RequireAuth';
import ClientLogin    from './components/auth/ClientLogin';
import ClientRegister from './components/auth/ClientRegister';
import AdminLogin     from './components/auth/AdminLogin';
import ClientDashboard from './pages/ClientDashboard';
import AdminPanel      from './pages/AdminPanel';
import NewEstimate     from './pages/NewEstimate';
import EstimateView    from './pages/EstimateView';
import ProjectDetail  from './pages/ProjectDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Client auth */}
          <Route path="/login"    element={<ClientLogin />} />
          <Route path="/register" element={<ClientRegister />} />

          {/* Admin auth — separate portal */}
          <Route path="/admin" element={<AdminLogin />} />

          {/* Protected client routes */}
          <Route path="/dashboard"    element={<RequireClient><ClientDashboard /></RequireClient>} />
          <Route path="/estimates/new" element={<RequireClient><NewEstimate /></RequireClient>} />

          {/* Project detail — both roles */}
          <Route path="/projects/:id" element={<ProjectDetail />} />

          {/* Shared — both roles can view estimates (EstimateView adapts by role) */}
          <Route path="/estimates/:id" element={<EstimateView />} />

          {/* Protected admin routes */}
          <Route path="/admin/dashboard" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
