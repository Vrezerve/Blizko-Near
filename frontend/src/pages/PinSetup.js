import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Car, Delete, Loader2, Check } from 'lucide-react';

const PinSetup = () => {
  const navigate = useNavigate();
  const { user, setPin: savePinToServer } = useAuth();

  const [step, setStep] = useState('create'); // create, confirm
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const role = user?.role || localStorage.getItem('taxi_pin_role') || localStorage.getItem('taxi_role');

  const handleDigit = (digit) => {
    if (loading) return;
    setError('');
    if (step === 'create') {
      setPin(prev => {
        const next = prev + digit;
        if (next.length === 4) {
          setTimeout(() => {
            setStep('confirm');
          }, 200);
        }
        return next.length <= 4 ? next : prev;
      });
    } else {
      setConfirmPin(prev => {
        const next = prev + digit;
        if (next.length === 4) {
          setTimeout(() => handleConfirm(next), 200);
        }
        return next.length <= 4 ? next : prev;
      });
    }
  };

  const handleDelete = () => {
    if (loading) return;
    if (step === 'create') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
    setError('');
  };

  const handleConfirm = async (confirmed) => {
    if (confirmed !== pin) {
      setError('Коды не совпадают. Попробуйте ещё раз');
      setConfirmPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    try {
      await savePinToServer(pin);
      const dest = role === 'customer' ? '/customer' : role === 'driver' ? '/driver' : '/';
      navigate(dest);
    } catch (err) {
      setError('Ошибка сохранения. Попробуйте ещё раз');
      setConfirmPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    const dest = role === 'customer' ? '/customer' : role === 'driver' ? '/driver' : '/';
    navigate(dest);
  };

  const currentPin = step === 'create' ? pin : confirmPin;

  return (
    <div className="app-container">
      <div className="min-h-[100dvh] flex flex-col bg-white">
        {/* Top section */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-4">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Рядом</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {step === 'create' ? 'Придумайте код' : 'Повторите код'}
          </h1>
          <p className="text-sm text-slate-500 text-center mb-8 max-w-[260px]">
            {step === 'create'
              ? 'Придумайте 4-значный код для быстрого входа'
              : 'Введите код ещё раз для подтверждения'
            }
          </p>

          {/* PIN dots */}
          <div className={`flex gap-3 mb-3 ${shake ? 'animate-shake' : ''}`} data-testid="pin-setup-dots">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                  i < currentPin.length
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : i === currentPin.length
                    ? 'border-green-500 bg-white'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {i < currentPin.length ? (
                  <div className="w-3 h-3 bg-green-600 rounded-full" />
                ) : i === currentPin.length ? (
                  <div className="w-0.5 h-6 bg-green-500 animate-pulse" />
                ) : null}
              </div>
            ))}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${step === 'create' ? 'bg-green-500' : 'bg-slate-300'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-green-500' : 'bg-slate-300'}`} />
          </div>

          {/* Error / status */}
          <div className="h-6 flex items-center justify-center">
            {loading ? (
              <div className="flex items-center gap-2 text-green-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Сохранение...</span>
              </div>
            ) : error ? (
              <p className="text-red-500 text-xs text-center" data-testid="pin-setup-error">{error}</p>
            ) : (
              <p className="text-slate-400 text-xs">
                {step === 'create' ? 'Шаг 1 из 2' : 'Шаг 2 из 2'}
              </p>
            )}
          </div>
        </div>

        {/* Number pad */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto" data-testid="pin-setup-numpad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                data-testid={`pin-setup-key-${digit}`}
                onClick={() => handleDigit(String(digit))}
                disabled={loading}
                className="w-full aspect-square rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-2xl font-medium text-slate-800 transition-all duration-100 active:scale-95 disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <div />
            <button
              data-testid="pin-setup-key-0"
              onClick={() => handleDigit('0')}
              disabled={loading}
              className="w-full aspect-square rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-2xl font-medium text-slate-800 transition-all duration-100 active:scale-95 disabled:opacity-50"
            >
              0
            </button>
            <button
              data-testid="pin-setup-key-delete"
              onClick={handleDelete}
              disabled={loading}
              className="w-full aspect-square rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center transition-all duration-100 active:scale-95"
            >
              <Delete className="w-6 h-6 text-slate-600" />
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 pb-4 flex flex-col items-center gap-3">
            {step === 'confirm' && (
              <button
                data-testid="pin-setup-back-btn"
                onClick={() => { setStep('create'); setPin(''); setConfirmPin(''); setError(''); }}
                className="text-sm text-slate-500 hover:text-green-600 transition-colors"
              >
                Ввести другой код
              </button>
            )}
            <button
              data-testid="pin-setup-skip-btn"
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Пропустить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinSetup;
