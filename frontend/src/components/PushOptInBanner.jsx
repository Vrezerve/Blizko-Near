import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'push_banner_dismissed_at';
const DISMISS_HOURS = 24;

// OneSignal v16 API notes:
// - OneSignal.Notifications.permission         → BOOLEAN  (true if granted)
// - OneSignal.Notifications.permissionNative   → 'default' | 'granted' | 'denied'
// - OneSignal.User.PushSubscription.optedIn    → BOOLEAN
// - OneSignal.User.PushSubscription.id         → string|undefined
const getState = () => {
  try {
    const OS = window.OneSignal;
    if (!OS || !OS.Notifications) return { ready: false, granted: false, denied: false, optedIn: false };
    const granted = OS.Notifications.permission === true || OS.Notifications.permissionNative === 'granted';
    const denied = OS.Notifications.permissionNative === 'denied';
    const sub = OS.User?.PushSubscription;
    const optedIn = !!(sub?.optedIn || sub?.id);
    return { ready: true, granted, denied, optedIn };
  } catch (_) {
    return { ready: false, granted: false, denied: false, optedIn: false };
  }
};

const PushOptInBanner = () => {
  const { user } = useAuth();
  const [state, setState] = useState({ ready: false, granted: false, denied: false, optedIn: false });
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const listenerSetRef = useRef(false);

  useEffect(() => {
    const t = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (t && Date.now() - t < DISMISS_HOURS * 3600 * 1000) {
      setDismissed(true);
    }
  }, []);

  const refresh = useCallback(() => {
    setState(getState());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push((OneSignal) => {
      refresh();
      if (listenerSetRef.current) return;
      try {
        OneSignal.Notifications?.addEventListener?.('permissionChange', (granted) => {
          // v16 fires with boolean
          refresh();
          if (granted === true) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          }
        });
        OneSignal.User?.PushSubscription?.addEventListener?.('change', () => refresh());
        listenerSetRef.current = true;
      } catch (_) {}
    });

    // Fallback polling for browsers/SDK versions where events don't fire reliably
    const id = setInterval(refresh, 1500);
    const stop = setTimeout(() => clearInterval(id), 60000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [user, refresh]);

  const handleEnable = async () => {
    setBusy(true);
    const OS = window.OneSignal;
    if (!OS) {
      alert('OneSignal SDK ещё не загружен. Попробуйте через 5 секунд.');
      setBusy(false);
      return;
    }
    let triggered = false;
    // Try methods in order of preference
    try {
      if (OS.Notifications?.requestPermission) {
        // Direct browser permission request (requires user gesture — we're inside click)
        await OS.Notifications.requestPermission();
        triggered = true;
      }
    } catch (e) { /* fall through */ }
    if (!triggered) {
      try {
        if (OS.Slidedown?.promptPush) {
          await OS.Slidedown.promptPush({ force: true });
          triggered = true;
        }
      } catch (_) {}
    }
    // Refresh state after a short delay
    setTimeout(() => {
      refresh();
      setBusy(false);
      const s = getState();
      if (s.granted) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else if (s.denied) {
        // Browser-level block — show actionable hint
        alert('Уведомления заблокированы в браузере. Откройте настройки сайта (замок слева от адреса) → Разрешения → Уведомления → Разрешить.');
      } else if (!triggered) {
        alert('Не удалось вызвать запрос разрешения. Обновите страницу и попробуйте снова.');
      }
    }, 500);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  };

  if (!user) return null;

  const { ready, granted, denied, optedIn } = state;
  const subscribed = granted || optedIn;

  if (showSuccess) {
    return (
      <div className="push-banner push-banner-success" data-testid="push-opt-in-banner">
        <div className="push-banner-icon push-banner-icon-success"><Check className="w-5 h-5" /></div>
        <div className="push-banner-text">
          <p className="push-banner-title">Уведомления включены</p>
          <p className="push-banner-sub">Будем сообщать о статусе заказов</p>
        </div>
        <button
          type="button"
          className="push-banner-close"
          onClick={() => setShowSuccess(false)}
          aria-label="Закрыть"
          data-testid="push-opt-in-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!ready) return null; // OneSignal not yet loaded — show nothing
  if (subscribed) return null;
  if (dismissed && !denied) return null;

  return (
    <div className="push-banner" data-testid="push-opt-in-banner">
      <div className="push-banner-icon"><Bell className="w-5 h-5" /></div>
      <div className="push-banner-text">
        <p className="push-banner-title">
          {denied ? 'Уведомления заблокированы' : 'Получайте уведомления о заказе'}
        </p>
        <p className="push-banner-sub">
          {denied
            ? 'Откройте замок слева от адреса → разрешите уведомления'
            : 'Когда водитель примет заказ — узнаете сразу'}
        </p>
      </div>
      {!denied && (
        <button
          type="button"
          className="push-banner-btn"
          onClick={handleEnable}
          disabled={busy}
          data-testid="push-opt-in-enable"
        >
          {busy ? '...' : 'Включить'}
        </button>
      )}
      <button
        type="button"
        className="push-banner-close"
        onClick={handleDismiss}
        aria-label="Закрыть"
        data-testid="push-opt-in-close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PushOptInBanner;
