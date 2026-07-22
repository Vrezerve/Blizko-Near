import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Car, User, Shield, ChevronRight, Loader2 } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import axios from 'axios';
import { fetchPublicSettings } from '../lib/settingsCache';
import { getText } from '../lib/uiTexts';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AuthSlider = ({ slides, autoplay = true, interval = 5 }) => {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const containerRef = useRef(null);

  const total = slides.length;
  const goTo = useCallback((i) => setIndex(((i % total) + total) % total), [total]);

  useEffect(() => {
    if (!autoplay || total <= 1 || dragging) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), Math.max(1, interval) * 1000);
    return () => clearInterval(t);
  }, [autoplay, interval, total, dragging]);

  if (total === 0) return null;

  const width = containerRef.current?.offsetWidth || 320;

  const onStart = (clientX) => {
    startXRef.current = clientX;
    setDragging(true);
  };
  const onMove = (clientX) => {
    if (!dragging) return;
    setDragOffset(clientX - startXRef.current);
  };
  const onEnd = () => {
    if (!dragging) return;
    const threshold = Math.min(80, width * 0.2);
    if (dragOffset > threshold) goTo(index - 1);
    else if (dragOffset < -threshold) goTo(index + 1);
    setDragOffset(0);
    setDragging(false);
  };

  return (
    <div
      ref={containerRef}
      className="auth-slider"
      data-testid="auth-slider"
      onTouchStart={(e) => onStart(e.touches[0].clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
      onTouchEnd={onEnd}
      onMouseDown={(e) => onStart(e.clientX)}
      onMouseMove={(e) => dragging && onMove(e.clientX)}
      onMouseUp={onEnd}
      onMouseLeave={onEnd}
    >
      <div
        className="auth-slider-track"
        style={{
          transform: `translateX(calc(${-index * 100}% + ${dragOffset}px))`,
          transition: dragging ? 'none' : 'transform 0.35s ease-out'
        }}
      >
        {slides.map((s) => (
          <div key={s.id} className="auth-slide">
            <img
              src={s.url.startsWith('http') ? s.url : `${process.env.REACT_APP_BACKEND_URL}${s.url}`}
              alt=""
              draggable={false}
              loading="lazy"
            />
          </div>
        ))}
      </div>
      {total > 1 && (
        <div className="auth-slider-dots" data-testid="auth-slider-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`auth-slider-dot ${i === index ? 'active' : ''}`}
              aria-label={`Слайд ${i + 1}`}
              data-testid={`auth-slider-dot-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const RoleSelect = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => {});
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
    } else if (!loading && !user) {
      // Check if user has PIN set (returning user)
      const hasPin = localStorage.getItem('taxi_has_pin');
      const pinPhone = localStorage.getItem('taxi_pin_phone');
      const pinRole = localStorage.getItem('taxi_pin_role');
      if (hasPin && pinPhone && pinRole) {
        navigate('/auth/pin');
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
    // Admin can always access — show link to admin panel
    return (
      <div className="app-container flex flex-col items-center justify-center p-6">
        <div className="map-background" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Технические работы</h1>
          <p className="text-slate-600 mb-6">{settings.maintenance_text || 'Сервис временно недоступен'}</p>
          <a href="/admin/login" className="text-sm text-slate-400 hover:text-slate-600 underline">Вход для администратора</a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="map-background" />
      
      <div className="relative z-10 flex flex-col min-h-[100dvh] p-6">
        {settings?.auth_slides?.length > 0 && (
          <AuthSlider
            slides={settings.auth_slides}
            autoplay={settings.auth_slides_autoplay !== false}
            interval={settings.auth_slides_interval || 5}
          />
        )}

        <div className="flex-1 flex flex-col items-center justify-center">
          <AppLogo size="lg" className="mb-6" />
          
          <p className="text-slate-500 mb-10 text-center">Выберите как вы хотите использовать сервис</p>
          
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
                  <p className="text-sm text-slate-500">{getText(settings, 'role_customer_subtitle')}</p>
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
          {settings?.test_mode ? (
            <button
              data-testid="admin-login-link"
              onClick={() => navigate('/admin/login')}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Вход для администратора
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RoleSelect;
