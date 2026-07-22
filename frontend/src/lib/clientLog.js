// Browser-side error & performance logging → backend system logs (category "browser")
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const sentAt = new Map();

const post = (payload) => {
  try {
    const key = (payload.message || '').slice(0, 100);
    const now = Date.now();
    if (sentAt.get(key) && now - sentAt.get(key) < 30000) return;
    sentAt.set(key, now);
    axios.post(`${API}/logs/client`, {
      ...payload,
      url: window.location.pathname,
      ua: navigator.userAgent.slice(0, 200),
    }, { timeout: 5000 }).catch(() => {});
  } catch (_) {}
};

let inited = false;
export const initClientLogging = () => {
  if (inited || typeof window === 'undefined') return;
  inited = true;

  window.addEventListener('error', (e) => {
    const msg = String(e.message || e.error?.message || 'Неизвестная ошибка').slice(0, 500);
    if (msg.includes('ResizeObserver')) return;
    post({ level: 'error', message: msg, source: `${e.filename || ''}:${e.lineno || ''}` });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason?.message || String(e.reason || 'unknown');
    if (String(reason).includes('Network Error') || String(reason).includes('timeout')) {
      post({ level: 'warning', message: `Сетевая ошибка: ${String(reason).slice(0, 300)}` });
      return;
    }
    post({ level: 'error', message: `Promise: ${String(reason).slice(0, 400)}` });
  });

  const reportLoad = () => {
    setTimeout(() => {
      try {
        const nav = performance.getEntriesByType('navigation')[0];
        const ms = nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0;
        if (ms > 5000) {
          post({ level: 'warning', message: `Долгая загрузка страницы: ${(ms / 1000).toFixed(1)} сек`, duration_ms: ms });
        }
      } catch (_) {}
    }, 500);
  };
  if (document.readyState === 'complete') reportLoad();
  else window.addEventListener('load', reportLoad);
};
