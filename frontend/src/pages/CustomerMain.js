import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  MapPin, Navigation, Loader2, X, Phone, Car, 
  CheckCircle, AlertTriangle, LogOut, Menu, User, FileText,
  History, Edit2, Camera, Clock, ChevronRight, Timer
} from 'lucide-react';
import axios from 'axios';
import YandexMap from '../components/YandexMap';
import FabBar from '../components/FabBar';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Mock map component with driver tracking
const TrackingMap = ({ userLocation, driverLocation, driverInfo, showUserPin = true, etaMinutes }) => {
  const [animatedDriverPos, setAnimatedDriverPos] = useState(null);
  
  useEffect(() => {
    if (driverLocation) {
      setAnimatedDriverPos(driverLocation);
    }
  }, [driverLocation]);

  // Calculate positions on the map
  const getUserMapPosition = () => {
    if (!userLocation) return { left: '50%', top: '60%' };
    return { left: '50%', top: '60%' };
  };

  const getDriverMapPosition = () => {
    if (!animatedDriverPos || !userLocation) return null;
    
    // Calculate relative position
    const latDiff = animatedDriverPos.lat - userLocation.lat;
    const lngDiff = animatedDriverPos.lng - userLocation.lng;
    
    // Map to screen coordinates (center = 50%)
    const left = 50 + lngDiff * 3000;
    const top = 60 - latDiff * 3000;
    
    return { 
      left: `${Math.max(10, Math.min(90, left))}%`, 
      top: `${Math.max(15, Math.min(85, top))}%` 
    };
  };

  const driverPos = getDriverMapPosition();

  return (
    <div 
      className="absolute inset-0 bg-slate-100"
      style={{
        backgroundImage: `
          linear-gradient(to right, #e2e8f0 1px, transparent 1px),
          linear-gradient(to bottom, #e2e8f0 1px, transparent 1px),
          linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
          linear-gradient(-45deg, #f1f5f9 25%, transparent 25%)
        `,
        backgroundSize: '32px 32px, 32px 32px, 64px 64px, 64px 64px'
      }}
    >
      {/* Street names simulation */}
      <div className="absolute top-1/4 left-1/4 text-xs text-slate-400 rotate-12">ул. Тверская</div>
      <div className="absolute top-1/2 left-1/3 text-xs text-slate-400 -rotate-6">Садовое кольцо</div>
      <div className="absolute bottom-1/3 right-1/4 text-xs text-slate-400 rotate-3">ул. Арбат</div>
      
      {/* Route line from driver to user */}
      {driverPos && showUserPin && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-5">
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#3b82f6" />
            </marker>
          </defs>
          <path
            d={`M ${driverPos.left} ${driverPos.top} Q 50% 40%, 50% 60%`}
            stroke="url(#routeGradient)"
            strokeWidth="3"
            strokeDasharray="8 4"
            fill="none"
            className="animate-pulse"
          />
        </svg>
      )}
      
      {/* Driver location pin with animation */}
      {driverPos && (
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-full z-20 transition-all duration-1000 ease-out"
          style={{ left: driverPos.left, top: driverPos.top }}
        >
          <div className="relative">
            <div className="absolute -inset-3 bg-blue-500/30 rounded-full animate-ping" />
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-blue-600" />
          </div>
          {/* Driver info tooltip */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
            <p className="font-medium text-sm text-slate-900">{driverInfo?.driver_name}</p>
            <p className="text-xs text-slate-500">{driverInfo?.car_number}</p>
          </div>
        </div>
      )}
      
      {/* User location pin */}
      {showUserPin && userLocation && (
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-full z-10"
          style={getUserMapPosition()}
        >
          <div className="relative">
            <div className="absolute -inset-4 bg-green-500/20 rounded-full animate-ping" />
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-green-600" />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
            Вы здесь
          </div>
        </div>
      )}
      
      {/* ETA Badge */}
      {etaMinutes && driverPos && (
        <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Timer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Время прибытия</p>
              <p className="text-xl font-bold text-slate-900">~{etaMinutes} мин</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Zoom controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center text-slate-600 font-bold">+</button>
        <button className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center text-slate-600 font-bold">−</button>
      </div>
      
      {/* Location info */}
      {!driverPos && (
        <div className="absolute left-4 bottom-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-slate-600">
          <p>Карта</p>
          <p className="text-slate-400">Нажмите для выбора точки</p>
        </div>
      )}
    </div>
  );
};

const CustomerMain = () => {
  const navigate = useNavigate();
  const { user, token, logout, api, refreshUser } = useAuth();
  
  const [address, setAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [agreedRules, setAgreedRules] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [settings, setSettings] = useState(null);
  const [driverStats, setDriverStats] = useState({ online: 0, busy: 0, available: 0 });
  const [userLocation, setUserLocation] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const suggestTimeoutRef = useRef(null);
  
  const [orderState, setOrderState] = useState('idle'); // idle, searching, found, completed
  const [currentOrder, setCurrentOrder] = useState(null);
  const [blockTimer, setBlockTimer] = useState(0);
  const [searchTimer, setSearchTimer] = useState(0);
  const [noDriverTimer, setNoDriverTimer] = useState(0);
  
  // Driver tracking state
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showProblem, setShowProblem] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [problemText, setProblemText] = useState('');
  const [editName, setEditName] = useState('');
  
  const wsRef = useRef(null);
  const noDriverTimerRef = useRef(null);
  const locationTrackingRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'customer') {
      navigate('/');
      return;
    }

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(loc);
          api('POST', '/auth/update-location', loc).catch(console.error);
        },
        () => {
          setUserLocation({ lat: 55.7558, lng: 37.6173 });
        }
      );
    }

    // Fetch settings
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API}/settings/public`);
        setSettings(response.data);
      } catch (error) {
        console.error('Failed to fetch settings');
      }
    };
    fetchSettings();

    // Fetch driver stats
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API}/drivers/stats`);
        setDriverStats(response.data);
      } catch (error) {
        console.error('Failed to fetch driver stats');
      }
    };
    fetchStats();
    const statsInterval = setInterval(fetchStats, 10000);

    // Check for active order
    const checkActiveOrder = async () => {
      try {
        const order = await api('GET', '/orders/active');
        if (order) {
          setCurrentOrder(order);
          if (order.status === 'pending') {
            setOrderState('searching');
          } else if (order.status === 'accepted') {
            setOrderState('found');
            // Start tracking driver location
            startDriverTracking(order.driver_id);
          }
        }
      } catch (error) {
        console.error('Failed to check active order');
      }
    };
    checkActiveOrder();

    // Order status polling (replaces WebSocket — works through any proxy/firewall)
    const orderPollRef = { current: null };
    const pollOrderStatus = async () => {
      try {
        const res = await api('GET', '/orders/my-active');
        if (!res || res.status === 'none') return;
        
        if (res.status === 'accepted' && orderState === 'searching') {
          setCurrentOrder(res);
          setOrderState('found');
          clearTimeout(noDriverTimerRef.current);
          // Set driver info from response
          if (res.driver_location) {
            setDriverLocation(res.driver_location);
          }
          if (res.driver_name) {
            setDriverInfo({
              driver_name: res.driver_name,
              car_model: res.driver_car,
              car_number: res.driver_car_number
            });
          }
          if (res.eta_minutes) {
            setEtaMinutes(res.eta_minutes);
          }
        } else if (res.status === 'accepted' && orderState === 'found') {
          // Update driver location
          if (res.driver_location) {
            setDriverLocation(res.driver_location);
          }
        } else if (res.status === 'completed') {
          setOrderState('completed');
          stopDriverTracking();
          setTimeout(() => { setOrderState('idle'); setCurrentOrder(null); setDriverLocation(null); setDriverInfo(null); setEtaMinutes(null); }, 3000);
        }
      } catch (e) {}
    };
    
    orderPollRef.current = setInterval(pollOrderStatus, 3000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(orderPollRef.current);
      clearTimeout(noDriverTimerRef.current);
      stopDriverTracking();
    };
  }, [user, navigate, api]);

  const startDriverTracking = () => {
    // No-op: driver location is now fetched via /orders/my-active polling
  };

  const stopDriverTracking = () => {
    if (locationTrackingRef.current) {
      clearInterval(locationTrackingRef.current);
      locationTrackingRef.current = null;
    }
  };

  // Block timer countdown
  useEffect(() => {
    if (blockTimer > 0) {
      const timer = setTimeout(() => setBlockTimer(blockTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [blockTimer]);

  // Search timer countdown
  useEffect(() => {
    if (orderState === 'searching' && searchTimer > 0) {
      const timer = setTimeout(() => setSearchTimer(searchTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [searchTimer, orderState]);

  const fetchOrderHistory = async () => {
    try {
      const history = await api('GET', '/orders/history');
      setOrderHistory(history);
    } catch (error) {
      console.error('Failed to fetch order history');
    }
  };

  // Reverse geocode: coordinates → address
  const reverseGeocode = async (lat, lng) => {
    if (!settings?.yandex_map_api_key) return;
    try {
      const res = await axios.get(`https://geocode-maps.yandex.ru/1.x/?apikey=${settings.yandex_map_api_key}&geocode=${lng},${lat}&format=json&results=1`);
      const feature = res.data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
      if (feature) {
        const addr = feature.metaDataProperty?.GeocoderMetaData?.text || feature.name;
        setAddress(addr);
        setHouseNumber('');
      }
    } catch (e) {}
  };

  // Forward geocode: text → suggestions
  const fetchSuggestions = async (query) => {
    if (!settings?.yandex_map_api_key || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    try {
      const res = await axios.get(`https://geocode-maps.yandex.ru/1.x/?apikey=${settings.yandex_map_api_key}&geocode=${encodeURIComponent(query)}&format=json&results=5`);
      const items = res.data?.response?.GeoObjectCollection?.featureMember || [];
      const suggestions = items.map(f => ({
        name: f.GeoObject?.metaDataProperty?.GeocoderMetaData?.text || f.GeoObject?.name,
        pos: f.GeoObject?.Point?.pos
      }));
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (e) {
      setAddressSuggestions([]);
    }
  };

  const handleAddressInput = (value) => {
    setAddress(value);
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    suggestTimeoutRef.current = setTimeout(() => fetchSuggestions(value), 400);
  };

  const selectSuggestion = (suggestion) => {
    setAddress(suggestion.name);
    setShowSuggestions(false);
    setAddressSuggestions([]);
    // Move map to selected address
    if (suggestion.pos) {
      const [lng, lat] = suggestion.pos.split(' ').map(Number);
      setUserLocation({ lat, lng });
    }
  };

  // Handle map click → reverse geocode + collapse sheet
  const handleMapClick = (coords) => {
    if (orderState === 'idle') {
      setUserLocation(coords);
      reverseGeocode(coords.lat, coords.lng);
      setSheetCollapsed(true);
    }
  };

  const handleCreateOrder = async () => {
    if (!agreedRules) {
      setError('Необходимо согласиться с правилами');
      return;
    }

    if (!address.trim() || !houseNumber.trim()) {
      setError('Заполните адрес и номер дома');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const order = await api('POST', '/orders/create', {
        address: address.trim(),
        house_number: houseNumber.trim()
      });
      
      setCurrentOrder(order);
      setOrderState('searching');
      setSearchTimer(120);
      
      noDriverTimerRef.current = setTimeout(() => {
        if (orderState === 'searching') {
          setNoDriverTimer(60);
        }
      }, 120000);
      
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.startsWith('BLOCKED:')) {
        const seconds = parseInt(detail.split(':')[1]);
        setBlockTimer(seconds);
        setError(`Заказ заблокирован на ${Math.ceil(seconds / 60)} мин`);
      } else if (detail === 'You already have an active order') {
        setError('У вас уже есть активный заказ');
        const activeOrder = await api('GET', '/orders/active');
        if (activeOrder) {
          setCurrentOrder(activeOrder);
          setOrderState(activeOrder.status === 'pending' ? 'searching' : 'found');
          if (activeOrder.status === 'accepted') {
            startDriverTracking(activeOrder.driver_id);
          }
        }
      } else {
        setError(detail || 'Ошибка создания заказа');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!currentOrder) return;
    
    setLoading(true);
    try {
      await api('POST', `/orders/cancel/${currentOrder.id}`);
      
      if (currentOrder.status === 'accepted') {
        setBlockTimer(180);
      }
      
      setOrderState('idle');
      setCurrentOrder(null);
      setDriverLocation(null);
      setDriverInfo(null);
      setEtaMinutes(null);
      stopDriverTracking();
      clearTimeout(noDriverTimerRef.current);
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка отмены');
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySearch = () => {
    setNoDriverTimer(0);
    setSearchTimer(120);
    
    noDriverTimerRef.current = setTimeout(() => {
      if (orderState === 'searching') {
        setNoDriverTimer(60);
      }
    }, 120000);
  };

  const handleReportProblem = async (reason) => {
    if (!currentOrder) return;
    
    setLoading(true);
    try {
      await api('POST', `/orders/problem/${currentOrder.id}`, {
        order_id: currentOrder.id,
        reason: reason,
        text: problemText || null
      });
      
      setOrderState('idle');
      setCurrentOrder(null);
      setDriverLocation(null);
      setDriverInfo(null);
      setEtaMinutes(null);
      stopDriverTracking();
      setShowProblem(false);
      setProblemText('');
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (editName.trim()) {
      try {
        await api('POST', '/auth/update-profile', { name: editName.trim() });
        await refreshUser();
        setShowProfile(false);
      } catch (error) {
        console.error('Failed to update profile');
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'accepted': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'problem': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const renderContent = () => {
    switch (orderState) {
      case 'searching':
        return (
          <div className="space-y-6 text-center">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
              <div className="relative w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <Car className="w-10 h-10 text-green-600" />
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Ищем водителя...</h2>
              <p className="text-slate-500">{currentOrder?.address}, д. {currentOrder?.house_number}</p>
              {searchTimer > 0 && (
                <p className="text-sm text-slate-400 mt-2">{formatTime(searchTimer)}</p>
              )}
            </div>

            {noDriverTimer > 0 && (
              <div className="bg-yellow-50 rounded-xl p-4">
                <p className="text-yellow-800 font-medium mb-3">К сожалению, водители заняты</p>
                <div className="flex gap-3">
                  <button
                    data-testid="retry-search-btn"
                    onClick={handleRetrySearch}
                    className="flex-1 btn-primary py-3"
                  >
                    Попробовать ещё
                  </button>
                  <button
                    data-testid="cancel-search-btn"
                    onClick={handleCancelOrder}
                    className="flex-1 btn-secondary py-3"
                  >
                    Отмена
                  </button>
                </div>
                <p className="text-xs text-yellow-600 mt-2">Автоотмена через {formatTime(noDriverTimer)}</p>
              </div>
            )}

            {noDriverTimer === 0 && (
              <button
                data-testid="cancel-order-btn"
                onClick={handleCancelOrder}
                disabled={loading}
                className="btn-secondary"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Отменить'}
              </button>
            )}
          </div>
        );

      case 'found':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-3">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Водитель найден!</span>
              </div>
              <p className="text-slate-500 text-sm">{currentOrder?.address}{currentOrder?.house_number ? `, д. ${currentOrder.house_number}` : ''}</p>
              {(currentOrder?.eta_minutes || etaMinutes) && (
                <p className="text-lg font-bold text-slate-900 mt-1">Приедет через ~{currentOrder?.eta_minutes || etaMinutes} мин</p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                  <Car className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{currentOrder?.driver_name}</p>
                  <p className="text-sm text-slate-500">{currentOrder?.driver_car}</p>
                  <p className="text-sm font-medium text-slate-700">{currentOrder?.driver_car_number}</p>
                </div>
              </div>
            </div>

            <a
              href={`tel:${currentOrder?.driver_phone}`}
              data-testid="call-driver-btn"
              className="btn-primary"
            >
              <Phone className="w-5 h-5" />
              Позвонить водителю
            </a>

            <button
              data-testid="report-problem-btn"
              onClick={() => setShowProblem(true)}
              className="btn-danger w-full"
            >
              <AlertTriangle className="w-5 h-5" />
              Сообщить о проблеме
            </button>
          </div>
        );

      case 'completed':
        return (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Поездка завершена</h2>
              <p className="text-slate-500">Спасибо за использование сервиса!</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Куда едем?</h2>
              <p className="text-slate-500">Укажите адрес подачи</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Адрес подачи</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                  <input
                    data-testid="address-input"
                    type="text"
                    value={address}
                    onChange={(e) => handleAddressInput(e.target.value)}
                    onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="input-field !pl-14"
                    placeholder="Введите адрес или нажмите на карту"
                  />
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-30 max-h-48 overflow-y-auto">
                      {addressSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={() => selectSuggestion(s)}
                          className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-2"
                        >
                          <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Или нажмите на карту для выбора точки</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Номер дома / уточнение</label>
                <input
                  data-testid="house-input"
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="input-field"
                  placeholder="1А, подъезд 2"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                data-testid="rules-checkbox"
                type="checkbox"
                checked={agreedRules}
                onChange={(e) => setAgreedRules(e.target.checked)}
                className="checkbox-custom mt-0.5"
              />
              <span className="text-sm text-slate-600">
                Согласен с{' '}
                <button type="button" onClick={() => setShowRules(true)} className="text-green-600 underline">
                  правилами платформы
                </button>
              </span>
            </label>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {blockTimer > 0 && (
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-red-600 font-medium">Заказ заблокирован</p>
                <p className="text-red-500 text-sm">Попробуйте через {formatTime(blockTimer)}</p>
              </div>
            )}

            <button
              data-testid="create-order-btn"
              onClick={handleCreateOrder}
              disabled={loading || !agreedRules || blockTimer > 0}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Navigation className="w-5 h-5" />
                  Вызвать машину
                </>
              )}
            </button>

            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <p className="font-semibold text-green-600">{driverStats.available}</p>
                <p className="text-slate-500">Свободно</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-yellow-600">{driverStats.busy}</p>
                <p className="text-slate-500">Занято</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app-container" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Map Background — full screen, below UI */}
      {settings?.yandex_map_api_key ? (
        <YandexMap
          apiKey={settings.yandex_map_api_key}
          userLocation={userLocation}
          driverLocation={driverLocation}
          driverInfo={driverInfo}
          showUserPin={true}
          etaMinutes={currentOrder?.eta_minutes || etaMinutes}
          onMapClick={handleMapClick}
          customPinUrl={settings?.custom_pin_url ? (settings.custom_pin_url.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + settings.custom_pin_url : settings.custom_pin_url) : ''}
        />
      ) : (
        <TrackingMap 
          userLocation={userLocation} 
          driverLocation={driverLocation}
          driverInfo={driverInfo}
          showUserPin={true} 
          etaMinutes={etaMinutes}
        />
      )}
      
      {/* Header — floating on top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, padding: 16, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <button
          data-testid="menu-btn"
          onClick={() => setShowMenu(true)}
          style={{ pointerEvents: 'auto' }}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        
        <div style={{ pointerEvents: 'auto' }} className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot" />
          <span className="text-sm font-medium text-slate-700">{driverStats.online} онлайн</span>
        </div>
      </div>

      {/* Bottom sheet */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }} className={`bottom-sheet slide-up ${sheetCollapsed ? 'collapsed' : ''}`}>
          <div className="sheet-handle" onClick={() => setSheetCollapsed(!sheetCollapsed)} />
          {renderContent()}
        </div>
      </div>

      {/* Fab bar — visible only when bottom-sheet is collapsed and no overlay open */}
      {orderState === 'idle' && sheetCollapsed && !showMenu && !showProfile && !showHistory && !showProblem && (
        <FabBar
          role="customer"
          primaryLabel="Вызвать"
          onPrimaryClick={() => {
            setSheetCollapsed(false);
          }}
        />
      )}

      {/* Menu Drawer */}
      {showMenu && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowMenu(false)}>
          <div 
            className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{user?.name || 'Пассажир'}</p>
                  <p className="text-sm text-slate-500">{user?.phone}</p>
                </div>
              </div>
              <button
                data-testid="edit-profile-btn"
                onClick={() => {
                  setEditName(user?.name || '');
                  setShowProfile(true);
                  setShowMenu(false);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
              >
                <Edit2 className="w-4 h-4" />
                Редактировать профиль
              </button>
            </div>
            
            <div className="p-4 space-y-1">
              <button
                data-testid="history-btn"
                onClick={() => {
                  fetchOrderHistory();
                  setShowHistory(true);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <History className="w-5 h-5 text-slate-400" />
                История заказов
              </button>
              
              <button
                data-testid="logout-btn"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Редактирование профиля</h3>
              <button onClick={() => setShowProfile(false)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + user.avatar : user.avatar} alt="" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-green-600" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white shadow cursor-pointer">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        const res = await axios.post(`${API}/auth/upload-avatar`, fd, { headers: { 'Authorization': `Bearer ${token}` } });
                        if (res.data.avatar_url) {
                          await refreshUser();
                        }
                      } catch(err) { alert('Ошибка загрузки фото'); }
                      e.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ваше имя</label>
                <input
                  data-testid="profile-name-input"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field"
                  placeholder="Введите имя"
                />
              </div>
              
              <button
                data-testid="save-profile-btn"
                onClick={handleUpdateProfile}
                className="btn-primary"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">История заказов</h3>
              <button onClick={() => setShowHistory(false)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {orderHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Заказов пока нет</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderHistory.map((order) => (
                    <div key={order.id} className="card">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-slate-900">{order.address}</p>
                          <p className="text-sm text-slate-500">д. {order.house_number}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status === 'completed' ? 'Завершён' :
                           order.status === 'accepted' ? 'В пути' :
                           order.status === 'pending' ? 'Ожидает' :
                           order.status === 'problem' ? 'Проблема' : 'Отменён'}
                        </span>
                      </div>
                      
                      {order.driver_name && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <Car className="w-4 h-4" />
                          <span>{order.driver_name} • {order.driver_car_number}</span>
                        </div>
                      )}
                      
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-slate-400 mb-1">История статусов:</p>
                        <div className="space-y-1">
                          {order.history?.map((h, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-600">{h.status_ru}</span>
                              <span className="text-slate-400">
                                {new Date(h.time).toLocaleString('ru-RU', { 
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Правила для пассажиров</h3>
              <button onClick={() => setShowRules(false)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-slate-600 whitespace-pre-line">
                {settings?.customer_rules_text || 'Правила для пассажиров...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Problem Modal */}
      {showProblem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Сообщить о проблеме</h3>
              <button onClick={() => setShowProblem(false)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <button
                data-testid="problem-no-driver-btn"
                onClick={() => handleReportProblem('driver_not_arrived')}
                className="w-full p-4 text-left border rounded-xl hover:bg-slate-50"
              >
                Водитель не приехал
              </button>
              
              <div>
                <textarea
                  data-testid="problem-text-input"
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  className="input-field min-h-[100px]"
                  placeholder="Опишите проблему..."
                />
                <button
                  data-testid="problem-other-btn"
                  onClick={() => handleReportProblem('other')}
                  disabled={!problemText.trim()}
                  className="btn-primary mt-3"
                >
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerMain;
