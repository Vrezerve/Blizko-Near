import React, { useEffect, useState } from 'react';

const Row = ({ label, value, ok, warn }) => (
  <div style={{
    display: 'flex',
    gap: 12,
    padding: '10px 12px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 13
  }}>
    <div style={{ flex: '0 0 220px', fontWeight: 500, color: '#475569' }}>{label}</div>
    <div style={{
      flex: 1,
      fontFamily: 'monospace',
      color: ok ? '#16a34a' : warn ? '#d97706' : value === '—' ? '#94a3b8' : '#0f172a',
      wordBreak: 'break-all'
    }}>{String(value)}</div>
  </div>
);

const PushDebug = () => {
  const [state, setState] = useState({});
  const [logs, setLogs] = useState([]);

  const log = (msg, obj) => {
    setLogs((prev) => [...prev, { t: new Date().toLocaleTimeString(), msg, obj }]);
  };

  const refresh = () => {
    try {
      const OS = window.OneSignal;
      if (!OS) {
        setState({ ready: false });
        return;
      }
      const sub = OS.User?.PushSubscription;
      setState({
        ready: true,
        sdkVersion: OS.__VERSION__ || OS.VERSION || 'unknown',
        permissionBool: OS.Notifications?.permission,
        permissionNative: OS.Notifications?.permissionNative,
        userOnesignalId: OS.User?.onesignalId || OS.User?._currentUser?.onesignalId,
        userExternalId: OS.User?.externalId || OS.User?._currentUser?.externalId,
        subId: sub?.id,
        subOptedIn: sub?.optedIn,
        subToken: sub?.token,
        secureOrigin: window.isSecureContext,
        protocol: window.location.protocol,
        host: window.location.host,
        navPermission: typeof Notification !== 'undefined' ? Notification.permission : 'no Notification API',
        serviceWorker: 'serviceWorker' in navigator ? 'supported' : 'NOT supported',
        pushManager: 'PushManager' in window ? 'supported' : 'NOT supported',
        userAgent: navigator.userAgent.substring(0, 100),
      });
    } catch (e) {
      log('refresh error', e?.message);
    }
  };

  useEffect(() => {
    refresh();
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        log(`Service Workers registered: ${regs.length}`, regs.map(r => ({ scope: r.scope, active: !!r.active, scriptURL: r.active?.scriptURL })));
      });
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push((OneSignal) => {
      log('SDK loaded');
      refresh();
      try {
        OneSignal.Notifications?.addEventListener?.('permissionChange', (g) => { log('permissionChange', g); refresh(); });
        OneSignal.User?.PushSubscription?.addEventListener?.('change', (e) => { log('PushSubscription change', { previous: e?.previous, current: e?.current }); refresh(); });
      } catch (err) { log('addEventListener failed', err?.message); }
    });
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const doRequestPermission = async () => {
    log('clicked requestPermission');
    try {
      const r = await window.OneSignal?.Notifications?.requestPermission();
      log('requestPermission resolved', r);
    } catch (e) { log('requestPermission error', e?.message); }
    refresh();
  };

  const doOptIn = async () => {
    log('clicked optIn');
    try {
      const r = await window.OneSignal?.User?.PushSubscription?.optIn();
      log('optIn resolved', r);
    } catch (e) { log('optIn error', e?.message); }
    refresh();
  };

  const swCheck = () => {
    fetch('/OneSignalSDKWorker.js', { cache: 'no-store' }).then(async r => {
      log(`worker fetch status=${r.status} content-type=${r.headers.get('content-type')}`);
      const t = await r.text();
      log(`worker body (first 200 chars)`, t.substring(0, 200));
    }).catch(e => log('worker fetch error', e?.message));
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'Inter, sans-serif', background: 'white', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Push Debug Console</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        Use this page to diagnose WHY browser is not subscribing to push.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={refresh} style={{ padding: '8px 14px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Refresh state</button>
        <button onClick={doRequestPermission} style={{ padding: '8px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>1. requestPermission()</button>
        <button onClick={doOptIn} style={{ padding: '8px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>2. optIn()</button>
        <button onClick={swCheck} style={{ padding: '8px 14px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Check SW file</button>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 8px' }}>Environment</h3>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <Row label="Protocol" value={state.protocol} ok={state.protocol === 'https:'} warn={state.protocol !== 'https:'} />
        <Row label="Host" value={state.host} />
        <Row label="Secure context" value={String(state.secureOrigin)} ok={state.secureOrigin} warn={!state.secureOrigin} />
        <Row label="navigator.serviceWorker" value={state.serviceWorker} ok={state.serviceWorker === 'supported'} warn={state.serviceWorker !== 'supported'} />
        <Row label="window.PushManager" value={state.pushManager} ok={state.pushManager === 'supported'} warn={state.pushManager !== 'supported'} />
        <Row label="Notification.permission (native)" value={state.navPermission} ok={state.navPermission === 'granted'} warn={state.navPermission === 'denied'} />
        <Row label="User agent" value={state.userAgent || '—'} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 8px' }}>OneSignal SDK</h3>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <Row label="SDK loaded" value={String(state.ready)} ok={state.ready} warn={!state.ready} />
        <Row label="SDK version" value={state.sdkVersion || '—'} />
        <Row label="OneSignal.Notifications.permission" value={String(state.permissionBool)} ok={state.permissionBool === true} />
        <Row label="OneSignal.Notifications.permissionNative" value={state.permissionNative || '—'} />
        <Row label="OneSignal.User.onesignalId" value={state.userOnesignalId || '—'} ok={!!state.userOnesignalId && !String(state.userOnesignalId).startsWith('local-')} warn={String(state.userOnesignalId || '').startsWith('local-')} />
        <Row label="OneSignal.User.externalId" value={state.userExternalId || '—'} />
        <Row label="PushSubscription.id" value={state.subId || '—'} ok={!!state.subId && !String(state.subId).startsWith('local-')} warn={String(state.subId || '').startsWith('local-')} />
        <Row label="PushSubscription.optedIn" value={String(state.subOptedIn)} ok={state.subOptedIn === true} />
        <Row label="PushSubscription.token" value={state.subToken ? state.subToken.substring(0, 60) + '...' : '(empty)'} ok={!!state.subToken} warn={!state.subToken} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 8px' }}>Event Log</h3>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc', maxHeight: 300, overflow: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
        {logs.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>No events yet — click buttons above.</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>[{l.t}]</span> <span style={{ color: '#0f172a' }}>{l.msg}</span>
              {l.obj !== undefined && <pre style={{ margin: '2px 0 0 24px', color: '#475569', fontSize: 11 }}>{JSON.stringify(l.obj, null, 2)}</pre>}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 20, padding: 12, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#854d0e' }}>
        <b>Чтобы найти причину:</b>
        <ol style={{ margin: '8px 0 0 20px' }}>
          <li>Если «PushManager» = <code>NOT supported</code> — браузер не поддерживает push (вы открыли через Android WebView, не TWA).</li>
          <li>Если worker fetch вернул 404 или text/html — нет <code>OneSignalSDKWorker.js</code> на сервере.</li>
          <li>Если OneSignal.User.onesignalId начинается с <code>local-</code> — SDK не смог достучаться до OneSignal серверов (CORS / блокировка / DNS).</li>
          <li>Если permission = granted, но token пуст после optIn() — service worker не активен.</li>
        </ol>
      </div>
    </div>
  );
};

export default PushDebug;
