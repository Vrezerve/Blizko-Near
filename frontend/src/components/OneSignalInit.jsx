import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Synchronizes OneSignal external_id with the authenticated user.id.
// Critical: login() must be called ONLY AFTER a push subscription exists,
// otherwise OneSignal stores an alias with no subscription and the API
// later returns "invalid_aliases".
const OneSignalInit = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        const tryLogin = async () => {
          if (!user?.id) return;
          const sub = OneSignal?.User?.PushSubscription;
          const optedIn = !!(sub?.optedIn || sub?.id);
          const granted = OneSignal?.Notifications?.permission === true || OneSignal?.Notifications?.permissionNative === 'granted';
          if (!optedIn && !granted) return; // skip — no subscription yet
          try {
            await OneSignal.login(user.id);
            try { await OneSignal.User?.addTag?.('user_id', user.id); } catch (_) {}
            if (user.role && OneSignal.User?.addTag) {
              try { await OneSignal.User.addTag('role', user.role); } catch (_) {}
            }
          } catch (e) {
            console.warn('OneSignal.login failed:', e?.message || e);
          }
        };

        const tryLogout = async () => {
          try { await OneSignal.logout?.(); } catch (_) {}
        };

        if (user?.id) {
          await tryLogin();
          // React to subscription becoming active later (after user clicks "Allow")
          try {
            OneSignal.User?.PushSubscription?.addEventListener?.('change', (e) => {
              if (e?.current?.optedIn || e?.current?.id) tryLogin();
            });
          } catch (_) {}
        } else {
          await tryLogout();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('OneSignal sync failed:', e?.message || e);
      }
    });
  }, [user]);

  return null;
};

export default OneSignalInit;
