import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Phone, Loader2, Check, FileText, X } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CustomerAuth = () => {
  const navigate = useNavigate();
  const { sendCode, verifyCode, user } = useAuth();
  
  const [step, setStep] = useState('phone'); // phone, code, blocked
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [settings, setSettings] = useState(null);
  const [redirectingToPin, setRedirectingToPin] = useState(false);

  useEffect(() => {
    if (redirectingToPin) return;
    if (user && user.role === 'customer') {
      navigate('/customer');
    }
  }, [user, navigate, redirectingToPin]);

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

  const handleSendCode = async () => {
    if (!agreedTerms || !agreedPrivacy) {
      setError('Необходимо принять условия');
      return;
    }

    const cleanPhone = getCleanPhone();
    if (cleanPhone.length !== 12) {
      setError('Введите корректный номер телефона');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if user already has a PIN - skip SMS, go to PIN screen
      const pinCheck = await axios.get(`${API}/auth/check-pin/${encodeURIComponent(cleanPhone)}/customer`);
      if (pinCheck.data.has_pin) {
        localStorage.setItem('taxi_pin_phone', cleanPhone);
        localStorage.setItem('taxi_pin_role', 'customer');
        localStorage.setItem('taxi_has_pin', 'true');
        setRedirectingToPin(true);
        navigate('/auth/pin');
        return;
      }
    } catch (e) {
      // If check fails, proceed with SMS
    }

    try {
      await sendCode(cleanPhone, 'customer');
      setStep('code');
    } catch (error) {
      const detail = error.response?.data?.detail || 'Ошибка отправки кода';
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
      const result = await verifyCode(getCleanPhone(), code, 'customer');
      // If user doesn't have PIN yet, redirect to PIN setup
      if (!result.has_pin) {
        setRedirectingToPin(true);
        navigate('/auth/pin-setup');
      } else {
        navigate('/customer');
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Неверный код';
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

  return (
    <div className="app-container">
      <div className="map-background" />
      
      <div className="relative z-10 min-h-[100dvh] flex flex-col">
        <div className="p-4">
          <button
            data-testid="back-btn"
            onClick={() => step === 'code' ? setStep('phone') : navigate('/')}
            className="w-10 h-10 bg-white rounded-full shadow flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="flex-1 flex items-end">
          <div className="bottom-sheet slide-up">
            {step === 'blocked' ? (
              <div className="space-y-6 text-center py-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <X className="w-10 h-10 text-red-600" />
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
            ) : step === 'phone' ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Вход для пассажира</h2>
                  <p className="text-slate-500">Введите номер телефона для получения кода</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Номер телефона</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      data-testid="phone-input"
                      type="tel"
                      value={phone || '+7'}
                      onChange={handlePhoneChange}
                      className="input-field !pl-14"
                      placeholder="+7 (___) ___-__-__"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      data-testid="terms-checkbox"
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="checkbox-custom mt-0.5"
                    />
                    <span className="text-sm text-slate-600">
                      Принимаю{' '}
                      <button 
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-green-600 underline"
                      >
                        условия сервиса
                      </button>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      data-testid="privacy-checkbox"
                      type="checkbox"
                      checked={agreedPrivacy}
                      onChange={(e) => setAgreedPrivacy(e.target.checked)}
                      className="checkbox-custom mt-0.5"
                    />
                    <span className="text-sm text-slate-600">
                      Даю{' '}
                      <button 
                        type="button"
                        onClick={() => setShowPrivacy(true)}
                        className="text-green-600 underline"
                      >
                        согласие на обработку данных
                      </button>
                    </span>
                  </label>
                </div>

                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}

                <button
                  data-testid="send-code-btn"
                  onClick={handleSendCode}
                  disabled={loading || !agreedTerms || !agreedPrivacy}
                  className="btn-primary"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Продолжить'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Введите код</h2>
                  <p className="text-slate-500">Код отправлен на {phone}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Код подтверждения</label>
                  <input
                    data-testid="code-input"
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
                  {settings?.test_mode !== false && (
                    <p className="text-xs text-slate-400 mt-2 text-center">Для тестирования используйте код: 1234</p>
                  )}
                </div>

                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}

                <button
                  data-testid="verify-code-btn"
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
              </div>
            )}
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
                {settings?.terms_text || 'Условия использования сервиса...'}
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

export default CustomerAuth;
