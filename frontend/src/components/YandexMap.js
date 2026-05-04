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
  markers = []
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userPlacemarkRef = useRef(null);
  const driverPlacemarkRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);
  const [mapActive, setMapActive] = useState(false);

  // Load Yandex Maps script
  useEffect(() => {
    if (window.ymaps) {
      setYmapsLoaded(true);
      return;
    }
    if (document.querySelector('script[src*="api-maps.yandex.ru"]')) {
      const check = setInterval(() => {
        if (window.ymaps) { setYmapsLoaded(true); clearInterval(check); }
      }, 200);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      const waitReady = () => {
        if (window.ymaps && window.ymaps.ready) {
          window.ymaps.ready(() => setYmapsLoaded(true));
        } else {
          setTimeout(waitReady, 100);
        }
      };
      waitReady();
    };
    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize map
  useEffect(() => {
    if (!ymapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    const ymaps = window.ymaps;
    
    const map = new ymaps.Map(mapRef.current, {
      center: userLocation ? [userLocation.lat, userLocation.lng] : center,
      zoom: zoom,
      controls: ['zoomControl']
    }, {
      suppressMapOpenBlock: true
    });

    // Disable all behaviors initially on mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      map.behaviors.disable(['drag', 'scrollZoom', 'dblClickZoom']);
      map.behaviors.enable('multiTouch');
    }

    map.events.add('click', (e) => {
      const coords = e.get('coords');
      if (onMapClick) onMapClick({ lat: coords[0], lng: coords[1] });
    });

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, [ymapsLoaded]);

  // Handle map activation on mobile (toggle between scroll page and interact map)
  const activateMap = useCallback(() => {
    if (!mapInstanceRef.current) return;
    setMapActive(true);
    mapInstanceRef.current.behaviors.enable(['drag', 'scrollZoom', 'dblClickZoom']);
  }, []);

  const deactivateMap = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setMapActive(false);
      mapInstanceRef.current.behaviors.disable(['drag', 'scrollZoom', 'dblClickZoom']);
    }
  }, []);

  // Update user placemark
  useEffect(() => {
    if (!mapReady || !window.ymaps || !showUserPin || !userLocation) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;

    if (userPlacemarkRef.current) {
      userPlacemarkRef.current.geometry.setCoordinates([userLocation.lat, userLocation.lng]);
    } else {
      const placemark = new ymaps.Placemark([userLocation.lat, userLocation.lng], {
        hintContent: 'Вы здесь'
      }, {
        preset: 'islands#greenCircleDotIcon',
        iconColor: '#22c55e'
      });
      map.geoObjects.add(placemark);
      userPlacemarkRef.current = placemark;
      // Center map on user
      map.setCenter([userLocation.lat, userLocation.lng], zoom);
    }
  }, [mapReady, userLocation, showUserPin]);

  // Update driver placemark
  useEffect(() => {
    if (!mapReady || !window.ymaps || !driverLocation) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;

    const coords = [driverLocation.lat, driverLocation.lng];

    if (driverPlacemarkRef.current) {
      driverPlacemarkRef.current.geometry.setCoordinates(coords);
    } else {
      const placemark = new ymaps.Placemark(coords, {
        hintContent: driverInfo?.driver_name || 'Водитель',
        balloonContent: `<strong>${driverInfo?.driver_name || 'Водитель'}</strong><br/>${driverInfo?.car_number || ''}`
      }, {
        preset: 'islands#blueAutoIcon'
      });
      map.geoObjects.add(placemark);
      driverPlacemarkRef.current = placemark;
    }

    // Pan to show both user and driver
    if (userLocation) {
      try {
        map.setBounds([
          [Math.min(userLocation.lat, driverLocation.lat) - 0.005, Math.min(userLocation.lng, driverLocation.lng) - 0.005],
          [Math.max(userLocation.lat, driverLocation.lat) + 0.005, Math.max(userLocation.lng, driverLocation.lng) + 0.005]
        ], { checkZoomRange: true, zoomMargin: 50 });
      } catch (e) {}
    }
  }, [mapReady, driverLocation, driverInfo]);

  // Admin markers (multiple drivers)
  useEffect(() => {
    if (!mapReady || !window.ymaps || markers.length === 0) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;

    const clusterer = new ymaps.Clusterer({ preset: 'islands#blueClusterIcons' });
    const placemarks = markers.map(m => {
      return new ymaps.Placemark([m.lat, m.lng], {
        hintContent: m.name || '',
        balloonContent: `<strong>${m.name || ''}</strong><br/>${m.info || ''}`
      }, {
        preset: m.busy ? 'islands#yellowAutoIcon' : 'islands#greenAutoIcon'
      });
    });
    clusterer.add(placemarks);
    map.geoObjects.add(clusterer);

    return () => { map.geoObjects.remove(clusterer); };
  }, [mapReady, markers]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="absolute inset-0">
      {/* Overlay to intercept touch — allows page scroll, tap to activate map */}
      {isMobile && !mapActive && (
        <div 
          className="absolute inset-0 z-10"
          onClick={activateMap}
          style={{ touchAction: 'pan-y' }}
        />
      )}
      {/* Deactivate button */}
      {isMobile && mapActive && (
        <button
          onClick={deactivateMap}
          className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-xs font-medium text-slate-700 shadow-lg"
        >
          Закрыть карту
        </button>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {!ymapsLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Загрузка карты...</p>
          </div>
        </div>
      )}
      {etaMinutes && driverLocation && (
        <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg p-3 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">ETA</span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Время прибытия</p>
              <p className="text-xl font-bold text-slate-900">~{etaMinutes} мин</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YandexMap;
