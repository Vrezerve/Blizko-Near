import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

// Synchronizes OneSignal external_id with the authenticated user.id.
// Works for THREE platforms simultaneously:
//   1. Web (browser/PWA) — via window.OneSignal (v16 SDK)
//   2. Android native wrapper (Capacitor) — via window.Capacitor.Plugins.OneSignal
//   3. Android Cordova — via window.plugins.OneSignal
//   4. Custom Java JavascriptInterface — via window.AndroidBridge.setUserId(id)
const OneSignalInit = () => {
  const { user } = useAuth();
  const lastLoggedInRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isRealId = (id) => typeof id === 'string' && id.length > 0 && !id.startsWith('local-');

    // ---- 1. Web (deferred) ----
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      const doWebLogin = async () => {
        if (!user?.id) return;
        if (lastLoggedInRef.current === user.id) return;
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
          console.warn('OneSignal web login failed:', e?.message || e);
        }
      };
      const doWebLogout = async () => {
        try { await OneSignal.logout?.(); } catch (_) {}
        lastLoggedInRef.current = null;
      };
      if (user?.id) {
        await doWebLogin();
        try {
          OneSignal.User?.PushSubscription?.addEventListener?.('change', (e) => {
            if (isRealId(e?.current?.id)) doWebLogin();
          });
        } catch (_) {}
      } else {
        await doWebLogout();
      }
    });

    // ---- 2. Capacitor (modern Android/iOS wrapper) ----
    (async () => {
      try {
        const OneSignalCap = window.Capacitor?.Plugins?.OneSignal;
        if (!OneSignalCap) return;
        if (user?.id) {
          if (typeof OneSignalCap.login === 'function') {
            await OneSignalCap.login({ externalId: user.id });
          } else if (typeof OneSignalCap.setExternalUserId === 'function') {
            await OneSignalCap.setExternalUserId({ externalUserId: user.id });
          }
          if (typeof OneSignalCap.addTag === 'function') {
            try { await OneSignalCap.addTag({ key: 'user_id', value: user.id }); } catch (_) {}
            if (user.role) {
              try { await OneSignalCap.addTag({ key: 'role', value: user.role }); } catch (_) {}
            }
          }
        } else if (typeof OneSignalCap.logout === 'function') {
          await OneSignalCap.logout();
        }
      } catch (e) {
        console.warn('Capacitor OneSignal sync failed:', e?.message || e);
      }
    })();

    // ---- 3. Cordova wrapper ----
    try {
      const cordovaOS = window.plugins?.OneSignal;
      if (cordovaOS && user?.id) {
        if (typeof cordovaOS.login === 'function') {
          cordovaOS.login(user.id);
        } else if (typeof cordovaOS.setExternalUserId === 'function') {
          cordovaOS.setExternalUserId(user.id);
        }
        if (typeof cordovaOS.sendTag === 'function') {
          cordovaOS.sendTag('user_id', user.id);
          if (user.role) cordovaOS.sendTag('role', user.role);
        }
      } else if (cordovaOS && !user && typeof cordovaOS.logout === 'function') {
        cordovaOS.logout();
      }
    } catch (e) {
      console.warn('Cordova OneSignal sync failed:', e?.message || e);
    }

    // ---- 4. Custom JavascriptInterface bridge ----
    try {
      const bridge = window.AndroidBridge;
      if (bridge && user?.id && typeof bridge.setUserId === 'function') {
        bridge.setUserId(user.id);
        if (user.role && typeof bridge.setUserRole === 'function') {
          bridge.setUserRole(user.role);
        }
      } else if (bridge && !user && typeof bridge.clearUser === 'function') {
        bridge.clearUser();
      }
    } catch (_) {}
  }, [user]);

  return null;
};

export default OneSignalInit;
