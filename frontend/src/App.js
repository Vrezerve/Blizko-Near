import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import axios from 'axios';
import { fetchPublicSettings } from './lib/settingsCache';

import RoleSelect from './pages/RoleSelect';
import CustomerAuth from './pages/CustomerAuth';
import DriverAuth from './pages/DriverAuth';
import PinScreen from './pages/PinScreen';
import PinSetup from './pages/PinSetup';
import ErrorBoundary from './components/ErrorBoundary';
import OneSignalInit from './components/OneSignalInit';
import PushOptInBanner from './components/PushOptInBanner';
import InstallPrompt from './components/InstallPrompt';

// Heavy screens — split into separate chunks to speed up first paint
const CustomerMain = lazy(() => import('./pages/CustomerMain'));
const DriverMain = lazy(() => import('./pages/DriverMain'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const PushDebug = lazy(() => import('./pages/PushDebug'));

import './App.css';

const PageFallback = () => (
  <div className="app-container flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Set a sane global timeout so slow backend doesn't freeze the app
axios.defaults.timeout = 15000;

// Load map CSS vars from settings
const MapStyleLoader = () => {
  useEffect(() => {
    fetchPublicSettings().then(s => {
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
      root.style.setProperty('--map-bg-repeat', s.map_bg_repeat || 'no-repeat');
      if (s.custom_pin_url) {
        root.style.setProperty('--custom-pin-url', `url("${toAbs(s.custom_pin_url)}")`);
      }
    }).catch(() => {});
  }, []);
  return null;
};

const ProtectedRoute = ({ children, allowedRoles, loginPath = '/' }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={loginPath} replace />;
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
      <Route path="/push-debug" element={<PushDebug />} />
      
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
          <ProtectedRoute allowedRoles={['admin']} loginPath="/admin/login">
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
        <InstallPrompt />
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <AppRoutes />
          </Suspense>
        </ErrorBoundary>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
