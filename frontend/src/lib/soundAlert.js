// In-app sound alerts via Web Audio API (no push, no files, works while the app is open)
let ctx = null;

const ensureCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
};

// Browsers block audio until the first user gesture — unlock on first tap/click
export const initSoundUnlock = () => {
  const unlock = () => {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock);
  window.addEventListener('touchstart', unlock);
};

const tone = (c, freq, start, dur, gainVal = 0.3, type = 'sine') => {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainVal, c.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
};

// Loud attention chime for drivers: ascending triple, played twice + vibration
export const playNewOrderSound = () => {
  try {
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const seq = (offset) => {
      tone(c, 880, offset, 0.18);
      tone(c, 1108.73, offset + 0.18, 0.18);
      tone(c, 1318.51, offset + 0.36, 0.35);
    };
    seq(0);
    seq(0.95);
  } catch (_) {}
  try { navigator.vibrate?.([250, 100, 250, 100, 500]); } catch (_) {}
};

// Pleasant two-tone "success" for customers (driver found / trip completed)
export const playSuccessSound = () => {
  try {
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    tone(c, 659.25, 0, 0.18);
    tone(c, 987.77, 0.18, 0.4);
  } catch (_) {}
  try { navigator.vibrate?.([200, 80, 200]); } catch (_) {}
};

// System notification via the browser itself (only if permission already granted,
// and only when the tab is in the background — in-app sound covers the visible case)
export const showLocalNotification = (title, body) => {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    const show = () => {
      try {
        const n = new Notification(title, { body, icon: '/favicon.ico' });
        setTimeout(() => { try { n.close(); } catch (_) {} }, 10000);
      } catch (_) {
        // Android Chrome requires SW-based notifications
        navigator.serviceWorker?.ready?.then((reg) => {
          reg.showNotification?.(title, { body, icon: '/favicon.ico' });
        }).catch(() => {});
      }
    };
    show();
  } catch (_) {}
};
