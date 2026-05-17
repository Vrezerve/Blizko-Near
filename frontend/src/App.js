import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import axios from 'axios';

import RoleSelect from './pages/RoleSelect';
import CustomerAuth from './pages/CustomerAuth';
import DriverAuth from './pages/DriverAuth';
import CustomerMain from './pages/CustomerMain';
import DriverMain from './pages/DriverMain';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import PinScreen from './pages/PinScreen';
import PinSetup from './pages/PinSetup';
import ErrorBoundary from './components/ErrorBoundary';
import OneSignalInit from './components/OneSignalInit';
import PushOptInBanner from './components/PushOptInBanner';

import './App.css';

// Load map CSS vars from settings
const MapStyleLoader = () => {
  useEffect(() => {
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/settings/public`).then(res => {
      const s = res.data;
      const root = document.documentElement;
      const toAbs = (u) => (u && u.startsWith('/')) ? `${process.env.REACT_APP_BACKEND_URL}${u}` : u;
      if (s.map_bg_color) root.style.setProperty('--map-bg-color', s.map_bg_color);
      if (s.map_grid_color) root.style.setProperty('--map-grid-color', s.map_grid_color);
      if (s.map_bg_image_url) {
        root.style.setProperty('--map-bg-image', `url("${toAbs(s.map_bg_image_url)}")`);
      } else {
        root.style.setProperty('--map-bg-image', 'none');
      }
      root.style.setProperty('--map-bg-size', s.map_bg_size || 'cover');
      root.style.setProperty('--map-bg-position', s.map_bg_position || 'center');
      if (s.custom_pin_url) {
        root.style.setProperty('--custom-pin-url', `url("${toAbs(s.custom_pin_url)}")`);
      }
    }).catch(() => {});
  }, []);
  return null;
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/auth/customer" element={<CustomerAuth />} />
      <Route path="/auth/driver" element={<DriverAuth />} />
      <Route path="/auth/pin" element={<PinScreen />} />
      <Route path="/auth/pin-setup" element={<PinSetup />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      
      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerMain />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver"
        element={
          <ProtectedRoute allowedRoles={['driver']}>
            <DriverMain />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPanel />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MapStyleLoader />
        <OneSignalInit />
        <PushOptInBanner />
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
