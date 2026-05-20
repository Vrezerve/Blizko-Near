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
      // Auto opt-in if browser already granted permission but subscription not active
      try {
        const granted = OneSignal.Notifications?.permission === true || OneSignal.Notifications?.permissionNative === 'granted';
        const sub = OneSignal.User?.PushSubscription;
        if (granted && !sub?.id && sub?.optIn) {
          sub.optIn().then(() => refresh()).catch(() => {});
        }
      } catch (_) {}
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
    // v16 split flow: 1) request browser permission, 2) opt user into push subscription
    try {
      if (OS.Notifications?.requestPermission) {
        await OS.Notifications.requestPermission();
      }
    } catch (e) { /* ignore */ }
    try {
      // CRITICAL: in v16, optIn() actually creates the push subscription (VAPID token)
      if (OS.User?.PushSubscription?.optIn) {
        await OS.User.PushSubscription.optIn();
      } else if (OS.Slidedown?.promptPush) {
        await OS.Slidedown.promptPush({ force: true });
      }
    } catch (_) {}
    // Refresh state after a short delay
    setTimeout(() => {
      refresh();
      setBusy(false);
      const s = getState();
      if (s.granted) {
        // Permission granted — close the banner regardless of optIn state.
        // optIn completes asynchronously; once subscription is ready, OneSignalInit will login the user.
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else if (s.denied) {
        alert('Уведомления заблокированы в браузере. Откройте настройки сайта (замок слева от адреса) → Разрешения → Уведомления → Разрешить.');
      }
    }, 800);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  };

  if (!user) return null;
  // Hide the banner for admin role — they have a dedicated push tester in admin panel
  if (user.role === 'admin') return null;

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

  if (!ready) return null;
  // Once browser permission granted — close the banner.
  // optIn() in v16 is needed to materialize the VAPID subscription, but it usually
  // succeeds within a few seconds. We auto-trigger it from handleEnable, and the
  // PushSubscription change event will fire when sub.id becomes real.
  if (granted) return null;
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
            ? 'Нажмите чтобы увидеть как разблокировать'
            : 'Когда водитель примет заказ — узнаете сразу'}
        </p>
      </div>
      {denied ? (
        <button
          type="button"
          className="push-banner-btn"
          onClick={() => {
            const ua = navigator.userAgent.toLowerCase();
            let steps;
            if (ua.includes('safari') && !ua.includes('chrome')) {
              steps = 'Safari → Настройки → Сайты → Уведомления → найдите ryadom22.ru → выберите «Разрешить»';
            } else if (ua.includes('firefox')) {
              steps = 'Firefox → нажмите на замок слева от адреса → Очистить разрешения → перезагрузите страницу';
            } else if (ua.includes('android')) {
              steps = 'Android Chrome → ⋮ (меню) → Настройки → Настройки сайтов → Уведомления → найдите ryadom22.ru → Разрешить';
            } else {
              steps = 'Chrome → нажмите на 🔒 слева от адреса → Настройки сайта → Уведомления → Разрешить → обновите страницу';
            }
            alert('Чтобы разблокировать:\n\n' + steps);
          }}
          data-testid="push-opt-in-howto"
        >
          Как включить
        </button>
      ) : (
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
