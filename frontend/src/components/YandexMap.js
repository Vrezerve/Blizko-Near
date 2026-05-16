import React, { useEffect, useRef, useState } from 'react';

const YandexMap = ({ 
  apiKey, 
  center = [55.75, 37.57], 
  zoom = 14,
  userLocation, 
  driverLocation, 
  driverInfo,
  onMapClick,
  showUserPin = true,
  markers = [],
  customPinUrl
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userPlacemarkRef = useRef(null);
  const driverPlacemarkRef = useRef(null);
  const pickPlacemarkRef = useRef(null);
  const clusterRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);

  // Load script
  useEffect(() => {
    const markReady = () => {
      if (!window.ymaps) return;
      if (typeof window.ymaps.ready === 'function') {
        window.ymaps.ready(() => setYmapsLoaded(true));
      } else if (typeof window.ymaps.Map === 'function') {
        setYmapsLoaded(true);
      }
    };
    if (window.ymaps) { markReady(); return; }
    if (document.querySelector('script[src*="api-maps.yandex.ru"]')) {
      const i = setInterval(() => { if (window.ymaps) { clearInterval(i); markReady(); } }, 200);
      return () => clearInterval(i);
    }
    const s = document.createElement('script');
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    s.async = true;
    s.onload = () => markReady();
    document.head.appendChild(s);
  }, [apiKey]);

  // Init map
  useEffect(() => {
    if (!ymapsLoaded || !mapRef.current || mapInstanceRef.current) return;
    const ymaps = window.ymaps;
    if (!ymaps || typeof ymaps.Map !== 'function') return;

    let map;
    try {
      map = new ymaps.Map(mapRef.current, {
        center: userLocation ? [userLocation.lat, userLocation.lng] : center,
        zoom,
        controls: []
      }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
    } catch (err) {
      console.error('YandexMap init failed:', err);
      return;
    }

    // Enable all behaviors for proper mobile experience
    map.behaviors.enable(['drag', 'multiTouch', 'dblClickZoom']);
    map.behaviors.disable('scrollZoom');

    // Click handler — place pin
    map.events.add('click', (e) => {
      const c = e.get('coords');
      if (onMapClick) {
        onMapClick({ lat: c[0], lng: c[1] });
        // Custom pin only
        const pinOpts = customPinUrl
          ? { iconLayout: 'default#image', iconImageHref: customPinUrl, iconImageSize: [32, 40], iconImageOffset: [-16, -40] }
          : { iconLayout: 'default#image', iconImageHref: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0zm0 19a5 5 0 110-10 5 5 0 010 10z" fill="#ef4444"/></svg>'), iconImageSize: [28, 36], iconImageOffset: [-14, -36] };
        if (pickPlacemarkRef.current) {
          pickPlacemarkRef.current.geometry.setCoordinates(c);
        } else {
          const pm = new ymaps.Placemark(c, {}, pinOpts);
          pm.options.set('draggable', false);
          map.geoObjects.add(pm);
          pickPlacemarkRef.current = pm;
        }
      }
    });

    mapInstanceRef.current = map;
    setMapReady(true);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.destroy(); mapInstanceRef.current = null; setMapReady(false); } };
  }, [ymapsLoaded]);

  // User location (green dot, no Yandex preset)
  useEffect(() => {
    if (!mapReady || !window.ymaps || !showUserPin || !userLocation) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;
    const coords = [userLocation.lat, userLocation.lng];
    const greenDot = {
      iconLayout: 'default#image',
      iconImageHref: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="#22c55e" stroke="#fff" stroke-width="3"/></svg>'),
      iconImageSize: [20, 20], iconImageOffset: [-10, -10]
    };
    if (userPlacemarkRef.current) {
      userPlacemarkRef.current.geometry.setCoordinates(coords);
    } else {
      const pm = new ymaps.Placemark(coords, {}, greenDot);
      pm.options.set('draggable', false);
      map.geoObjects.add(pm);
      userPlacemarkRef.current = pm;
      map.setCenter(coords, zoom);
    }
  }, [mapReady, userLocation, showUserPin]);

  // Driver location (blue car icon, no Yandex preset)
  useEffect(() => {
    if (!mapReady || !window.ymaps || !driverLocation) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;
    const coords = [driverLocation.lat, driverLocation.lng];
    const carIcon = {
      iconLayout: 'default#image',
      iconImageHref: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#3b82f6" stroke="#fff" stroke-width="2"/><path d="M10 20v-4l2-6h8l2 6v4" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="20" r="1.5" fill="#fff"/><circle cx="20" cy="20" r="1.5" fill="#fff"/></svg>'),
      iconImageSize: [32, 32], iconImageOffset: [-16, -16]
    };
    if (driverPlacemarkRef.current) {
      driverPlacemarkRef.current.geometry.setCoordinates(coords);
    } else {
      const pm = new ymaps.Placemark(coords, {}, carIcon);
      pm.options.set('draggable', false);
      map.geoObjects.add(pm);
      driverPlacemarkRef.current = pm;
    }
    if (userLocation) {
      try {
        map.setBounds([
          [Math.min(userLocation.lat, driverLocation.lat) - 0.003, Math.min(userLocation.lng, driverLocation.lng) - 0.003],
          [Math.max(userLocation.lat, driverLocation.lat) + 0.003, Math.max(userLocation.lng, driverLocation.lng) + 0.003]
        ], { checkZoomRange: true, zoomMargin: 60 });
      } catch (e) {}
    }
  }, [mapReady, driverLocation, driverInfo]);

  // Admin markers
  useEffect(() => {
    if (!mapReady || !window.ymaps) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;
    if (clusterRef.current) { map.geoObjects.remove(clusterRef.current); clusterRef.current = null; }
    if (markers.length === 0) return;
    const cl = new ymaps.Clusterer({ preset: 'islands#blueClusterIcons' });
    const pms = markers.map(m => {
      const carSvg = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="${m.busy ? '#eab308' : '#22c55e'}" stroke="#fff" stroke-width="2"/><path d="M8 18v-4l2-5h8l2 5v4" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="18" r="1.2" fill="#fff"/><circle cx="18" cy="18" r="1.2" fill="#fff"/></svg>`);
      return new ymaps.Placemark([m.lat, m.lng], {
        hintContent: m.name, balloonContent: `<b>${m.name}</b><br/>${m.info || ''}`
      }, { iconLayout: 'default#image', iconImageHref: carSvg, iconImageSize: [28, 28], iconImageOffset: [-14, -14] });
    });
    cl.add(pms);
    map.geoObjects.add(cl);
    clusterRef.current = cl;
    return () => { if (clusterRef.current && mapInstanceRef.current) { mapInstanceRef.current.geoObjects.remove(clusterRef.current); clusterRef.current = null; } };
  }, [mapReady, markers]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {!ymapsLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', zIndex: 20 }}>
          <p style={{ fontSize: 14, color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Загрузка карты...</p>
        </div>
      )}
    </div>
  );
};

export default YandexMap;
