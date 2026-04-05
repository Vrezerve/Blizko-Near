import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  MapPin, Navigation, Loader2, X, Phone, Car, 
  CheckCircle, AlertTriangle, LogOut, Menu, User, FileText
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CustomerMain = () => {
  const navigate = useNavigate();
  const { user, token, logout, api } = useAuth();
  
  const [address, setAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [agreedRules, setAgreedRules] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [settings, setSettings] = useState(null);
  const [driverStats, setDriverStats] = useState({ online: 0, busy: 0, available: 0 });
  
  const [orderState, setOrderState] = useState('idle'); // idle, searching, found, completed
  const [currentOrder, setCurrentOrder] = useState(null);
  const [blockTimer, setBlockTimer] = useState(0);
  const [searchTimer, setSearchTimer] = useState(0);
  const [noDriverTimer, setNoDriverTimer] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showProblem, setShowProblem] = useState(false);
  const [problemText, setProblemText] = useState('');
  
  const wsRef = useRef(null);
  const searchTimerRef = useRef(null);
  const noDriverTimerRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'customer') {
      navigate('/');
      return;
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
          }
        }
      } catch (error) {
        console.error('Failed to check active order');
      }
    };
    checkActiveOrder();

    // Setup WebSocket
    const wsUrl = process.env.REACT_APP_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    wsRef.current = new WebSocket(`${wsUrl}/ws/${user.id}`);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'order_accepted') {
        setCurrentOrder(data.order);
        setOrderState('found');
        clearInterval(searchTimerRef.current);
        clearTimeout(noDriverTimerRef.current);
      } else if (data.type === 'order_completed') {
        setOrderState('completed');
        setTimeout(() => {
          setOrderState('idle');
          setCurrentOrder(null);
        }, 3000);
      }
    };

    return () => {
      clearInterval(statsInterval);
      clearInterval(searchTimerRef.current);
      clearTimeout(noDriverTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, navigate, api]);

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
      
      // Set 2 minute timeout for no driver
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
      clearInterval(searchTimerRef.current);
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
      setShowProblem(false);
      setProblemText('');
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setLoading(false);
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
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Водитель найден!</h2>
              <p className="text-slate-500">{currentOrder?.address}, д. {currentOrder?.house_number}</p>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-7 h-7 text-blue-600" />
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

            <div className="flex gap-3">
              <button
                data-testid="cancel-after-accept-btn"
                onClick={handleCancelOrder}
                disabled={loading}
                className="flex-1 btn-secondary"
              >
                Отменить
              </button>
              <button
                data-testid="report-problem-btn"
                onClick={() => setShowProblem(true)}
                className="flex-1 btn-danger"
              >
                <AlertTriangle className="w-5 h-5" />
                Проблема
              </button>
            </div>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Адрес</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    data-testid="address-input"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-field pl-12"
                    placeholder="Город, улица"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Номер дома</label>
                <input
                  data-testid="house-input"
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="input-field"
                  placeholder="1А"
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
    <div className="app-container">
      <div className="map-background" />
      
      <div className="relative z-10 min-h-[100dvh] flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <button
            data-testid="menu-btn"
            onClick={() => setShowMenu(true)}
            className="w-10 h-10 bg-white rounded-full shadow flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          
          <div className="bg-white rounded-full shadow px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot" />
            <span className="text-sm font-medium text-slate-700">{driverStats.online} водителей онлайн</span>
          </div>
        </div>

        <div className="flex-1 flex items-end">
          <div className="bottom-sheet slide-up">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Menu Drawer */}
      {showMenu && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowMenu(false)}>
          <div 
            className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-green-600" />
              </div>
              <p className="font-semibold text-slate-900">{user?.name || 'Пассажир'}</p>
              <p className="text-sm text-slate-500">{user?.phone}</p>
            </div>
            
            <div className="p-4">
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
