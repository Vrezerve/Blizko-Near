import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Delete, HelpCircle, Loader2, PhoneCall, Clock, Check } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const PinScreen = () => {
  const navigate = useNavigate();
  const { loginWithPin, resetPinRequest, resetPinVerify, applyAuthResult, deviceId, user, loading: authLoading } = useAuth();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [locked, setLocked] = useState(false);
  const [resetStep, setResetStep] = useState(null); // null, 'call', 'code', 'new_pin'
  const [resetCode, setResetCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [callData, setCallData] = useState(null);
  const [callTimeLeft, setCallTimeLeft] = useState(0);
  const [callConfirmed, setCallConfirmed] = useState(false);

  const phone = localStorage.getItem('taxi_pin_phone');
  const role = localStorage.getItem('taxi_pin_role');

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      navigate(user.role === 'customer' ? '/customer' : user.role === 'driver' ? '/driver' : '/admin');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!phone || !role) {
      navigate('/');
    }
  }, [phone, role, navigate]);

  const handlePinSubmit = useCallback(async (fullPin) => {
    if (!phone || !role) return;
    setLoading(true);
    setError('');
    try {
      await loginWithPin(phone, fullPin, role);
      navigate(role === 'customer' ? '/customer' : '/driver');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Неверный код';
      if (detail === 'PIN_LOCKED') {
        setLocked(true);
        setError('PIN заблокирован. Восстановите через SMS');
      } else if (detail.startsWith('WRONG_PIN:')) {
        const left = parseInt(detail.split(':')[1]);
        setAttemptsLeft(left);
        setError(`Неверный код. Осталось попыток: ${left}`);
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else if (detail.startsWith('DEVICE_BLOCKED:')) {
        setError('Устройство заблокировано');
      } else {
        setError(detail);
      }
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [phone, role, loginWithPin, navigate]);

  const handleDigit = useCallback((digit) => {
    if (loading || locked) return;
    setError('');
    setPin(prev => {
      const next = prev + digit;
      if (next.length === 4) {
        setTimeout(() => handlePinSubmit(next), 150);
      }
      return next.length <= 4 ? next : prev;
    });
  }, [loading, locked, handlePinSubmit]);

  const handleDelete = useCallback(() => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
    setError('');
  }, [loading]);

  const handleForgotPin = async () => {
    if (!phone || !role) return;
    setResetLoading(true);
    setError('');

    // Try call verification first (only for customers when enabled on backend)
    try {
      const res = await axios.post(`${API}/auth/callcheck/start`, {
        phone,
        role,
        device_id: deviceId,
        purpose: 'pin_reset'
      });
      if (res.data.method === 'call') {
        setCallData(res.data);
        setCallTimeLeft(res.data.timeout || 300);
        setCallConfirmed(false);
        setResetStep('call');
        setResetLoading(false);
        return;
      }
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (typeof detail === 'string' && detail.startsWith('RATE_LIMIT:')) {
        setError(`Повторный запрос возможен через ${detail.split(':')[1]} сек.`);
        setResetLoading(false);
        return;
      }
      if (detail === 'RATE_LIMIT_HOUR') {
        setError('Слишком много попыток. Попробуйте позже.');
        setResetLoading(false);
        return;
      }
      // fall back to SMS
    }

    // Fallback: SMS-based reset
    setResetStep('code');
    try {
      await resetPinRequest(phone, role);
    } catch (err) {
      setError('Ошибка отправки кода');
    } finally {
      setResetLoading(false);
    }
  };

  // Poll callcheck status while on the 'call' reset step
  useEffect(() => {
    if (resetStep !== 'call' || !callData) return;
    let active = true;
    const poll = setInterval(async () => {
      try {
        const res = await axios.post(`${API}/auth/callcheck/status`, {
          verify_id: callData.verify_id,
          device_id: deviceId
        });
        if (!active) return;
        if (res.data.status === 'confirmed') {
          clearInterval(poll);
          setCallConfirmed(true);
          applyAuthResult(res.data.token, res.data.user, role, false);
          setTimeout(() => navigate('/auth/pin-setup'), 1500);
        } else if (res.data.status === 'expired') {
          clearInterval(poll);
          setCallData(null);
          setResetStep(null);
          setError('Время подтверждения истекло. Попробуйте снова.');
        }
      } catch (e) { /* keep polling */ }
    }, (callData.poll_interval || 3) * 1000);
    const timer = setInterval(() => setCallTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetStep, callData]);

  const handleResetVerify = async () => {
    if (resetCode.length !== 4 || newPin.length !== 4) return;
    setResetLoading(true);
    setError('');
    try {
      await resetPinVerify(phone, resetCode, role, newPin);
      navigate(role === 'customer' ? '/customer' : '/driver');
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка сброса');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem('taxi_has_pin');
    localStorage.removeItem('taxi_pin_phone');
    localStorage.removeItem('taxi_pin_role');
    navigate('/');
  };

  // PIN Reset flow
  if (resetStep) {
    return (
      <div className="app-container">
        <div className="min-h-[100dvh] flex flex-col bg-white">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
            <AppLogo size="md" className="mb-8" />

            {resetStep === 'call' && callData && (
              <div className="w-full max-w-sm space-y-5 text-center" data-testid="pin-reset-call">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{callData.title || 'Подтверждение номера телефона'}</h2>
                  <p className="text-slate-500 text-sm">
                    Для сброса PIN подтвердите номер звонком. Звонок бесплатный.
                  </p>
                </div>

                <div className="call-verify-phone-box">
                  {callData.call_phone_pretty || callData.call_phone}
                </div>

                <div className="call-digit-row">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`call-digit-box ${callConfirmed ? 'filled' : ''}`}>
                      {callConfirmed ? phone.replace(/\D/g, '').slice(-4)[i] : ''}
                    </div>
                  ))}
                </div>

                {callConfirmed ? (
                  <div className="call-verify-success">
                    <Check className="w-5 h-5" />
                    Номер подтверждён!
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 flex items-center justify-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Осталось времени: {Math.floor(callTimeLeft / 60)}:{String(callTimeLeft % 60).padStart(2, '0')}
                    </p>

                    <div className="call-verify-waiting">
                      <span className="call-pulse" />
                      <span>Ожидаем звонок с номера {phone}. После звонка PIN будет сброшен автоматически.</span>
                    </div>

                    <a
                      href={`tel:+${(callData.call_phone || '').replace(/\D/g, '')}`}
                      className="btn-primary !no-underline flex items-center justify-center gap-2"
                    >
                      <PhoneCall className="w-5 h-5" />
                      Позвонить
                    </a>
                  </>
                )}
              </div>
            )}

            {resetStep === 'code' && (
              <div className="w-full max-w-xs space-y-6 text-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Сброс PIN-кода</h2>
                  <p className="text-sm text-slate-500">Код отправлен на {phone}</p>
                </div>

                <input
                  data-testid="reset-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-[0.5em] py-4 border-2 border-slate-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
                  placeholder="----"
                  autoFocus
                />

                <button
                  data-testid="reset-code-next-btn"
                  onClick={() => resetCode.length === 4 && setResetStep('new_pin')}
                  disabled={resetCode.length !== 4}
                  className="btn-primary w-full"
                >
                  Далее
                </button>
              </div>
            )}

            {resetStep === 'new_pin' && (
              <div className="w-full max-w-xs space-y-6 text-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Новый PIN-код</h2>
                  <p className="text-sm text-slate-500">Придумайте новый 4-значный код</p>
                </div>

                <input
                  data-testid="new-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-[0.5em] py-4 border-2 border-slate-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
                  placeholder="----"
                  autoFocus
                />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  data-testid="reset-pin-confirm-btn"
                  onClick={handleResetVerify}
                  disabled={resetLoading || newPin.length !== 4}
                  className="btn-primary w-full"
                >
                  {resetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Сохранить и войти'}
                </button>
              </div>
            )}

            <button
              data-testid="reset-cancel-btn"
              onClick={() => { setResetStep(null); setCallData(null); setCallConfirmed(false); setLocked(false); setError(''); setPin(''); }}
              className="mt-6 text-sm text-slate-400 hover:text-slate-600"
            >
              Вернуться к вводу кода
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="min-h-[100dvh] flex flex-col bg-white">
        {/* Top section with logo and instructions */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-4">
          {/* Logo */}
          <AppLogo size="md" className="mb-8" />

          {/* Title */}
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Введите код</h1>
          <p className="text-sm text-slate-500 text-center mb-8 max-w-[240px]">
            Введите 4-значный код, который вы придумали при регистрации
          </p>

          {/* PIN dots */}
          <div className={`flex gap-3 mb-3 ${shake ? 'animate-shake' : ''}`} data-testid="pin-dots">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                  i < pin.length
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : i === pin.length
                    ? 'border-green-500 bg-white'
                    : 'border-slate-200 bg-white'
                }`}
                data-testid={`pin-dot-${i}`}
              >
                {i < pin.length ? (
                  <div className="w-3 h-3 bg-green-600 rounded-full" />
                ) : i === pin.length ? (
                  <div className="w-0.5 h-6 bg-green-500 animate-pulse" />
                ) : null}
              </div>
            ))}
          </div>

          {/* Error / status */}
          <div className="h-6 flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-green-600" data-testid="pin-loading" />
            ) : error ? (
              <p className="text-red-500 text-xs text-center" data-testid="pin-error">{error}</p>
            ) : (
              <p className="text-slate-400 text-xs">Код должен состоять из 4 цифр</p>
            )}
          </div>
        </div>

        {/* Number pad */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto" data-testid="pin-numpad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                data-testid={`pin-key-${digit}`}
                onClick={() => handleDigit(String(digit))}
                disabled={loading || locked}
                className="w-full aspect-square rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-2xl font-medium text-slate-800 transition-all duration-100 active:scale-95 disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <div />
            <button
              data-testid="pin-key-0"
              onClick={() => handleDigit('0')}
              disabled={loading || locked}
              className="w-full aspect-square rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-2xl font-medium text-slate-800 transition-all duration-100 active:scale-95 disabled:opacity-50"
            >
              0
            </button>
            <button
              data-testid="pin-key-delete"
              onClick={handleDelete}
              disabled={loading}
              className="w-full aspect-square rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center transition-all duration-100 active:scale-95"
            >
              <Delete className="w-6 h-6 text-slate-600" />
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 pb-4 flex flex-col items-center gap-3">
            <button
              data-testid="forgot-pin-btn"
              onClick={handleForgotPin}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-green-600 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Забыли код? Восстановить через SMS</span>
            </button>
            <button
              data-testid="switch-account-btn"
              onClick={handleSwitchAccount}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Другой аккаунт
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinScreen;
