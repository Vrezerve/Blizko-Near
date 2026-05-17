import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'push_banner_dismissed_at';
const DISMISS_HOURS = 24;

const getState = () => {
  try {
    const OS = window.OneSignal;
    const perm = OS?.Notifications?.permission;
    const sub = OS?.User?.PushSubscription;
    const optedIn = !!(sub?.optedIn || sub?.id);
    return { perm, optedIn };
  } catch (_) {
    return { perm: undefined, optedIn: false };
  }
};

const PushOptInBanner = () => {
  const { user } = useAuth();
  const [state, setState] = useState({ perm: undefined, optedIn: false });
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const listenerSetRef = useRef(false);

  // Track whether the user dismissed recently
  useEffect(() => {
    const t = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (t && Date.now() - t < DISMISS_HOURS * 3600 * 1000) {
      setDismissed(true);
    }
  }, []);

  const refresh = useCallback(() => {
    setState(getState());
  }, []);

  // Hook into OneSignal listeners once SDK is up
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push((OneSignal) => {
      if (listenerSetRef.current) {
        refresh();
        return;
      }
      try {
        OneSignal.Notifications?.addEventListener?.('permissionChange', (granted) => {
          refresh();
          if (granted === true || granted === 'granted') {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          }
        });
        OneSignal.User?.PushSubscription?.addEventListener?.('change', () => refresh());
        listenerSetRef.current = true;
      } catch (_) {}
      refresh();
    });

    // Fallback: poll briefly in case events don't fire in some browsers
    const id = setInterval(refresh, 2000);
    const stop = setTimeout(() => clearInterval(id), 30000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [user, refresh]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const OS = window.OneSignal;
      if (OS?.Slidedown?.promptPush) {
        await OS.Slidedown.promptPush({ force: true });
      } else if (OS?.Notifications?.requestPermission) {
        await OS.Notifications.requestPermission();
      }
    } catch (_) {} finally {
      setBusy(false);
      refresh();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  };

  if (!user) return null;

  const { perm, optedIn } = state;
  const subscribed = optedIn || perm === 'granted';

  // Success toast (briefly shown after granting)
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

  // If subscribed, no banner
  if (subscribed) return null;
  // If user dismissed recently AND permission is not denied, hide
  if (dismissed && perm !== 'denied') return null;

  const denied = perm === 'denied';

  return (
    <div className="push-banner" data-testid="push-opt-in-banner">
      <div className="push-banner-icon"><Bell className="w-5 h-5" /></div>
      <div className="push-banner-text">
        <p className="push-banner-title">
          {denied ? 'Уведомления заблокированы' : 'Получайте уведомления о заказе'}
        </p>
        <p className="push-banner-sub">
          {denied
            ? 'Разрешите уведомления в настройках браузера для ryadom22.ru'
            : 'Когда водитель примет заказ — вы сразу узнаете'}
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
