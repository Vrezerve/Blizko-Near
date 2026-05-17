import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

// Uses the deferred queue from the inline snippet in public/index.html.
// Just synchronizes external_id with the authenticated user.
const OneSignalInit = () => {
  const { user } = useAuth();
  const lastUserIdRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        if (user?.id && user.id !== lastUserIdRef.current) {
          if (typeof OneSignal.login === 'function') {
            await OneSignal.login(user.id);
          }
          if (user.role && OneSignal.User?.addTag) {
            try { await OneSignal.User.addTag('role', user.role); } catch (_) {}
          }
          lastUserIdRef.current = user.id;
        } else if (!user && lastUserIdRef.current) {
          if (typeof OneSignal.logout === 'function') {
            await OneSignal.logout();
          }
          lastUserIdRef.current = null;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('OneSignal user sync failed:', e?.message || e);
      }
    });
  }, [user]);

  return null;
};

export default OneSignalInit;
