import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Car, ClipboardList, Settings, Bell, BarChart3, 
  LogOut, Search, Check, X, Edit2, Loader2, Eye, 
  ChevronRight, AlertTriangle, MessageSquare, Key, Map,
  MapPin, Navigation, Phone, Clock
} from 'lucide-react';

// Admin Map Component showing online drivers
const AdminMap = ({ drivers, onDriverClick }) => {
  return (
    <div 
      className="relative w-full h-96 rounded-xl overflow-hidden bg-slate-100"
      style={{
        backgroundImage: `
          linear-gradient(to right, #e2e8f0 1px, transparent 1px),
          linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px'
      }}
    >
      {/* Map labels */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-sm">
        <p className="font-medium text-slate-900">Водители онлайн: {drivers.length}</p>
      </div>

      {/* Street simulation */}
      <div className="absolute top-1/4 left-1/4 text-xs text-slate-400 rotate-12">ул. Центральная</div>
      <div className="absolute top-1/2 left-1/2 text-xs text-slate-400 -rotate-6">пр. Главный</div>
      <div className="absolute bottom-1/3 right-1/4 text-xs text-slate-400">ул. Парковая</div>

      {/* Driver pins */}
      {drivers.map((driver, idx) => {
        // Distribute drivers on the map
        const angle = (idx / drivers.length) * 2 * Math.PI;
        const radius = 120 + Math.random() * 50;
        const left = 50 + Math.cos(angle) * (radius / 4);
        const top = 50 + Math.sin(angle) * (radius / 6);
        
        return (
          <div
            key={driver.id}
            className="absolute transform -translate-x-1/2 -translate-y-full cursor-pointer group"
            style={{ left: `${left}%`, top: `${top}%` }}
            onClick={() => onDriverClick(driver)}
          >
            <div className="relative">
              {!driver.is_busy && (
                <div className="absolute -inset-2 bg-green-500/30 rounded-full animate-ping" />
              )}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${
                driver.is_busy ? 'bg-yellow-500' : 'bg-green-500'
              }`}>
                <Car className="w-4 h-4 text-white" />
              </div>
              <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-green-500" 
                   style={{ borderTopColor: driver.is_busy ? '#eab308' : '#22c55e' }} />
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                <p className="font-medium">{driver.name}</p>
                <p className="text-slate-300">{driver.car_number}</p>
                <p className={driver.is_busy ? 'text-yellow-400' : 'text-green-400'}>
                  {driver.is_busy ? 'Занят' : 'Свободен'}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span className="text-slate-600">Свободен</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span className="text-slate-600">Занят</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Route Map Modal
const RouteMapModal = ({ orderRoute, onClose }) => {
  if (!orderRoute) return null;
  
  const { order, customer, driver } = orderRoute;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-900">Маршрут заказа #{order.id.slice(0, 8)}</h3>
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-4">
          {/* Mock Route Map */}
          <div 
            className="relative w-full h-64 rounded-xl overflow-hidden bg-slate-100 mb-4"
            style={{
              backgroundImage: `
                linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          >
            {/* Route line */}
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#16a34a" />
                </marker>
              </defs>
              <path
                d="M 100 200 Q 200 100 300 150 T 500 80"
                stroke="#16a34a"
                strokeWidth="3"
                strokeDasharray="8 4"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            </svg>
            
            {/* Driver pin */}
            {driver && (
              <div className="absolute" style={{ left: '15%', top: '75%' }}>
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs text-center mt-1 font-medium text-blue-600">Водитель</p>
              </div>
            )}
            
            {/* Destination pin */}
            <div className="absolute" style={{ left: '80%', top: '25%' }}>
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-center mt-1 font-medium text-red-500">Адрес</p>
            </div>
          </div>
          
          {/* Order Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-500" />
                Адрес подачи
              </h4>
              <p className="text-slate-700">{order.address}</p>
              <p className="text-slate-500">д. {order.house_number}</p>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-600" />
                Клиент
              </h4>
              <p className="text-slate-700">{customer?.name || 'Без имени'}</p>
              <p className="text-slate-500">{order.customer_phone}</p>
            </div>
            
            {driver && (
              <div className="bg-slate-50 rounded-xl p-4 col-span-2">
                <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-600" />
                  Водитель
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-700">{driver.name}</p>
                    <p className="text-slate-500">{driver.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-700">{driver.car_model}</p>
                    <p className="font-medium text-slate-900">{driver.car_number}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, token, logout, api } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({});
  const [onlineDrivers, setOnlineDrivers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedOrderRoute, setSelectedOrderRoute] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }

    loadData();
  }, [user, navigate, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'dashboard':
          const [statsData, driversData] = await Promise.all([
            api('GET', '/admin/stats'),
            api('GET', '/drivers/online-locations')
          ]);
          setStats(statsData);
          setOnlineDrivers(driversData);
          break;
        case 'map':
          const mapDrivers = await api('GET', '/drivers/online-locations');
          setOnlineDrivers(mapDrivers);
          break;
        case 'customers':
          const customersData = await api('GET', '/admin/users?role=customer');
          setUsers(customersData);
          break;
        case 'drivers':
          const allDriversData = await api('GET', '/admin/users?role=driver');
          setUsers(allDriversData);
          break;
        case 'orders':
          const ordersData = await api('GET', '/admin/orders');
          setOrders(ordersData);
          break;
        case 'logs':
          const logsData = await api('GET', '/admin/logs?limit=200');
          setLogs(logsData);
          break;
        case 'notifications':
          const notifData = await api('GET', '/admin/notifications');
          setNotifications(notifData);
          break;
        case 'settings':
          const settingsData = await api('GET', '/settings/');
          setSettings(settingsData);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateDriver = async (userId) => {
    try {
      await api('POST', `/admin/users/${userId}/activate`);
      loadData();
    } catch (error) {
      console.error('Failed to activate driver');
    }
  };

  const handleDeactivateDriver = async (userId) => {
    try {
      await api('POST', `/admin/users/${userId}/deactivate`);
      loadData();
    } catch (error) {
      console.error('Failed to deactivate driver');
    }
  };

  const handleUpdateUser = async (userId) => {
    try {
      await api('POST', `/admin/users/${userId}/update`, editForm);
      setEditingUser(null);
      setEditForm({});
      loadData();
    } catch (error) {
      console.error('Failed to update user');
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user.id);
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      balance: user.balance || 0,
      car_model: user.car_model || '',
      car_number: user.car_number || '',
      admin_notes: user.admin_notes || '',
      is_reliable: user.is_reliable || false,
      is_activated: user.is_activated !== false
    });
  };

  const handleSaveSettings = async () => {
    try {
      await api('POST', '/settings/', settings);
      alert('Настройки сохранены');
    } catch (error) {
      console.error('Failed to save settings');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const viewUserDetails = async (userId) => {
    try {
      const data = await api('GET', `/admin/users/${userId}`);
      setSelectedUser(data);
    } catch (error) {
      console.error('Failed to load user details');
    }
  };

  const viewOrderRoute = async (orderId) => {
    try {
      const data = await api('GET', `/admin/orders/${orderId}/route`);
      setSelectedOrderRoute(data);
    } catch (error) {
      console.error('Failed to load order route');
    }
  };

  const filteredUsers = users.filter(u => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        u.phone?.toLowerCase().includes(query) ||
        u.name?.toLowerCase().includes(query) ||
        u.car_number?.toLowerCase().includes(query)
      );
    }
    if (userFilter === 'activated') return u.is_activated;
    if (userFilter === 'pending') return !u.is_activated;
    if (userFilter === 'online') return u.is_online;
    return true;
  });

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  const renderDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Обзор</h2>
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.customers}</p>
                <p className="text-sm text-slate-500">Пассажиров</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.drivers.total}</p>
                <p className="text-sm text-slate-500">Водителей</p>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs">
              <span className="text-green-600">{stats.drivers.online} онлайн</span>
              <span className="text-yellow-600">{stats.drivers.pending} ожидают</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.orders.total}</p>
                <p className="text-sm text-slate-500">Всего заказов</p>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs">
              <span className="text-green-600">{stats.orders.completed} выполнено</span>
              <span className="text-yellow-600">{stats.orders.pending} активных</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.orders.problem}</p>
                <p className="text-sm text-slate-500">Проблемных</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mini map on dashboard */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Map className="w-5 h-5 text-slate-400" />
          Водители на карте
        </h3>
        <AdminMap 
          drivers={onlineDrivers} 
          onDriverClick={(driver) => viewUserDetails(driver.id)}
        />
      </div>
    </div>
  );

  const renderMap = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Карта водителей</h2>
      
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <AdminMap 
          drivers={onlineDrivers} 
          onDriverClick={(driver) => viewUserDetails(driver.id)}
        />
      </div>
      
      {/* Online drivers list */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Список онлайн водителей</h3>
        <div className="space-y-3">
          {onlineDrivers.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Нет водителей онлайн</p>
          ) : (
            onlineDrivers.map((driver) => (
              <div key={driver.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${driver.is_busy ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <div>
                    <p className="font-medium text-slate-900">{driver.name}</p>
                    <p className="text-sm text-slate-500">{driver.car_model} • {driver.car_number}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">{driver.phone}</p>
                  <span className={`text-xs ${driver.is_busy ? 'text-yellow-600' : 'text-green-600'}`}>
                    {driver.is_busy ? 'Занят' : 'Свободен'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderUsers = (role) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-900">
          {role === 'customer' ? 'Пассажиры' : 'Водители'}
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
            />
          </div>
          
          {role === 'driver' && (
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">Все</option>
              <option value="activated">Активированные</option>
              <option value="pending">Ожидают активации</option>
              <option value="online">Онлайн</option>
            </select>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Телефон</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">ФИО</th>
              {role === 'driver' && (
                <>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Авто</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Баланс</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Статус</th>
                </>
              )}
              <th className="text-left p-4 text-sm font-medium text-slate-600">Заказов</th>
              <th className="text-right p-4 text-sm font-medium text-slate-600">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-4">
                  <span className="font-medium text-slate-900">{u.phone}</span>
                </td>
                <td className="p-4 text-slate-600">{u.name || '—'}</td>
                {role === 'driver' && (
                  <>
                    <td className="p-4">
                      <span className="text-slate-600">{u.car_model}</span>
                      <br />
                      <span className="text-xs text-slate-400">{u.car_number}</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-medium ${u.balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {u.balance}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {u.is_activated ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <Check className="w-3 h-3" /> Активирован
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                            <AlertTriangle className="w-3 h-3" /> Ожидает
                          </span>
                        )}
                        {u.is_online && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                            • Онлайн
                          </span>
                        )}
                      </div>
                    </td>
                  </>
                )}
                <td className="p-4 text-slate-600">{u.total_orders || 0}</td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => viewUserDetails(u.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                      title="Подробнее"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEditUser(u)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {role === 'driver' && (
                      !u.is_activated ? (
                        <button
                          onClick={() => handleActivateDriver(u.id)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                        >
                          Активировать
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeactivateDriver(u.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                        >
                          Деактив.
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Нет данных
          </div>
        )}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Заказы</h2>
        
        <select
          value={orderFilter}
          onChange={(e) => setOrderFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="all">Все</option>
          <option value="pending">Ожидают</option>
          <option value="accepted">Приняты</option>
          <option value="completed">Завершены</option>
          <option value="cancelled">Отменены</option>
          <option value="problem">Проблемные</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-slate-600">ID</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Адрес</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Клиент</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Водитель</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Статус</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Дата</th>
              <th className="text-right p-4 text-sm font-medium text-slate-600">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-4">
                  <span className="font-mono text-xs text-slate-500">{order.id.slice(0, 8)}</span>
                </td>
                <td className="p-4">
                  <span className="text-slate-900">{order.address}</span>
                  <br />
                  <span className="text-sm text-slate-500">д. {order.house_number}</span>
                </td>
                <td className="p-4 text-slate-600">{order.customer_phone}</td>
                <td className="p-4">
                  {order.driver_name ? (
                    <>
                      <span className="text-slate-900">{order.driver_name}</span>
                      <br />
                      <span className="text-xs text-slate-500">{order.driver_phone}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                    order.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'problem' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {order.status === 'completed' ? 'Завершен' :
                     order.status === 'accepted' ? 'Принят' :
                     order.status === 'pending' ? 'Ожидает' :
                     order.status === 'problem' ? 'Проблема' :
                     order.status === 'cancelled' ? 'Отменен' : order.status}
                  </span>
                  {order.problem_reason && (
                    <p className="text-xs text-red-500 mt-1">{order.problem_reason}</p>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-500">
                  {new Date(order.created_at).toLocaleString('ru-RU')}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => viewOrderRoute(order.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                  >
                    <Map className="w-4 h-4" />
                    Маршрут
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredOrders.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Нет заказов
          </div>
        )}
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Логи действий</h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Время</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Действие</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Пользователь</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Детали</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50">
                  <td className="p-4 text-sm text-slate-500">
                    {new Date(log.timestamp).toLocaleString('ru-RU')}
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-slate-900">{log.action_ru || log.action}</span>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {log.user_id?.slice(0, 8) || '—'}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Уведомления (СМС и Push)</h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Время</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Тип</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Получатель</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Заголовок</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notif) => (
                <tr key={notif.id} className="border-b border-slate-50">
                  <td className="p-4 text-sm text-slate-500">
                    {new Date(notif.sent_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      notif.type === 'sms' ? 'bg-blue-100 text-blue-700' :
                      notif.type === 'push' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {notif.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-600 font-mono">
                    {notif.user_id?.slice(0, 8)}
                  </td>
                  <td className="p-4 text-sm text-slate-900">{notif.title}</td>
                  <td className="p-4 text-sm text-slate-500">{notif.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Настройки</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Keys */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-slate-400" />
            API Ключи
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">SMS.ru API Key</label>
              <input
                type="text"
                value={settings.sms_ru_api_key || ''}
                onChange={(e) => setSettings({...settings, sms_ru_api_key: e.target.value})}
                className="input-field"
                placeholder="Введите ключ API"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">OneSignal App ID</label>
              <input
                type="text"
                value={settings.onesignal_app_id || ''}
                onChange={(e) => setSettings({...settings, onesignal_app_id: e.target.value})}
                className="input-field"
                placeholder="App ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">OneSignal API Key</label>
              <input
                type="text"
                value={settings.onesignal_api_key || ''}
                onChange={(e) => setSettings({...settings, onesignal_api_key: e.target.value})}
                className="input-field"
                placeholder="API Key"
              />
            </div>
          </div>
        </div>

        {/* Maps */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Карты</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Провайдер карт</label>
              <select
                value={settings.active_map_provider || 'yandex'}
                onChange={(e) => setSettings({...settings, active_map_provider: e.target.value})}
                className="input-field"
              >
                <option value="yandex">Yandex Maps</option>
                <option value="google">Google Maps</option>
                <option value="2gis">2GIS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Yandex Maps API Key</label>
              <input
                type="text"
                value={settings.yandex_map_api_key || ''}
                onChange={(e) => setSettings({...settings, yandex_map_api_key: e.target.value})}
                className="input-field"
                placeholder="API Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Google Maps API Key</label>
              <input
                type="text"
                value={settings.google_map_api_key || ''}
                onChange={(e) => setSettings({...settings, google_map_api_key: e.target.value})}
                className="input-field"
                placeholder="API Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">2GIS API Key</label>
              <input
                type="text"
                value={settings.twogis_api_key || ''}
                onChange={(e) => setSettings({...settings, twogis_api_key: e.target.value})}
                className="input-field"
                placeholder="API Key"
              />
            </div>
          </div>
        </div>

        {/* SMTP */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">SMTP (Email)</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtp_host || ''}
                  onChange={(e) => setSettings({...settings, smtp_host: e.target.value})}
                  className="input-field"
                  placeholder="smtp.mail.ru"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Port</label>
                <input
                  type="number"
                  value={settings.smtp_port || 587}
                  onChange={(e) => setSettings({...settings, smtp_port: parseInt(e.target.value)})}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">SMTP User</label>
              <input
                type="text"
                value={settings.smtp_user || ''}
                onChange={(e) => setSettings({...settings, smtp_user: e.target.value})}
                className="input-field"
                placeholder="user@mail.ru"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">SMTP Password</label>
              <input
                type="password"
                value={settings.smtp_password || ''}
                onChange={(e) => setSettings({...settings, smtp_password: e.target.value})}
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email админа</label>
              <input
                type="email"
                value={settings.admin_email || ''}
                onChange={(e) => setSettings({...settings, admin_email: e.target.value})}
                className="input-field"
                placeholder="admin@example.com"
              />
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Режим обслуживания</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenance_mode || false}
                onChange={(e) => setSettings({...settings, maintenance_mode: e.target.checked})}
                className="checkbox-custom"
              />
              <span className="text-slate-700">Включить режим тех. работ</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Текст уведомления</label>
              <textarea
                value={settings.maintenance_text || ''}
                onChange={(e) => setSettings({...settings, maintenance_text: e.target.value})}
                className="input-field min-h-[100px]"
                placeholder="Ведутся технические работы..."
              />
            </div>
          </div>
        </div>

        {/* Terms & Rules */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Тексты правил</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Условия сервиса</label>
              <textarea
                value={settings.terms_text || ''}
                onChange={(e) => setSettings({...settings, terms_text: e.target.value})}
                className="input-field min-h-[150px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Политика конфиденциальности</label>
              <textarea
                value={settings.privacy_text || ''}
                onChange={(e) => setSettings({...settings, privacy_text: e.target.value})}
                className="input-field min-h-[150px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Правила для пассажиров</label>
              <textarea
                value={settings.customer_rules_text || ''}
                onChange={(e) => setSettings({...settings, customer_rules_text: e.target.value})}
                className="input-field min-h-[150px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Правила для водителей</label>
              <textarea
                value={settings.driver_rules_text || ''}
                onChange={(e) => setSettings({...settings, driver_rules_text: e.target.value})}
                className="input-field min-h-[150px]"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSaveSettings}
        className="btn-primary max-w-xs"
      >
        Сохранить настройки
      </button>
    </div>
  );

  const navItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Обзор' },
    { id: 'map', icon: Map, label: 'Карта' },
    { id: 'customers', icon: Users, label: 'Пассажиры' },
    { id: 'drivers', icon: Car, label: 'Водители' },
    { id: 'orders', icon: ClipboardList, label: 'Заказы' },
    { id: 'logs', icon: MessageSquare, label: 'Логи' },
    { id: 'notifications', icon: Bell, label: 'Уведомления' },
    { id: 'settings', icon: Settings, label: 'Настройки' },
  ];

  return (
    <div className="admin-container">
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="admin-sidebar flex-shrink-0 sticky top-6 self-start">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Такси</p>
              <p className="text-xs text-slate-500">Админ-панель</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`admin-nav-item w-full ${activeTab === item.id ? 'active' : ''}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              data-testid="admin-logout"
              onClick={handleLogout}
              className="admin-nav-item w-full text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
              Выйти
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'map' && renderMap()}
              {activeTab === 'customers' && renderUsers('customer')}
              {activeTab === 'drivers' && renderUsers('driver')}
              {activeTab === 'orders' && renderOrders()}
              {activeTab === 'logs' && renderLogs()}
              {activeTab === 'notifications' && renderNotifications()}
              {activeTab === 'settings' && renderSettings()}
            </>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Редактирование пользователя</h3>
              <button onClick={() => setEditingUser(null)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ФИО</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Телефон</label>
                <input
                  type="text"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Баланс поездок</label>
                <input
                  type="number"
                  value={editForm.balance || 0}
                  onChange={(e) => setEditForm({...editForm, balance: parseInt(e.target.value)})}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Автомобиль</label>
                <input
                  type="text"
                  value={editForm.car_model || ''}
                  onChange={(e) => setEditForm({...editForm, car_model: e.target.value})}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Номер авто</label>
                <input
                  type="text"
                  value={editForm.car_number || ''}
                  onChange={(e) => setEditForm({...editForm, car_number: e.target.value})}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Заметки админа</label>
                <textarea
                  value={editForm.admin_notes || ''}
                  onChange={(e) => setEditForm({...editForm, admin_notes: e.target.value})}
                  className="input-field min-h-[80px]"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_reliable || false}
                    onChange={(e) => setEditForm({...editForm, is_reliable: e.target.checked})}
                    className="checkbox-custom"
                  />
                  <span className="text-sm text-slate-700">Надёжный водитель</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_activated !== false}
                    onChange={(e) => setEditForm({...editForm, is_activated: e.target.checked})}
                    className="checkbox-custom"
                  />
                  <span className="text-sm text-slate-700">Активирован</span>
                </label>
              </div>
              
              <button
                onClick={() => handleUpdateUser(editingUser)}
                className="btn-primary"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Детали пользователя</h3>
              <button onClick={() => setSelectedUser(null)} className="p-2">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-500">Телефон</p>
                  <p className="font-medium">{selectedUser.user.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Роль</p>
                  <p className="font-medium">{selectedUser.user.role}</p>
                </div>
                {selectedUser.user.name && (
                  <div>
                    <p className="text-sm text-slate-500">ФИО</p>
                    <p className="font-medium">{selectedUser.user.name}</p>
                  </div>
                )}
                {selectedUser.user.car_model && (
                  <div>
                    <p className="text-sm text-slate-500">Автомобиль</p>
                    <p className="font-medium">{selectedUser.user.car_model} ({selectedUser.user.car_number})</p>
                  </div>
                )}
              </div>

              <h4 className="font-semibold text-slate-900 mb-3">Последние заказы</h4>
              <div className="space-y-2 mb-6">
                {selectedUser.orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span>{order.address}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                        order.status === 'problem' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1">
                      {new Date(order.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                ))}
              </div>

              <h4 className="font-semibold text-slate-900 mb-3">Последние действия</h4>
              <div className="space-y-2">
                {selectedUser.logs.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                    <span className="font-medium">{log.action_ru || log.action}</span>
                    <p className="text-slate-400 text-xs mt-1">
                      {new Date(log.timestamp).toLocaleString('ru-RU')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Map Modal */}
      <RouteMapModal 
        orderRoute={selectedOrderRoute} 
        onClose={() => setSelectedOrderRoute(null)} 
      />
    </div>
  );
};

export default AdminPanel;
