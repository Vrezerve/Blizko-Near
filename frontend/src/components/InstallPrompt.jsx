import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Download, Share } from 'lucide-react';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const InstallPrompt = () => {
  const [settings, setSettings] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem('pwa_prompt_dismissed')) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/settings/public`)
      .then((res) => {
        if (res.data.pwa_enabled === false) return;
        setSettings(res.data);
        if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream) {
          setIosMode(true);
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!settings || dismissed) return null;
  if (!deferredPrompt && !iosMode) return null;

  const iconUrl = settings.pwa_icon_192_url || settings.app_icon_url;
  const iconAbs = iconUrl && iconUrl.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + iconUrl : iconUrl;

  const dismiss = () => {
    sessionStorage.setItem('pwa_prompt_dismissed', '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
    setDeferredPrompt(null);
    setDismissed(true);
  };

  return (
    <div className="install-banner" data-testid="install-banner">
      <button type="button" className="install-banner-close" onClick={dismiss} data-testid="install-banner-close" aria-label="Закрыть">
        <X className="w-4 h-4" />
      </button>
      <div className="install-banner-row">
        {iconAbs ? (
          <img src={iconAbs} alt="" className="install-banner-icon" />
        ) : (
          <div className="install-banner-icon install-banner-icon-ph">
            <Download className="w-5 h-5" />
          </div>
        )}
        <div className="install-banner-texts">
          <p className="install-banner-title">{settings.app_name || 'Приложение'}</p>
          <p className="install-banner-desc">
            {settings.pwa_prompt_text || 'Установите приложение на главный экран для быстрого доступа'}
          </p>
        </div>
      </div>
      {deferredPrompt ? (
        <button type="button" className="install-banner-btn" onClick={install} data-testid="install-banner-install">
          <Download className="w-4 h-4" />
          Установить
        </button>
      ) : (
        <p className="install-banner-ios">
          Нажмите <Share className="w-4 h-4 inline -mt-0.5" /> «Поделиться», затем «На экран “Домой”»
        </p>
      )}
    </div>
  );
};

export default InstallPrompt;
