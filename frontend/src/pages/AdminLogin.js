import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Mail, Lock, Loader2, Shield } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { adminLogin } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testMode, setTestMode] = useState(null);

  useEffect(() => {
    axios.get(`${API}/settings/public`).then(r => setTestMode(r.data.test_mode !== false)).catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminLogin(email, password);
      navigate('/admin');
    } catch (error) {
      setError(error.response?.data?.detail || 'Неверные учетные данные');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          data-testid="admin-back-btn"
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Панель администратора</h1>
            <p className="text-slate-500 mt-2">Войдите для управления сервисом</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  data-testid="admin-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field !pl-14"
                  placeholder="admin@taxi.local"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  data-testid="admin-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field !pl-14"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              data-testid="admin-login-btn"
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Войти'}
            </button>
          </form>

          {testMode && (
            <p className="text-center text-sm text-slate-400 mt-6">
              Тестовые данные: admin@taxi.local / admin123
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
