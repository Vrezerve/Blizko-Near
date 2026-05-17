import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Initializes OneSignal once with the app id from /api/settings/public,
// then logs in / out the subscriber as the auth state changes.
const OneSignalInit = () => {
  const { user } = useAuth();
  const initedRef = useRef(false);
  const lastUserIdRef = useRef(null);

  useEffect(() => {
    if (initedRef.current) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/settings/public`);
        const appId = res.data?.onesignal_app_id;
        if (!appId || !/^[a-f0-9-]{36}$/i.test(appId)) {
          // No valid OneSignal app id configured — skip silently
          return;
        }
        if (cancelled) return;
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          notifyButton: { enable: false },
          autoResubscribe: true,
        });
        initedRef.current = true;
      } catch (e) {
        // Network or SDK errors must not break the app
        // eslint-disable-next-line no-console
        console.warn('OneSignal init skipped:', e?.message || e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Link/unlink user as auth state changes
  useEffect(() => {
    if (!initedRef.current) return;
    (async () => {
      try {
        if (user?.id && user.id !== lastUserIdRef.current) {
          await OneSignal.login(user.id);
          if (user.role) {
            try { await OneSignal.User.addTag('role', user.role); } catch (_) {}
          }
          lastUserIdRef.current = user.id;
        } else if (!user && lastUserIdRef.current) {
          await OneSignal.logout();
          lastUserIdRef.current = null;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('OneSignal user sync failed:', e?.message || e);
      }
    })();
  }, [user]);

  return null;
};

export default OneSignalInit;
