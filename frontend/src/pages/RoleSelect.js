import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Car, User, Shield, ChevronRight, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const RoleSelect = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API}/settings/public`);
        setSettings(response.data);
      } catch (error) {
        console.error('Failed to fetch settings');
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'customer') {
        navigate('/customer');
      } else if (user.role === 'driver') {
        navigate('/driver');
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (settings?.maintenance_mode) {
    return (
      <div className="app-container flex flex-col items-center justify-center p-6">
        <div className="map-background" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Технические работы</h1>
          <p className="text-slate-600">{settings.maintenance_text || 'Сервис временно недоступен'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="map-background" />
      
      <div className="relative z-10 flex flex-col min-h-[100dvh] p-6">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-green-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <Car className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Такси</h1>
          <p className="text-slate-500 mb-12">Быстро и удобно</p>
          
          <div className="w-full space-y-4">
            <button
              data-testid="role-customer-btn"
              onClick={() => navigate('/auth/customer')}
              className="card w-full flex items-center justify-between p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Войти как заказчик</p>
                  <p className="text-sm text-slate-500">Вызвать такси</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-green-600 transition-colors" />
            </button>
            
            <button
              data-testid="role-driver-btn"
              onClick={() => navigate('/auth/driver')}
              className="card w-full flex items-center justify-between p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Car className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Войти как исполнитель</p>
                  <p className="text-sm text-slate-500">Принимать заказы</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>
        </div>
        
        <div className="text-center pt-6">
          <button
            data-testid="admin-login-link"
            onClick={() => navigate('/admin/login')}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Вход для администратора
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelect;
