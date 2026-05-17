import React, { useEffect, useState, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'push_banner_dismissed_at';
const DISMISS_HOURS = 24; // re-show after a day

const PushOptInBanner = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!user || checkedRef.current) return;
    if (typeof window === 'undefined') return;

    const dismissedAt = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_HOURS * 3600 * 1000) {
      return; // recently dismissed
    }

    const check = (OneSignal) => {
      try {
        // OneSignal v16 API: Notifications.permission ('granted' | 'denied' | 'default')
        const perm = OneSignal?.Notifications?.permission;
        // Show banner only for users who haven't granted yet
        if (perm !== 'granted' && perm !== 'denied') {
          setShow(true);
        } else if (perm === 'denied') {
          // Browser blocked — show with different copy (instructions)
          setShow(true);
        }
        checkedRef.current = true;
      } catch (_) {}
    };

    // Try once now, and once after a small delay (SDK may still be loading)
    if (window.OneSignal && window.OneSignal.Notifications) {
      check(window.OneSignal);
    } else {
      const t1 = setTimeout(() => {
        if (window.OneSignal) check(window.OneSignal);
      }, 3000);
      return () => clearTimeout(t1);
    }
  }, [user]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const OS = window.OneSignal;
      // Try slidedown prompt first, then native
      if (OS?.Slidedown?.promptPush) {
        await OS.Slidedown.promptPush({ force: true });
      } else if (OS?.Notifications?.requestPermission) {
        await OS.Notifications.requestPermission();
      }
    } catch (_) {} finally {
      setBusy(false);
      // After a brief moment, check state and hide if granted
      setTimeout(() => {
        if (window.OneSignal?.Notifications?.permission === 'granted') {
          setShow(false);
        }
      }, 1500);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  };

  if (!user || !show) return null;

  const denied = window.OneSignal?.Notifications?.permission === 'denied';

  return (
    <div className="push-banner" data-testid="push-opt-in-banner">
      <div className="push-banner-icon"><Bell className="w-5 h-5" /></div>
      <div className="push-banner-text">
        <p className="push-banner-title">
          {denied ? 'Уведомления заблокированы' : 'Получайте уведомления о заказе'}
        </p>
        <p className="push-banner-sub">
          {denied
            ? 'Разрешите уведомления в настройках браузера → сайт ryadom22.ru'
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
