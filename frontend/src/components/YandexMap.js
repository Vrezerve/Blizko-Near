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
  etaMinutes,
  markers = []
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userPlacemarkRef = useRef(null);
  const driverPlacemarkRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);

  // Load Yandex Maps script
  useEffect(() => {
    if (window.ymaps) {
      setYmapsLoaded(true);
      return;
    }
    if (document.querySelector('script[src*="api-maps.yandex.ru"]')) {
      const check = setInterval(() => {
        if (window.ymaps) { setYmapsLoaded(true); clearInterval(check); }
      }, 100);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => setYmapsLoaded(true));
    };
    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize map
  useEffect(() => {
    if (!ymapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    const ymaps = window.ymaps;
    const isMobile = window.innerWidth < 768;
    
    const map = new ymaps.Map(mapRef.current, {
      center: userLocation ? [userLocation.lat, userLocation.lng] : center,
      zoom: zoom,
      controls: ['zoomControl', 'geolocationControl']
    }, {
      // Allow page scroll on mobile - disable drag by default
      suppressMapOpenBlock: true
    });

    // On mobile: disable drag so page scrolls, enable multiTouch for pinch-zoom
    if (isMobile) {
      map.behaviors.disable('drag');
      map.behaviors.enable('multiTouch');
    }

    map.events.add('click', (e) => {
      const coords = e.get('coords');
      if (onMapClick) onMapClick({ lat: coords[0], lng: coords[1] });
      // Enable drag after first click on mobile (user interacted with map)
      if (isMobile) {
        map.behaviors.enable('drag');
      }
    });

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [ymapsLoaded]);

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

    // Pan map to show both user and driver
    if (userLocation) {
      try {
        map.setBounds([
          [Math.min(userLocation.lat, driverLocation.lat) - 0.005, Math.min(userLocation.lng, driverLocation.lng) - 0.005],
          [Math.max(userLocation.lat, driverLocation.lat) + 0.005, Math.max(userLocation.lng, driverLocation.lng) + 0.005]
        ], { checkZoomRange: true, zoomMargin: 50 });
      } catch (e) {}
    }
  }, [mapReady, driverLocation, driverInfo]);

  // Additional markers (e.g. admin map with multiple drivers)
  useEffect(() => {
    if (!mapReady || !window.ymaps || markers.length === 0) return;
    const ymaps = window.ymaps;
    const map = mapInstanceRef.current;

    // Clear existing markers (except user and driver)
    // We'll use a cluster for admin view
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

  return (
    <div className="absolute inset-0">
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
