import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Phone, Loader2, Check, Car, User, X, Clock, Ban } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const DriverAuth = () => {
  const navigate = useNavigate();
  const { sendCode, verifyCode, registerDriver, checkDriverStatus, user } = useAuth();
  
  const [step, setStep] = useState('phone'); // phone, code, register, awaiting, blocked
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (user && user.role === 'driver') {
      navigate('/driver');
    }
  }, [user, navigate]);

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

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 1) return '+7';
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const getCleanPhone = () => {
    return '+7' + phone.replace(/\D/g, '').slice(1);
  };

  const handleCheckPhone = async () => {
    const cleanPhone = getCleanPhone();
    if (cleanPhone.length !== 12) {
      setError('Введите корректный номер телефона');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const status = await checkDriverStatus(cleanPhone);
      
      if (!status.exists) {
        // New driver - show registration
        setStep('register');
      } else if (!status.activated) {
        // Existing but not activated
        setStep('awaiting');
      } else {
        // Existing and activated - send code
        await sendCode(cleanPhone, 'driver');
        setStep('code');
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Ошибка проверки';
      if (detail.startsWith('DEVICE_BLOCKED:')) {
        setError(detail.replace('DEVICE_BLOCKED:', ''));
        setStep('blocked');
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!agreedTerms || !agreedPrivacy) {
      setError('Необходимо принять условия');
      return;
    }

    if (!name.trim() || !carModel.trim() || !carNumber.trim()) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await registerDriver({
        phone: getCleanPhone(),
        name: name.trim(),
        car_model: carModel.trim(),
        car_number: carNumber.trim().toUpperCase(),
        agreed_terms: true,
        agreed_privacy: true
      });
      setStep('awaiting');
    } catch (error) {
      const detail = error.response?.data?.detail || 'Ошибка регистрации';
      if (detail.startsWith('DEVICE_BLOCKED:')) {
        setError(detail.replace('DEVICE_BLOCKED:', ''));
        setStep('blocked');
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 4) {
      setError('Введите 4-значный код');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await verifyCode(getCleanPhone(), code, 'driver');
      if (!result.has_pin) {
        navigate('/auth/pin-setup');
      } else {
        navigate('/driver');
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail === 'AWAITING_ACTIVATION') {
        setStep('awaiting');
      } else if (detail?.startsWith('DEVICE_BLOCKED:')) {
        setError(detail.replace('DEVICE_BLOCKED:', ''));
        setStep('blocked');
      } else {
        setError(detail || 'Неверный код');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'blocked':
        return (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Ban className="w-10 h-10 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Устройство заблокировано</h2>
              <p className="text-slate-500">{error || 'Обратитесь к администратору для разблокировки'}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              На главную
            </button>
          </div>
        );

      case 'phone':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Вход для водителя</h2>
              <p className="text-slate-500">Введите номер телефона</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Номер телефона</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  data-testid="driver-phone-input"
                  type="tel"
                  value={phone || '+7'}
                  onChange={handlePhoneChange}
                  className="input-field pl-12"
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              data-testid="driver-check-phone-btn"
              onClick={handleCheckPhone}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Продолжить'}
            </button>
          </div>
        );

      case 'register':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Регистрация водителя</h2>
              <p className="text-slate-500">Заполните данные о себе</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ФИО</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    data-testid="driver-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field pl-12"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Автомобиль</label>
                <div className="relative">
                  <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    data-testid="driver-car-input"
                    type="text"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    className="input-field pl-12"
                    placeholder="Toyota Camry"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Номер автомобиля</label>
                <input
                  data-testid="driver-car-number-input"
                  type="text"
                  value={carNumber}
                  onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
                  className="input-field"
                  placeholder="А123БВ777"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  data-testid="driver-terms-checkbox"
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="checkbox-custom mt-0.5"
                />
                <span className="text-sm text-slate-600">
                  Принимаю{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-green-600 underline">
                    условия сервиса
                  </button>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  data-testid="driver-privacy-checkbox"
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="checkbox-custom mt-0.5"
                />
                <span className="text-sm text-slate-600">
                  Даю{' '}
                  <button type="button" onClick={() => setShowPrivacy(true)} className="text-green-600 underline">
                    согласие на обработку данных
                  </button>
                </span>
              </label>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              data-testid="driver-register-btn"
              onClick={handleRegister}
              disabled={loading || !agreedTerms || !agreedPrivacy}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Зарегистрироваться'}
            </button>
          </div>
        );

      case 'awaiting':
        return (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Ожидается активация</h2>
              <p className="text-slate-500">
                Ваша заявка отправлена на проверку.<br />
                Администратор активирует ваш аккаунт в ближайшее время.
              </p>
            </div>
            <button
              data-testid="driver-back-home-btn"
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              На главную
            </button>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Введите код</h2>
              <p className="text-slate-500">Код отправлен на {phone}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Код из СМС</label>
              <input
                data-testid="driver-code-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                className="input-field text-center text-2xl tracking-widest"
                placeholder="• • • •"
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              data-testid="driver-verify-code-btn"
              onClick={handleVerifyCode}
              disabled={loading || code.length !== 4}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Check className="w-5 h-5" />
                  Подтвердить
                </>
              )}
            </button>

            <p className="text-center text-sm text-slate-500">
              Для тестирования используйте код: <span className="font-mono font-bold">1234</span>
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <div className="map-background" />
      
      <div className="relative z-10 min-h-[100dvh] flex flex-col">
        <div className="p-4">
          <button
            data-testid="driver-back-btn"
            onClick={() => {
              if (step === 'code') setStep('phone');
              else if (step === 'register') setStep('phone');
              else navigate('/');
            }}
            className="w-10 h-10 bg-white rounded-full shadow flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="flex-1 flex items-end">
          <div className="bottom-sheet slide-up">
            {renderStep()}
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Условия сервиса</h3>
              <button onClick={() => setShowTerms(false)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-slate-600 whitespace-pre-line">
                {settings?.driver_rules_text || settings?.terms_text || 'Условия использования сервиса...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Политика конфиденциальности</h3>
              <button onClick={() => setShowPrivacy(false)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-slate-600 whitespace-pre-line">
                {settings?.privacy_text || 'Политика конфиденциальности...'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverAuth;
