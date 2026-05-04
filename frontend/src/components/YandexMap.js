import React, { useEffect, useRef, useState, useCallback } from 'react';

const YandexMap = ({ 
  apiKey, 
  center = [55.75, 37.57], 
  zoom = 14,
  userLocation, 
  driverLocation, 
  driverInfo,
  onMapClick,
  showUserPin = true,
  etaMinutes,
  markers = [],
  customPinUrl,
  interactive = true
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userPlacemarkRef = useRef(null);
  const driverPlacemarkRef = useRef(null);
  const pickPlacemarkRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);
  const [mapActive, setMapActive] = useState(false);

  useEffect(() => {
    if (window.ymaps) { setYmapsLoaded(true); return; }
    if (document.querySelector('script[src*="api-maps.yandex.ru"]')) {
      const check = setInterval(() => { if (window.ymaps) { setYmapsLoaded(true); clearInterval(check); } }, 200);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      const w = () => { if (window.ymaps?.ready) { window.ymaps.ready(() => setYmapsLoaded(true)); } else { setTimeout(w, 100); } };
      w();
    };
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!ymapsLoaded || !mapRef.current || mapInstanceRef.current) return;
    const ymaps = window.ymaps;
    const isMobile = window.innerWidth < 768;

    const map = new ymaps.Map(mapRef.current, {
      center: userLocation ? [userLocation.lat, userLocation.lng] : center,
      zoom,
      controls: []
    }, { suppressMapOpenBlock: true });

    if (isMobile) {
      map.behaviors.disable(['drag', 'scrollZoom', 'dblClickZoom']);
      map.behaviors.enable('multiTouch');
    }

    map.events.add('click', (e) => {
      const coords = e.get('coords');
      if (onMapClick) {
        onMapClick({ lat: coords[0], lng: coords[1] });
        // Show pick placemark
        if (pickPlacemarkRef.current) {
          pickPlacemarkRef.current.geometry.setCoordinates(coords);
        } else {
          const opts = customPinUrl
            ? { iconLayout: 'default#image', iconImageHref: customPinUrl, iconImageSize: [32, 32], iconImageOffset: [-16, -32] }
            : { preset: 'islands#redDotIcon' };
          const pm = new ymaps.Placemark(coords, { hintContent: 'Точка подачи' }, opts);
          map.geoObjects.add(pm);
          pickPlacemarkRef.current = pm;
        }
      }
    });

    mapInstanceRef.current = map;
    setMapReady(true);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.destroy(); mapInstanceRef.current = null; setMapReady(false); } };
  }, [ymapsLoaded]);

  const activateMap = useCallback(() => {
    if (!mapInstanceRef.current) return;
    setMapActive(true);
    mapInstanceRef.current.behaviors.enable(['drag', 'scrollZoom', 'dblClickZoom']);
  }, []);

  const deactivateMap = useCallback(() => {
    if (!mapInstanceRef.current || window.innerWidth >= 768) return;
    setMapActive(false);
    mapInstanceRef.current.behaviors.disable(['drag', 'scrollZoom', 'dblClickZoom']);
  }, []);

  useEffect(() => {
    if (!mapReady || !window.ymaps || !showUserPin || !userLocation) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;
    if (userPlacemarkRef.current) {
      userPlacemarkRef.current.geometry.setCoordinates([userLocation.lat, userLocation.lng]);
    } else {
      const pm = new ymaps.Placemark([userLocation.lat, userLocation.lng], { hintContent: 'Вы здесь' }, { preset: 'islands#greenCircleDotIcon' });
      map.geoObjects.add(pm);
      userPlacemarkRef.current = pm;
      map.setCenter([userLocation.lat, userLocation.lng], zoom);
    }
  }, [mapReady, userLocation, showUserPin]);

  useEffect(() => {
    if (!mapReady || !window.ymaps || !driverLocation) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;
    const coords = [driverLocation.lat, driverLocation.lng];
    if (driverPlacemarkRef.current) {
      driverPlacemarkRef.current.geometry.setCoordinates(coords);
    } else {
      const pm = new ymaps.Placemark(coords, {
        hintContent: driverInfo?.driver_name || 'Водитель',
        balloonContent: `<strong>${driverInfo?.driver_name || 'Водитель'}</strong><br/>${driverInfo?.car_number || ''}`
      }, { preset: 'islands#blueAutoIcon' });
      map.geoObjects.add(pm);
      driverPlacemarkRef.current = pm;
    }
    if (userLocation) {
      try {
        map.setBounds([
          [Math.min(userLocation.lat, driverLocation.lat) - 0.005, Math.min(userLocation.lng, driverLocation.lng) - 0.005],
          [Math.max(userLocation.lat, driverLocation.lat) + 0.005, Math.max(userLocation.lng, driverLocation.lng) + 0.005]
        ], { checkZoomRange: true, zoomMargin: 50 });
      } catch (e) {}
    }
  }, [mapReady, driverLocation, driverInfo]);

  useEffect(() => {
    if (!mapReady || !window.ymaps || markers.length === 0) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;
    const clusterer = new ymaps.Clusterer({ preset: 'islands#blueClusterIcons' });
    const pms = markers.map(m => new ymaps.Placemark([m.lat, m.lng], {
      hintContent: m.name || '', balloonContent: `<strong>${m.name || ''}</strong><br/>${m.info || ''}`
    }, { preset: m.busy ? 'islands#yellowAutoIcon' : 'islands#greenAutoIcon' }));
    clusterer.add(pms);
    map.geoObjects.add(clusterer);
    return () => { map.geoObjects.remove(clusterer); };
  }, [mapReady, markers]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {isMobile && !mapActive && interactive && (
        <div onClick={activateMap} style={{ position: 'absolute', inset: 0, zIndex: 5, touchAction: 'pan-y' }} />
      )}
      {isMobile && mapActive && (
        <button onClick={deactivateMap}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 15, background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#334155', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
          Закрыть карту
        </button>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
      {!ymapsLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', zIndex: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #22c55e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: '#64748b' }}>Загрузка карты...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default YandexMap;
