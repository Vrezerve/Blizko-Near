import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const isDenied = () => {
  try {
    if (window.OneSignal?.Notifications?.permissionNative === 'denied') return true;
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return true;
  } catch (_) {}
  return false;
};

const unblockSteps = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('safari') && !ua.includes('chrome')) {
    return 'Safari → Настройки → Сайты → Уведомления → найдите этот сайт → «Разрешить»';
  }
  if (ua.includes('firefox')) {
    return 'Firefox → нажмите на замок слева от адреса → Очистить разрешения → перезагрузите страницу';
  }
  if (ua.includes('android')) {
    return 'Chrome → ⋮ (меню) → Настройки → Настройки сайтов → Уведомления → найдите этот сайт → Разрешить';
  }
  return 'Chrome → нажмите на 🔒 слева от адреса → Настройки сайта → Уведомления → Разрешить → обновите страницу';
};

const enableWebPush = async (userId) => {
  const OS = window.OneSignal;
  if (!OS) return false;
  try { await OS.Notifications?.requestPermission?.(); } catch (_) {}
  try {
    if (OS.User?.PushSubscription?.optIn) {
      await OS.User.PushSubscription.optIn();
    } else if (OS.Slidedown?.promptPush) {
      await OS.Slidedown.promptPush({ force: true });
    }
  } catch (_) {}
  // Link the subscription to our user id right away
  try {
    if (userId) {
      await OS.login?.(userId);
      await OS.User?.addTag?.('user_id', userId);
    }
  } catch (_) {}
  return true;
};

const grantedLocally = () => {
  try {
    return window.OneSignal?.Notifications?.permission === true ||
      window.OneSignal?.Notifications?.permissionNative === 'granted' ||
      (typeof Notification !== 'undefined' && Notification.permission === 'granted');
  } catch (_) {
    return false;
  }
};

export const PushCheckMenuItem = ({ testId = 'push-check-btn' }) => {
  const { api, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // null | subscribed | not_registered | blocked | pending | no_onesignal | error

  const serverCheck = useCallback(async () => {
    try {
      const res = await api('GET', '/notifications/push-status-self');
      return res?.status || null;
    } catch (_) {
      return null;
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    serverCheck().then((s) => { if (active) setStatus(s); });
    return () => { active = false; };
  }, [serverCheck]);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const current = await serverCheck();
      setStatus(current);
      if (current === 'subscribed') {
        alert('✓ Всё в порядке!\n\nВы подписаны на уведомления — сообщения о заказах будут приходить на это устройство.');
        return;
      }
      if (current === 'no_onesignal') {
        alert('Push-уведомления не настроены администратором сервиса.');
        return;
      }
      // Not subscribed — inform, then try to subscribe
      if (isDenied()) {
        alert('✗ Вы не подключены к оповещениям.\n\nУведомления заблокированы в браузере. Чтобы разблокировать:\n' + unblockSteps());
        return;
      }
      const hasSdk = await enableWebPush(user?.id);
      if (!hasSdk) {
        alert('✗ Вы не подключены к оповещениям.\n\nЕсли вы используете приложение — разрешите уведомления для него в настройках устройства (Настройки → Приложения → Уведомления).');
        return;
      }
      // Give OneSignal a moment to register the subscription, then re-check
      await new Promise((r) => setTimeout(r, 3500));
      const after = await serverCheck();
      setStatus(after);
      if (after === 'subscribed') {
        alert('✓ Готово!\n\nУведомления включены — сообщения о заказах будут приходить на это устройство.');
      } else if (isDenied()) {
        alert('✗ Вы не подключены к оповещениям.\n\nВы отклонили запрос на уведомления. Чтобы включить:\n' + unblockSteps());
      } else if (grantedLocally()) {
        setStatus('subscribed');
        alert('✓ Разрешение получено!\n\nПодписка активируется в течение минуты — уведомления начнут приходить.');
      } else {
        alert('✗ Вы не подключены к оповещениям.\n\nНе удалось включить уведомления. Попробуйте ещё раз или перезагрузите страницу.');
      }
    } finally {
      setBusy(false);
    }
  };

  const subscribed = status === 'subscribed';
  const unknown = status === null || status === 'no_onesignal' || status === 'error';

  return (
    <button
      data-testid={testId}
      onClick={handleClick}
      disabled={busy}
      className="w-full flex items-center gap-3 p-3 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      ) : (
        <Bell className="w-5 h-5 text-slate-400" />
      )}
      <span className="flex-1 text-left">{busy ? 'Проверяем подписку…' : 'Уведомления'}</span>
      {!busy && (
        <span
          data-testid={`${testId}-indicator`}
          title={subscribed ? 'Вы подписаны на оповещения' : unknown ? 'Статус неизвестен' : 'Вы не подключены к оповещениям'}
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            subscribed ? 'bg-green-500' : unknown ? 'bg-slate-300' : 'bg-red-500'
          }`}
        />
      )}
    </button>
  );
};
