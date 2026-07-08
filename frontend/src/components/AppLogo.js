import React, { useState, useEffect } from 'react';
import { Car } from 'lucide-react';
import { fetchPublicSettings } from '../lib/settingsCache';

let cachedBranding = null;

export const useAppBranding = () => {
  const [branding, setBranding] = useState(cachedBranding || { app_name: 'Рядом', app_icon_url: '' });

  useEffect(() => {
    if (cachedBranding) return;
    fetchPublicSettings().then((s) => {
      const data = { app_name: s.app_name || 'Рядом', app_icon_url: s.app_icon_url || '' };
      cachedBranding = data;
      setBranding(data);
    }).catch(() => {});
  }, []);

  return branding;
};

export const AppLogo = ({ size = 'md', className = '' }) => {
  const { app_name, app_icon_url } = useAppBranding();
  const [imgError, setImgError] = useState(false);

  const sizes = {
    sm: { box: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-lg' },
    md: { box: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-xl' },
    lg: { box: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-2xl' },
  };

  const s = sizes[size] || sizes.md;

  const iconSrc = app_icon_url
    ? app_icon_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${app_icon_url}` : app_icon_url
    : '';

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="app-logo">
      <div className={`${s.box} bg-green-600 rounded-xl flex items-center justify-center overflow-hidden`}>
        {iconSrc && !imgError ? (
          <img src={iconSrc} alt="" className={`${s.box} object-cover`} onError={() => setImgError(true)} />
        ) : (
          <Car className={`${s.icon} text-white`} />
        )}
      </div>
      <span className={`${s.text} font-bold text-slate-900 tracking-tight`}>{app_name}</span>
    </div>
  );
};
