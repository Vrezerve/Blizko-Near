import React, { useState } from 'react';
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

  const serverCheck = async () => {
    try {
      const res = await api('GET', '/notifications/push-status-self');
      return res?.status || null;
    } catch (_) {
      return null;
    }
  };

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const status = await serverCheck();
      if (status === 'subscribed') {
        alert('✓ Всё в порядке!\n\nВы подписаны на push-уведомления — сообщения о заказах будут приходить на это устройство.');
        return;
      }
      if (status === 'no_onesignal') {
        alert('Push-уведомления не настроены администратором сервиса.');
        return;
      }
      // Not subscribed — try to subscribe
      if (isDenied()) {
        alert('⚠ Уведомления заблокированы в браузере.\n\nЧтобы разблокировать:\n' + unblockSteps());
        return;
      }
      const hasSdk = await enableWebPush(user?.id);
      if (!hasSdk) {
        alert('Не удалось запустить подписку.\n\nЕсли вы используете приложение — разрешите уведомления для него в настройках устройства (Настройки → Приложения → Уведомления).');
        return;
      }
      // Give OneSignal a moment to register the subscription, then re-check
      await new Promise((r) => setTimeout(r, 3500));
      const after = await serverCheck();
      if (after === 'subscribed') {
        alert('✓ Готово!\n\nУведомления включены — сообщения о заказах будут приходить на это устройство.');
      } else if (isDenied()) {
        alert('⚠ Вы отклонили запрос на уведомления.\n\nЧтобы включить:\n' + unblockSteps());
      } else if (grantedLocally()) {
        alert('✓ Разрешение получено!\n\nПодписка активируется в течение минуты — уведомления начнут приходить.');
      } else {
        alert('Не удалось включить уведомления. Попробуйте ещё раз или перезагрузите страницу.');
      }
    } finally {
      setBusy(false);
    }
  };

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
      {busy ? 'Проверяем подписку…' : 'Проверить уведомления'}
    </button>
  );
};
