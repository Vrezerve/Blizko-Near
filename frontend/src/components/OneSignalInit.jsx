import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

// Synchronizes OneSignal external_id with the authenticated user.id.
// Critical: login() must be called ONLY AFTER a REAL push subscription id exists.
// If sub.id starts with "local-", the SDK has not yet synced with the server, and
// calling login() at that point results in OneSignal API 400 errors.
const OneSignalInit = () => {
  const { user } = useAuth();
  const lastLoggedInRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push(async (OneSignal) => {
      const isRealId = (id) => typeof id === 'string' && id.length > 0 && !id.startsWith('local-');

      const doLogin = async () => {
        if (!user?.id) return;
        if (lastLoggedInRef.current === user.id) return;
        // Ensure subscription has a real (server-issued) id
        const sub = OneSignal?.User?.PushSubscription;
        if (!isRealId(sub?.id)) return;
        try {
          await OneSignal.login(user.id);
          lastLoggedInRef.current = user.id;
          try { await OneSignal.User?.addTag?.('user_id', user.id); } catch (_) {}
          if (user.role) {
            try { await OneSignal.User?.addTag?.('role', user.role); } catch (_) {}
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('OneSignal.login failed:', e?.message || e);
        }
      };

      const doLogout = async () => {
        try { await OneSignal.logout?.(); } catch (_) {}
        lastLoggedInRef.current = null;
      };

      if (user?.id) {
        // Try once now (subscription may already be active)
        await doLogin();
        // Subscribe to subsequent change events (fires when sub.id becomes real)
        try {
          OneSignal.User?.PushSubscription?.addEventListener?.('change', (e) => {
            const newId = e?.current?.id;
            if (isRealId(newId)) doLogin();
          });
        } catch (_) {}
      } else {
        await doLogout();
      }
    });
  }, [user]);

  return null;
};

export default OneSignalInit;
