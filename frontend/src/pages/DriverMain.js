import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Power, MapPin, Phone, Check, AlertTriangle, 
  Loader2, Menu, User, LogOut, Wallet, X, Clock,
  History, Edit2, Camera, Car
} from 'lucide-react';
import axios from 'axios';
import YandexMap from '../components/YandexMap';
import FabBar from '../components/FabBar';
import TopBar from '../components/TopBar';
import { PushCheckMenuItem } from '../components/PushCheckMenuItem';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Mock map component for driver
const DriverMap = ({ userLocation }) => {
  return (
    <div 
      className="absolute inset-0 bg-slate-100"
      style={{
        backgroundImage: `
          linear-gradient(to right, #e2e8f0 1px, transparent 1px),
          linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px'
      }}
    >
      {/* Street simulation */}
      <div className="absolute top-1/3 left-1/4 text-xs text-slate-400">ул. Ленина</div>
      <div className="absolute top-1/2 right-1/3 text-xs text-slate-400 rotate-6">пр. Мира</div>
      
      {/* Driver location pin */}
      {userLocation && (
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-full z-10"
          style={{ left: '50%', top: '50%' }}
        >
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping" />
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-blue-600" />
          </div>
        </div>
      )}
      
      {/* Zoom controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center text-slate-600 font-bold">+</button>
        <button className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center text-slate-600 font-bold">−</button>
      </div>
    </div>
  );
};

const DriverMain = () => {
  const navigate = useNavigate();
  const { user, token, logout, api, refreshUser } = useAuth();
  
  const [isReady, setIsReady] = useState(false);
  const [agreedRules, setAgreedRules] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [settings, setSettings] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  
  const [currentOrder, setCurrentOrder] = useState(null);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [completeCooldown, setCompleteCooldown] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showProblem, setShowProblem] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [problemReason, setProblemReason] = useState('');
  const [problemText, setProblemText] = useState('');
  const [editName, setEditName] = useState('');
  
  const wsRef = useRef(null);
  const isReadyRef = useRef(false);

  // Sync isReady with user on mount only
  useEffect(() => {
    if (user?.is_online !== undefined) {
      setIsReady(user.is_online);
      isReadyRef.current = user.is_online;
    }
  }, [user?.is_online]);

  useEffect(() => {
    if (!user || user.role !== 'driver') {
      navigate('/');
      return;
    }

    if (!user.is_activated) {
      navigate('/auth/driver');
      return;
    }

    // Get location and start tracking
    let locationWatchId = null;
    
    const updateLocation = async (position) => {
      const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
      setUserLocation(loc);
      
      // Send location to server (for customer tracking)
      try {
        await api('POST', '/drivers/update-location', loc);
      } catch (error) {
        console.error('Failed to update location');
      }
    };

    if (navigator.geolocation) {
      // Get initial location
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        () => setUserLocation({ lat: 55.75, lng: 37.62 })
      );
      
      // Watch location changes (real-time tracking)
      locationWatchId = navigator.geolocation.watchPosition(
        updateLocation,
        (error) => console.error('Location watch error:', error),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
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

    // Fetch active orders
    const fetchOrders = async () => {
      try {
        const data = await api('GET', '/orders/active');
        if (data?.current_order) {
          setCurrentOrder(data.current_order);
          
          if (data.current_order.accepted_at) {
            const acceptedAt = new Date(data.current_order.accepted_at);
            const elapsed = (Date.now() - acceptedAt.getTime()) / 1000;
            const remaining = Math.max(0, 120 - Math.floor(elapsed));
            setCompleteCooldown(remaining);
          }
        } else {
          setCurrentOrder(null);
        }
        setAvailableOrders(data?.available_orders || []);
      } catch (error) {
        console.error('Failed to fetch orders');
      }
    };
    
    fetchOrders();
    const ordersInterval = setInterval(fetchOrders, 5000);

    // Order polling (replaces WebSocket — works through any proxy/firewall)
    const orderPollInterval = setInterval(async () => {
      if (!isReadyRef.current) return;
      try {
        const data = await api('GET', '/orders/active');
        if (data?.available_orders) {
          setAvailableOrders(data.available_orders);
        }
      } catch (e) {}
    }, 3000);

    return () => {
      clearInterval(ordersInterval);
      clearInterval(orderPollInterval);
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [user?.id, user?.role, user?.is_activated, navigate, api]);

  useEffect(() => {
    if (completeCooldown > 0) {
      const timer = setTimeout(() => setCompleteCooldown(completeCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [completeCooldown]);

  const fetchOrderHistory = async () => {
    try {
      const history = await api('GET', '/orders/history');
      setOrderHistory(history);
    } catch (error) {
      console.error('Failed to fetch order history');
    }
  };

  const handleToggleReady = async () => {
    if (!isReady && !agreedRules) {
      setError('Необходимо согласиться с правилами');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await api('POST', '/drivers/toggle-ready');
      const newStatus = result.is_online;
      setIsReady(newStatus);
      isReadyRef.current = newStatus;
      
      if (!newStatus) {
        setAvailableOrders([]);
      }
      
      // Refresh user data in context so is_online stays in sync
      await refreshUser();
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const [selectedEta, setSelectedEta] = useState(null);
  const [showEtaSelect, setShowEtaSelect] = useState(null); // order id

  const getEtaOptions = () => {
    const opts = settings?.eta_options || '1,2,3,5';
    return opts.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
  };

  const handleAcceptOrder = async (orderId, etaMinutes) => {
    if (user.balance <= 0 && !user.is_reliable) {
      setError('Недостаточно баланса для принятия заказов');
      return;
    }

    if (!etaMinutes) {
      // Show ETA selection first
      setShowEtaSelect(orderId);
      return;
    }

    setLoading(true);
    setError('');
    setShowEtaSelect(null);

    try {
      const order = await api('POST', `/orders/accept/${orderId}`, { eta_minutes: etaMinutes });
      setCurrentOrder(order);
      setAvailableOrders([]);
      setCompleteCooldown(120);
      await refreshUser();
    } catch (error) {
      setError(error.response?.data?.detail || 'Заказ уже недоступен');
      const data = await api('GET', '/orders/active');
      setAvailableOrders(data?.available_orders || []);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!currentOrder) return;
    
    if (completeCooldown > 0) {
      setError(`Подождите ещё ${formatTime(completeCooldown)}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api('POST', `/orders/complete/${currentOrder.id}`);
      setCurrentOrder(null);
      await refreshUser();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.startsWith('WAIT:')) {
        const seconds = parseInt(detail.split(':')[1]);
        setCompleteCooldown(seconds);
        setError(`Подождите ещё ${formatTime(seconds)}`);
      } else {
        setError(detail || 'Ошибка завершения');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReportProblem = async () => {
    if (!currentOrder || !problemReason) return;

    setLoading(true);
    setError('');

    try {
      await api('POST', `/orders/problem/${currentOrder.id}`, {
        order_id: currentOrder.id,
        reason: problemReason,
        text: problemText || null
      });
      
      setCurrentOrder(null);
      setShowProblem(false);
      setProblemReason('');
      setProblemText('');
      await refreshUser();
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
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const renderContent = () => {
    if (currentOrder) {
      return (
        <div className="space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Текущий заказ</h2>
          </div>

          <div className="card">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Адрес</p>
                <p className="font-semibold text-slate-900">{currentOrder.address}</p>
                <p className="text-lg font-bold text-green-600">д. {currentOrder.house_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Телефон клиента</p>
                <p className="font-medium text-slate-900">{currentOrder.customer_phone}</p>
              </div>
            </div>
          </div>

          <a
            href={`tel:${currentOrder.customer_phone}`}
            data-testid="call-customer-btn"
            className="btn-secondary"
          >
            <Phone className="w-5 h-5" />
            Позвонить клиенту
          </a>

          <button
            data-testid="complete-order-btn"
            onClick={handleCompleteOrder}
            disabled={loading || completeCooldown > 0}
            className="btn-primary"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Check className="w-5 h-5" />
                {completeCooldown > 0 ? `Завершить (${formatTime(completeCooldown)})` : 'Завершено'}
              </>
            )}
          </button>

          <button
            data-testid="problem-btn"
            onClick={() => setShowProblem(true)}
            className="btn-danger"
          >
            <AlertTriangle className="w-5 h-5" />
            Проблема
          </button>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </div>
      );
    }

    if (!isReady) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Power className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Вы не на линии</h2>
            <p className="text-slate-500">Включите режим работы для получения заказов</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-slate-400" />
                <span className="text-slate-700">Баланс поездок</span>
              </div>
              <span className={`font-bold ${user?.balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {user?.balance || 0}
              </span>
            </div>
          </div>

          {user?.balance <= 0 && (
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-amber-700 font-medium text-sm">Баланс пуст</p>
              <p className="text-amber-500 text-xs">Обратитесь к администратору для пополнения</p>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              data-testid="driver-rules-checkbox"
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

          <button
            data-testid="toggle-ready-btn"
            onClick={handleToggleReady}
            disabled={loading || !agreedRules}
            className={isReady ? "w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors" : "btn-primary"}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Power className="w-5 h-5" />
                {isReady ? 'Уйти с линии' : 'Выйти на линию'}
              </>
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Активные заявки</h2>
            <p className="text-sm text-slate-500">{availableOrders.length} доступно</p>
          </div>
          <button
            data-testid="go-offline-btn"
            onClick={handleToggleReady}
            disabled={loading}
            className="px-4 py-2 bg-red-100 text-red-600 rounded-full text-sm font-medium"
          >
            Выйти
          </button>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-slate-400" />
              <span className="text-slate-700">Баланс</span>
            </div>
            <span className={`font-bold ${user?.balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {user?.balance || 0}
            </span>
          </div>
        </div>

        {availableOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500">Ожидание заявок...</p>
            <p className="text-sm text-slate-400 mt-1">Новые заявки появятся автоматически</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {availableOrders.map((order) => (
              <div key={order.id} className="card fade-in">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <p className="font-medium text-slate-900">{order.address}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(order.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    data-testid={`accept-order-${order.id}`}
                    onClick={() => handleAcceptOrder(order.id)}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    Принять
                  </button>
                </div>
                {showEtaSelect === order.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">Через сколько приедете?</p>
                    <div className="flex gap-2 flex-wrap">
                      {getEtaOptions().map(m => (
                        <button
                          key={m}
                          onClick={() => handleAcceptOrder(order.id, m)}
                          className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          {m} мин
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Map Background */}
      {settings?.map_enabled === false ? (
        <div className="map-background" data-testid="map-disabled-bg" />
      ) : settings?.yandex_map_api_key ? (
        <YandexMap
          apiKey={settings.yandex_map_api_key}
          userLocation={userLocation}
          showUserPin={true}
          customPinUrl={settings?.custom_pin_url ? (settings.custom_pin_url.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + settings.custom_pin_url : settings.custom_pin_url) : ''}
          showFuelStations={settings?.show_fuel_stations || false}
        />
      ) : (
        <DriverMap userLocation={userLocation} />
      )}
      
      <TopBar
        user={user}
        onMenuClick={() => setShowMenu(true)}
        statusOnline={isReady}
        statusText={isReady ? 'На линии' : 'Не в сети'}
        menuTestId="driver-menu-btn"
      />

      <div className="relative z-10 min-h-[100dvh] flex flex-col pt-[60px]">
        <div className="flex-1 flex items-end">
          <div className="bottom-sheet slide-up with-fabbar">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Fab bar — always visible at bottom (no overlay) */}
      {!showMenu && !showProfile && !showHistory && (
        <FabBar role="driver" />
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
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{user?.name}</p>
                  <p className="text-sm text-slate-500">{user?.phone}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">{user?.car_model} • {user?.car_number}</p>
              
              <button
                data-testid="driver-edit-profile-btn"
                onClick={() => {
                  setEditName(user?.name || '');
                  setShowProfile(true);
                  setShowMenu(false);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
              >
                <Edit2 className="w-4 h-4" />
                Редактировать профиль
              </button>
            </div>
            
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Баланс поездок</span>
                <span className={`font-bold ${user?.balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {user?.balance || 0}
                </span>
              </div>
              
              <button
                data-testid="driver-history-btn"
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

              <PushCheckMenuItem testId="driver-push-check-btn" />

              <button
                data-testid="driver-logout-btn"
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
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + user.avatar : user.avatar} alt="" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-blue-600" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow cursor-pointer">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        const res = await axios.post(`${API}/auth/upload-avatar`, fd, { headers: { 'Authorization': `Bearer ${token}` } });
                        if (res.data.avatar_url) await refreshUser();
                      } catch(err) { alert('Ошибка загрузки фото'); }
                      e.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ваше имя</label>
                <input
                  data-testid="driver-profile-name-input"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field"
                  placeholder="Введите имя"
                />
              </div>
              
              <button
                data-testid="driver-save-profile-btn"
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
                           order.status === 'accepted' ? 'В работе' :
                           order.status === 'problem' ? 'Проблема' : 'Отменён'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-slate-600 mb-2">
                        <p>Клиент: {order.customer_phone}</p>
                      </div>
                      
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-slate-400 mb-1">История:</p>
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
              <h3 className="font-semibold text-slate-900">Правила для водителей</h3>
              <button onClick={() => setShowRules(false)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-slate-600 whitespace-pre-line">
                {settings?.driver_rules_text || 'Правила для водителей...'}
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
            <div className="p-4 space-y-3">
              <button
                data-testid="problem-client-not-out"
                onClick={() => setProblemReason('client_not_out')}
                className={`w-full p-4 text-left border rounded-xl transition-colors ${
                  problemReason === 'client_not_out' ? 'border-green-500 bg-green-50' : 'hover:bg-slate-50'
                }`}
              >
                Клиент не вышел
              </button>
              
              <button
                data-testid="problem-wrong-address"
                onClick={() => setProblemReason('wrong_address')}
                className={`w-full p-4 text-left border rounded-xl transition-colors ${
                  problemReason === 'wrong_address' ? 'border-green-500 bg-green-50' : 'hover:bg-slate-50'
                }`}
              >
                Неверный адрес
              </button>
              
              <button
                data-testid="problem-other"
                onClick={() => setProblemReason('other')}
                className={`w-full p-4 text-left border rounded-xl transition-colors ${
                  problemReason === 'other' ? 'border-green-500 bg-green-50' : 'hover:bg-slate-50'
                }`}
              >
                Другое
              </button>

              {problemReason === 'other' && (
                <textarea
                  data-testid="driver-problem-text"
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  className="input-field min-h-[100px]"
                  placeholder="Опишите проблему..."
                />
              )}

              <button
                data-testid="submit-problem-btn"
                onClick={handleReportProblem}
                disabled={loading || !problemReason || (problemReason === 'other' && !problemText.trim())}
                className="btn-primary mt-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverMain;
