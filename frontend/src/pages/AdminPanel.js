import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Car, ClipboardList, Settings, Bell, BarChart3, 
  LogOut, Search, Check, X, Edit2, Loader2, Eye, 
  ChevronRight, AlertTriangle, MessageSquare, Key, Map,
  MapPin, Navigation, Phone, Clock, Smartphone, Ban, Unlock,
  Upload, Image, Package, Download, RefreshCw, Trash2, Power,
  ToggleLeft, ToggleRight, Archive, Plus
} from 'lucide-react';
import YandexMap from '../components/YandexMap';
import ErrorBoundary from '../components/ErrorBoundary';

// Admin Map Component showing online drivers
const AdminMap = ({ drivers, onDriverClick, apiKey }) => {
  if (apiKey) {
    const markers = drivers.map(d => ({
      lat: d.last_location?.lat || (55.75 + (Math.random() - 0.5) * 0.05),
      lng: d.last_location?.lng || (37.57 + (Math.random() - 0.5) * 0.05),
      name: d.name || 'Водитель',
      info: `${d.car_model || ''} ${d.car_number || ''}`,
      busy: d.is_busy
    }));
    return (
      <div className="relative w-full h-96 rounded-xl overflow-hidden">
        <ErrorBoundary fallback={
          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
            Не удалось загрузить карту
          </div>
        }>
          <YandexMap apiKey={apiKey} markers={markers} zoom={12} />
        </ErrorBoundary>
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-sm z-10">
          <p className="font-medium text-slate-900">Водители онлайн: {drivers.length}</p>
        </div>
      </div>
    );
  }

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
  const { user, token, logout, api, refreshUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({});
  const [onlineDrivers, setOnlineDrivers] = useState([]);
  const [blockedDevices, setBlockedDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedOrderRoute, setSelectedOrderRoute] = useState(null);
  const [iconUploading, setIconUploading] = useState(false);
  const [modules, setModules] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [updateUploading, setUpdateUploading] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const [newModule, setNewModule] = useState({ name: '', description: '', version: '1.0' });
  const [showAddModule, setShowAddModule] = useState(false);
  const [moduleUploading, setModuleUploading] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  const [sysLogFilter, setSysLogFilter] = useState('all');
  const [fabButtons, setFabButtons] = useState([]);
  const [editingFab, setEditingFab] = useState(null);
  const [fabSaving, setFabSaving] = useState(false);
  const [credForm, setCredForm] = useState({ current_password: '', new_email: '', new_password: '', confirm_password: '' });
  const [credSaving, setCredSaving] = useState(false);
  const [credMsg, setCredMsg] = useState(null);
  const [pushStatuses, setPushStatuses] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);

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
          const [statsData, driversData, dashSettingsData] = await Promise.all([
            api('GET', '/admin/stats'),
            api('GET', '/drivers/online-locations'),
            api('GET', '/settings/')
          ]);
          setStats(statsData);
          setOnlineDrivers(driversData);
          setSettings(dashSettingsData);
          break;
        case 'map':
          const mapDrivers = await api('GET', '/drivers/online-locations');
          setOnlineDrivers(mapDrivers);
          if (!settings?.yandex_map_api_key) {
            const mapSettings = await api('GET', '/settings/');
            setSettings(mapSettings);
          }
          break;
        case 'customers':
          const customersData = await api('GET', '/admin/users?role=customer');
          setUsers(customersData);
          fetchPushStatuses(customersData);
          break;
        case 'drivers':
          const allDriversData = await api('GET', '/admin/users?role=driver');
          setUsers(allDriversData);
          fetchPushStatuses(allDriversData);
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
        case 'devices':
          const devicesData = await api('GET', '/admin/blocked-devices');
          setBlockedDevices(devicesData);
          break;
        case 'updates':
          const [modulesData, updatesData] = await Promise.all([
            api('GET', '/admin/modules'),
            api('GET', '/admin/updates')
          ]);
          setModules(modulesData);
          setUpdates(updatesData);
          break;
        case 'syslog':
          const sysLogsData = await api('GET', '/admin/system-logs?limit=300');
          setSystemLogs(sysLogsData);
          break;
        case 'fabbar':
          const fabData = await api('GET', '/admin/fab-buttons');
          setFabButtons(fabData);
          break;
        case 'profile':
          // Just init form fields with current admin email
          setCredForm({ current_password: '', new_email: user?.email || '', new_password: '', confirm_password: '' });
          setCredMsg(null);
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

  const handleTestPushUser = async (u) => {
    try {
      const res = await api('POST', `/admin/test-push/${u.id}`);
      const status = res?.delivery?.status;
      const onesignalId = res?.delivery?.onesignal_id;
      let msg = `Push отправлен пользователю ${u.name || u.phone}.`;
      if (status === 'sent') {
        msg += `\n\n✓ OneSignal принял (id: ${onesignalId || '—'}).\nЕсли пользователь подписан — он получит push в течение нескольких секунд.`;
      } else if (status === 'no_subscription') {
        msg += `\n\n⚠ Пользователь НЕ подписан на push. Попросите его открыть сайт, разрешить уведомления и проверить /push-debug.`;
      } else if (status === 'failed' || status === 'error') {
        msg += `\n\n✗ Ошибка отправки. Детали в системных логах.`;
      } else {
        msg += `\n\nСтатус: ${status || 'неизвестен'}`;
      }
      alert(msg);
      // Update push status for that user
      fetchPushStatuses([u]);
    } catch (e) {
      alert(e.response?.data?.detail || e.message || 'Ошибка отправки push');
    }
  };

  const fetchPushStatuses = async (userList) => {
    if (!userList || userList.length === 0) return;
    try {
      const ids = userList.map(u => u.id);
      const res = await api('POST', '/admin/push-status', { user_ids: ids });
      if (res?.statuses) {
        setPushStatuses(prev => ({ ...prev, ...res.statuses }));
      }
    } catch (e) {
      // Silent fail — status will simply remain undefined
    }
  };

  const handleUnblockDevice = async (deviceId) => {
    try {
      await api('POST', `/admin/unblock-device/${deviceId}`);
      loadData();
    } catch (error) {
      console.error('Failed to unblock device');
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

  const handleDeleteUser = async (userId) => {
    try {
      const res = await api('DELETE', `/admin/users/${userId}`);
      setDeletingUser(null);
      setEditingUser(null);
      setSelectedUser(null);
      setEditForm({});
      loadData();
      const extra = res?.orders_deleted ? ` (заказов удалено: ${res.orders_deleted})` : '';
      alert('Пользователь удалён' + extra);
    } catch (error) {
      alert('Не удалось удалить: ' + (error.response?.data?.detail || 'ошибка'));
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

  const handleAuthSlideUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Максимальный размер: 5 МБ');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/auth-slides/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await resp.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, auth_slides: [...(prev.auth_slides || []), data.slide] }));
      } else {
        alert(data.detail || 'Ошибка загрузки');
      }
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  const handleAuthSlideDelete = async (slideId) => {
    if (!window.confirm('Удалить слайд?')) return;
    try {
      await api('DELETE', `/settings/auth-slides/${slideId}`);
      setSettings(prev => ({ ...prev, auth_slides: (prev.auth_slides || []).filter(s => s.id !== slideId) }));
    } catch (err) {
      alert('Не удалось удалить');
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Максимальный размер файла: 2 МБ');
      return;
    }
    
    setIconUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/upload-icon`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      const data = await response.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, app_icon_url: data.url }));
        alert('Иконка загружена');
      } else {
        alert(data.detail || 'Ошибка загрузки');
      }
    } catch (error) {
      alert('Ошибка загрузки иконки');
    } finally {
      setIconUploading(false);
      e.target.value = '';
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // ── Modules & Updates ─────────────
  const handleAddModule = async (fileToUpload) => {
    if (!newModule.name.trim()) return;
    try {
      const result = await api('POST', '/admin/modules', newModule);
      const moduleId = result.module?.id;
      
      // Upload ZIP if provided
      if (fileToUpload && moduleId) {
        setModuleUploading(moduleId);
        const formData = new FormData();
        formData.append('file', fileToUpload);
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/modules/${moduleId}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        setModuleUploading(null);
      }
      
      setNewModule({ name: '', description: '', version: '1.0' });
      setShowAddModule(false);
      loadData();
    } catch (error) {
      setModuleUploading(null);
      alert('Ошибка добавления модуля');
    }
  };

  const handleModuleFileUpload = async (moduleId, file) => {
    if (!file || !file.name.endsWith('.zip')) {
      alert('Допустим только формат ZIP');
      return;
    }
    setModuleUploading(moduleId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/modules/${moduleId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.detail || 'Ошибка загрузки');
      }
    } catch (error) {
      alert('Ошибка загрузки архива');
    } finally {
      setModuleUploading(null);
    }
  };

  const handleToggleModule = async (moduleId) => {
    try {
      await api('POST', `/admin/modules/${moduleId}/toggle`);
      loadData();
    } catch (error) {
      alert('Ошибка');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Удалить модуль и его архив?')) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/modules/${moduleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.detail || 'Ошибка удаления');
      }
    } catch (error) {
      alert('Ошибка удаления модуля');
    }
  };

  const handleUpdateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      alert('Допустим только формат ZIP');
      return;
    }
    setUpdateUploading(true);
    setUpdateResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/update/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setUpdateResult({ type: 'success', message: data.message, parts: data.parts_updated, files: data.files_count });
        loadData();
      } else {
        setUpdateResult({ type: 'error', message: data.detail || 'Ошибка' });
      }
    } catch (error) {
      setUpdateResult({ type: 'error', message: 'Ошибка загрузки обновления' });
    } finally {
      setUpdateUploading(false);
      e.target.value = '';
    }
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
          apiKey={settings?.yandex_map_api_key}
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
          apiKey={settings?.yandex_map_api_key}
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

      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        <span>Push:</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>Подписан</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Заблокировал в браузере</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>Не активна</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>Не подписывался</span>
        <button
          onClick={() => fetchPushStatuses(filteredUsers)}
          className="ml-auto text-purple-600 hover:underline"
        >
          Обновить статусы
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden admin-table-wrap">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-slate-600">ID / Push</th>
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { navigator.clipboard?.writeText(u.id); }}
                      title={`Скопировать ID: ${u.id}`}
                      className="font-mono text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                      data-testid={`user-id-${u.id}`}
                    >
                      {u.id.substring(0, 8)}…
                    </button>
                    {(() => {
                      const ps = pushStatuses[u.id];
                      const map = {
                        subscribed: { dot: 'bg-green-500', title: 'Подписан на push' },
                        blocked: { dot: 'bg-red-500', title: 'Заблокировал уведомления в браузере' },
                        pending: { dot: 'bg-yellow-500', title: 'Подписка существует, но не активна' },
                        not_registered: { dot: 'bg-slate-300', title: 'Не подписан' },
                        no_onesignal: { dot: 'bg-slate-200', title: 'OneSignal не настроен' },
                        error: { dot: 'bg-orange-400', title: 'Ошибка проверки' },
                      };
                      const meta = map[ps] || { dot: 'bg-slate-200', title: 'Загрузка...' };
                      return (
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`}
                          title={meta.title}
                          data-testid={`push-status-${u.id}`}
                        />
                      );
                    })()}
                    <button
                      onClick={() => handleTestPushUser(u)}
                      title="Отправить тестовый push этому пользователю"
                      className="p-1 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded"
                      data-testid={`test-push-${u.id}`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
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

  const handleClearSystemLogs = async () => {
    if (!window.confirm('Очистить все системные логи?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/system-logs`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSystemLogs([]);
    } catch (error) {
      alert('Ошибка очистки');
    }
  };

  const renderSystemLogs = () => {
    const filteredLogs = sysLogFilter === 'all' 
      ? systemLogs 
      : systemLogs.filter(l => l.level === sysLogFilter);

    const levelColors = {
      error: 'bg-red-100 text-red-700',
      warning: 'bg-yellow-100 text-yellow-700',
      info: 'bg-blue-100 text-blue-700',
      debug: 'bg-slate-100 text-slate-600'
    };

    const levelLabels = {
      error: 'Ошибка',
      warning: 'Предупр.',
      info: 'Инфо',
      debug: 'Отладка'
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Системные логи</h2>
          <div className="flex items-center gap-3">
            <select
              value={sysLogFilter}
              onChange={(e) => setSysLogFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
              data-testid="syslog-filter"
            >
              <option value="all">Все уровни</option>
              <option value="error">Ошибки</option>
              <option value="warning">Предупреждения</option>
              <option value="info">Информация</option>
              <option value="debug">Отладка</option>
            </select>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-600 hover:bg-slate-200"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearSystemLogs}
              className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
              data-testid="clear-syslog-btn"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Logging settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.system_logging !== false}
                  onChange={(e) => {
                    const newSettings = {...settings, system_logging: e.target.checked};
                    setSettings(newSettings);
                    api('POST', '/settings/', newSettings);
                  }}
                  className="checkbox-custom"
                  data-testid="syslog-enabled-toggle"
                />
                <span className="text-sm text-slate-700">Логирование включено</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Мин. уровень:</span>
              <select
                value={settings.log_level || 'info'}
                onChange={(e) => {
                  const newSettings = {...settings, log_level: e.target.value};
                  setSettings(newSettings);
                  api('POST', '/settings/', newSettings);
                }}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                data-testid="syslog-level-select"
              >
                <option value="debug">Debug (всё)</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error (только ошибки)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Время</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Уровень</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Источник</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Сообщение</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">Детали</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50">
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('ru-RU')}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${levelColors[log.level] || 'bg-slate-100 text-slate-600'}`}>
                        {levelLabels[log.level] || log.level}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-mono">{log.source}</td>
                    <td className="p-4 text-sm text-slate-900">{log.message}</td>
                    <td className="p-4 text-sm text-slate-500 max-w-[200px] truncate">
                      {log.details && Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Нет системных логов</p>
              <p className="text-xs mt-1 text-slate-400">Логи появятся при запуске сервера, обновлениях и ошибках</p>
            </div>
          )}
        </div>
        
        <p className="text-xs text-slate-400">Всего записей: {filteredLogs.length} из {systemLogs.length}</p>
      </div>
    );
  };

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

      {/* App Branding */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Edit2 className="w-5 h-5 text-slate-400" />
          Брендинг приложения
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Название приложения</label>
            <input
              data-testid="settings-app-name"
              type="text"
              value={settings.app_name || 'Рядом'}
              onChange={(e) => setSettings({...settings, app_name: e.target.value})}
              className="input-field"
              placeholder="Рядом"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Иконка приложения</label>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                {settings.app_icon_url ? (
                  <img 
                    src={settings.app_icon_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${settings.app_icon_url}` : settings.app_icon_url} 
                    alt="" 
                    className="w-12 h-12 object-cover" 
                    onError={(e) => { e.target.style.display='none'; }} 
                  />
                ) : (
                  <Car className="w-6 h-6 text-white" />
                )}
              </div>
              <label 
                data-testid="settings-app-icon-upload"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-green-400 cursor-pointer transition-colors text-sm ${iconUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {iconUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                ) : (
                  <Upload className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-slate-600">{iconUploading ? 'Загрузка...' : 'Загрузить иконку'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  onChange={handleIconUpload}
                  className="hidden"
                />
              </label>
              {settings.app_icon_url && (
                <button
                  onClick={() => setSettings({...settings, app_icon_url: ''})}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Удалить
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">PNG, JPEG, WebP, SVG. Макс. 2 МБ</p>
          </div>
        </div>
        
        {/* Preview */}
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 mb-3">Предпросмотр:</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center overflow-hidden">
              {settings.app_icon_url ? (
                <img 
                  src={settings.app_icon_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${settings.app_icon_url}` : settings.app_icon_url} 
                  alt="" className="w-10 h-10 object-cover" 
                  onError={(e) => { e.target.style.display='none'; }} 
                />
              ) : (
                <Car className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="text-lg font-bold text-slate-900">{settings.app_name || 'Рядом'}</span>
          </div>
        </div>
      </div>

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

            <div className="pt-3 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-2">📱 Android-приложение (отдельный OneSignal app)</p>
              <p className="text-xs text-slate-500 mb-3">Если у вас есть нативное Android-приложение с другим OneSignal app — заполните эти поля. Push будет дублироваться и туда.</p>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  value={settings.onesignal_android_app_id || ''}
                  onChange={(e) => setSettings({...settings, onesignal_android_app_id: e.target.value})}
                  className="input-field"
                  placeholder="Android OneSignal App ID (UUID)"
                  data-testid="onesignal-android-app-id"
                />
                <input
                  type="text"
                  value={settings.onesignal_android_api_key || ''}
                  onChange={(e) => setSettings({...settings, onesignal_android_api_key: e.target.value})}
                  className="input-field"
                  placeholder="Android OneSignal REST API Key"
                  data-testid="onesignal-android-api-key"
                />
              </div>
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

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="font-medium text-slate-900">Показывать карту</p>
                <p className="text-xs text-slate-500 mt-1">Если выключено — вместо карты показывается фоновое изображение (блок «Фон карты»)</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  data-testid="settings-map-enabled"
                  type="checkbox"
                  checked={settings.map_enabled !== false}
                  onChange={(e) => setSettings({...settings, map_enabled: e.target.checked})}
                  className="checkbox-custom"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Order Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Настройки заказов</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Опции ETA для водителя (через запятую, в минутах)</label>
              <input
                type="text"
                data-testid="eta-options-input"
                value={settings.eta_options || '1,2,3,5'}
                onChange={(e) => setSettings({...settings, eta_options: e.target.value})}
                className="input-field"
                placeholder="1,2,3,5"
              />
              <p className="text-xs text-slate-400 mt-1">Водитель выберет одну из опций при принятии заказа</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Иконка пина на карте</label>
              {settings.custom_pin_url && (
                <div className="flex items-center gap-3 mb-2">
                  <img src={settings.custom_pin_url?.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + settings.custom_pin_url : settings.custom_pin_url} alt="pin" className="w-8 h-10 object-contain" />
                  <span className="text-xs text-slate-400">Текущий пин</span>
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Загрузить иконку (PNG/SVG, 32x40 px)</span>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  try {
                    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/upload-pin-icon`, {
                      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
                    });
                    const data = await res.json();
                    if (data.url) setSettings({...settings, custom_pin_url: data.url});
                  } catch(err) { alert('Ошибка загрузки'); }
                  e.target.value = '';
                }} />
              </label>
            </div>
          </div>
        </div>

        {/* Map Background */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Фон карты</h3>
          <p className="text-xs text-slate-400 mb-4">Отображается когда ключ карты не задан или карта отключена</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Цвет фона</label>
                <input
                  type="text"
                  value={settings.map_bg_color || '#f8fafc'}
                  onChange={(e) => setSettings({...settings, map_bg_color: e.target.value})}
                  className="input-field"
                  placeholder="#f8fafc"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Цвет сетки</label>
                <input
                  type="text"
                  value={settings.map_grid_color || '#e2e8f0'}
                  onChange={(e) => setSettings({...settings, map_grid_color: e.target.value})}
                  className="input-field"
                  placeholder="#e2e8f0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Фоновое изображение</label>
              {settings.map_bg_image_url && (
                <div className="mb-2 rounded-lg overflow-hidden border border-slate-200" style={{height: 100}}>
                  <img src={settings.map_bg_image_url?.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + settings.map_bg_image_url : settings.map_bg_image_url} alt="bg" className="w-full h-full object-cover" />
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Загрузить изображение (до 5 МБ)</span>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  try {
                    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/upload-map-bg`, {
                      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
                    });
                    const data = await res.json();
                    if (data.url) setSettings({...settings, map_bg_image_url: data.url});
                  } catch(err) { alert('Ошибка загрузки'); }
                  e.target.value = '';
                }} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Размер фона</label>
                <select
                  value={settings.map_bg_size || 'cover'}
                  onChange={(e) => setSettings({...settings, map_bg_size: e.target.value})}
                  className="input-field"
                >
                  <option value="cover">Cover (заполнить)</option>
                  <option value="contain">Contain (вписать)</option>
                  <option value="100% 100%">Растянуть</option>
                  <option value="auto">Оригинальный размер</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Позиция фона</label>
                <select
                  value={settings.map_bg_position || 'center'}
                  onChange={(e) => setSettings({...settings, map_bg_position: e.target.value})}
                  className="input-field"
                >
                  <option value="center">По центру</option>
                  <option value="top">Сверху</option>
                  <option value="bottom">Снизу</option>
                  <option value="left">Слева</option>
                  <option value="right">Справа</option>
                  <option value="top left">Сверху-слева</option>
                  <option value="top right">Сверху-справа</option>
                  <option value="bottom left">Снизу-слева</option>
                  <option value="bottom right">Снизу-справа</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Повтор фона</label>
                <select
                  data-testid="settings-map-bg-repeat"
                  value={settings.map_bg_repeat || 'no-repeat'}
                  onChange={(e) => setSettings({...settings, map_bg_repeat: e.target.value})}
                  className="input-field"
                >
                  <option value="no-repeat">Без повтора</option>
                  <option value="repeat">Повторять</option>
                  <option value="repeat-x">По горизонтали</option>
                  <option value="repeat-y">По вертикали</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Slides & Fuel Stations */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Слайдер на экране входа</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="font-medium text-slate-900">Автопрокрутка</p>
                <p className="text-xs text-slate-500 mt-1">Слайды меняются автоматически</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="settings-slides-autoplay"
                  checked={settings.auth_slides_autoplay !== false}
                  onChange={(e) => setSettings({...settings, auth_slides_autoplay: e.target.checked})}
                  className="checkbox-custom"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Интервал автопрокрутки (сек)</label>
              <input
                type="number"
                min={2}
                max={30}
                value={settings.auth_slides_interval ?? 5}
                onChange={(e) => setSettings({...settings, auth_slides_interval: parseInt(e.target.value) || 5})}
                className="input-field"
                data-testid="settings-slides-interval"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Слайды ({(settings.auth_slides || []).length})</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(settings.auth_slides || []).map((s) => (
                  <div key={s.id} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                    <img
                      src={s.url.startsWith('http') ? s.url : `${process.env.REACT_APP_BACKEND_URL}${s.url}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      data-testid={`delete-slide-${s.id}`}
                      onClick={() => handleAuthSlideDelete(s.id)}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-90 hover:opacity-100"
                      title="Удалить слайд"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <label className="aspect-video rounded-lg border-2 border-dashed border-slate-300 hover:border-green-500 hover:bg-green-50 flex flex-col items-center justify-center cursor-pointer transition text-slate-500 hover:text-green-600" data-testid="upload-slide-btn">
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-xs">Загрузить</span>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAuthSlideUpload}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400 mt-2">Формат: JPG/PNG/WebP, до 5 МБ. Рекомендуется 16:9.</p>
            </div>
          </div>
        </div>

        {/* Fuel stations on map */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Заправки на карте</h3>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="font-medium text-slate-900">Показывать АЗС на карте</p>
              <p className="text-xs text-slate-500 mt-1">Иконки заправок будут отображаться на карте пассажира и водителя (данные из OpenStreetMap)</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                data-testid="settings-show-fuel"
                checked={settings.show_fuel_stations || false}
                onChange={(e) => setSettings({...settings, show_fuel_stations: e.target.checked})}
                className="checkbox-custom"
              />
            </label>
          </div>
        </div>

        {/* PWA */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">PWA — установка приложения</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="font-medium text-slate-900">Предлагать установку</p>
                <p className="text-xs text-slate-500 mt-1">Пользователи увидят предложение установить приложение на телефон/ПК при каждом заходе, пока не установят</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  data-testid="settings-pwa-enabled"
                  type="checkbox"
                  checked={settings.pwa_enabled !== false}
                  onChange={(e) => setSettings({...settings, pwa_enabled: e.target.checked})}
                  className="checkbox-custom"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Короткое имя (на иконке)</label>
              <input
                type="text"
                data-testid="settings-pwa-short-name"
                value={settings.pwa_short_name || ''}
                onChange={(e) => setSettings({...settings, pwa_short_name: e.target.value})}
                className="input-field"
                placeholder="Если пусто — используется название приложения"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Текст предложения установки</label>
              <textarea
                data-testid="settings-pwa-prompt-text"
                value={settings.pwa_prompt_text || ''}
                onChange={(e) => setSettings({...settings, pwa_prompt_text: e.target.value})}
                className="input-field min-h-[70px]"
                placeholder="Установите приложение на главный экран для быстрого доступа"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {['192', '512'].map((size) => (
                <div key={size}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Иконка {size}×{size}</label>
                  {settings[`pwa_icon_${size}_url`] && (
                    <div className="flex items-center gap-3 mb-2">
                      <img
                        src={settings[`pwa_icon_${size}_url`]?.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + settings[`pwa_icon_${size}_url`] : settings[`pwa_icon_${size}_url`]}
                        alt={`icon-${size}`}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                      />
                      <span className="text-xs text-slate-400">Текущая</span>
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Загрузить (PNG)</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      fd.append('size', size);
                      try {
                        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/upload-pwa-icon`, {
                          method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
                        });
                        const data = await res.json();
                        if (data.url) setSettings({...settings, [`pwa_icon_${size}_url`]: data.url});
                      } catch(err) { alert('Ошибка загрузки'); }
                      e.target.value = '';
                    }} />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Call verification */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Регистрация по звонку (SMS.ru)</h3>
          <p className="text-xs text-slate-400 mb-4">При регистрации нового пассажира вместо SMS-кода: пользователь звонит на выданный номер, звонок бесплатный, подтверждение автоматическое. Требуется SMS.ru API Key.</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="font-medium text-slate-900">Включить верификацию звонком</p>
                <p className="text-xs text-slate-500 mt-1">Действует только при регистрации новых пользователей. Существующие входят как раньше.</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  data-testid="settings-call-verify-enabled"
                  type="checkbox"
                  checked={settings.call_verify_enabled || false}
                  onChange={(e) => setSettings({...settings, call_verify_enabled: e.target.checked})}
                  className="checkbox-custom"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Заголовок экрана</label>
              <input
                type="text"
                data-testid="settings-call-verify-title"
                value={settings.call_verify_title || ''}
                onChange={(e) => setSettings({...settings, call_verify_title: e.target.value})}
                className="input-field"
                placeholder="Подтверждение номера телефона"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Текст инструкции ({'{phone}'} — номер пользователя)</label>
              <textarea
                data-testid="settings-call-verify-instruction"
                value={settings.call_verify_instruction || ''}
                onChange={(e) => setSettings({...settings, call_verify_instruction: e.target.value})}
                className="input-field min-h-[80px]"
                placeholder="Вам необходимо позвонить по номеру ниже для подтверждения. Звонок бесплатный..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Таймер, сек</label>
                <input
                  type="number"
                  data-testid="settings-call-verify-timeout"
                  value={settings.call_verify_timeout ?? 300}
                  onChange={(e) => setSettings({...settings, call_verify_timeout: parseInt(e.target.value) || 300})}
                  className="input-field"
                  min={60}
                  max={600}
                />
                <p className="text-xs text-slate-400 mt-1">Время на звонок</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Опрос, сек</label>
                <input
                  type="number"
                  data-testid="settings-call-verify-poll"
                  value={settings.call_verify_poll_interval ?? 3}
                  onChange={(e) => setSettings({...settings, call_verify_poll_interval: parseInt(e.target.value) || 3})}
                  className="input-field"
                  min={2}
                  max={30}
                />
                <p className="text-xs text-slate-400 mt-1">Частота проверки статуса</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Лимит, сек</label>
                <input
                  type="number"
                  data-testid="settings-call-verify-rate-limit"
                  value={settings.call_verify_rate_limit ?? 60}
                  onChange={(e) => setSettings({...settings, call_verify_rate_limit: parseInt(e.target.value) || 60})}
                  className="input-field"
                  min={10}
                  max={3600}
                />
                <p className="text-xs text-slate-400 mt-1">Пауза между запросами</p>
              </div>
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
            
            <div className="flex gap-3 pt-2">
              <button
                data-testid="test-smtp-btn"
                onClick={async () => {
                  try {
                    const res = await api('POST', '/admin/test-smtp');
                    alert(res.message || 'Тестовое письмо отправлено!');
                  } catch (e) {
                    alert(e.response?.data?.detail || 'Ошибка отправки');
                  }
                }}
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"
              >
                Тест SMTP
              </button>
              <button
                data-testid="test-push-btn"
                onClick={async () => {
                  try {
                    const res = await api('POST', '/admin/test-push');
                    alert(res.message || 'Тестовый push отправлен!');
                  } catch (e) {
                    alert(e.response?.data?.detail || 'OneSignal не настроен');
                  }
                }}
                className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100"
              >
                Тест Push
              </button>
              <button
                data-testid="push-diag-btn"
                onClick={async () => {
                  const uid = prompt('Введите user ID или External ID для диагностики:');
                  if (!uid) return;
                  try {
                    const res = await api('GET', `/admin/push-diagnostics/${encodeURIComponent(uid.trim())}`);
                    const w = window.open('', '_blank', 'width=900,height=700');
                    if (w) {
                      const sub = (res.onesignal_subscriptions || [])[0] || {};
                      let summary = '';
                      if (sub.enabled === false && sub.notification_types === -2) {
                        summary = '<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px;border-radius:8px;margin-bottom:12px"><b>⚠ Пользователь ЗАБЛОКИРОВАЛ уведомления в браузере.</b><br/>Когда появился запрос разрешения — он нажал «Block». Push доставлять некуда.<br/>Чтобы исправить: открыть замок в адресной строке → разрешения → уведомления → Allow.</div>';
                      } else if (sub.enabled === false && (sub.notification_types === -99 || sub.notification_types === -22)) {
                        summary = '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:12px;border-radius:8px;margin-bottom:12px"><b>Разрешение получено, но подписка не завершена.</b><br/>SDK не вызвал <code>PushSubscription.optIn()</code>. Это исправлено в новой версии — обновите страницу.</div>';
                      } else if (sub.enabled === false) {
                        summary = '<div style="background:#fef3c7;border:1px solid #fde68a;color:#854d0e;padding:12px;border-radius:8px;margin-bottom:12px"><b>Подписка существует, но disabled.</b><br/>Скорее всего токен устарел или service worker не активен.</div>';
                      } else if (!sub.token) {
                        summary = '<div style="background:#fef3c7;border:1px solid #fde68a;color:#854d0e;padding:12px;border-radius:8px;margin-bottom:12px"><b>Нет push-токена.</b> Подписка ещё не завершилась.</div>';
                      } else if (sub.enabled === true) {
                        summary = '<div style="background:#dcfce7;border:1px solid #86efac;color:#166534;padding:12px;border-radius:8px;margin-bottom:12px"><b>✓ Подписка активна. Push должен доходить.</b></div>';
                      } else {
                        summary = '<div style="background:#e0e7ff;border:1px solid #c7d2fe;color:#3730a3;padding:12px;border-radius:8px;margin-bottom:12px">Подписка OneSignal не найдена для этого user_id.</div>';
                      }
                      w.document.write(`<html><head><title>Push Diagnostics</title><style>body{font-family:Inter,sans-serif;padding:24px;max-width:900px;margin:0 auto}pre{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;overflow:auto;font-size:12px}</style></head><body><h2>Push Diagnostics</h2><p style="color:#475569">User: <code>${uid}</code></p>${summary}<h3>Full response</h3><pre>${JSON.stringify(res, null, 2).replace(/</g,'&lt;')}</pre></body></html>`);
                      w.document.close();
                    }
                  } catch (e) {
                    alert(e.response?.data?.detail || e.message || 'Ошибка диагностики');
                  }
                }}
                className="px-4 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100"
              >
                Диагностика
              </button>
            </div>
          </div>
        </div>

        {/* Notifications routing (push / sms / per-event) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Уведомления о заказах</h3>
          <p className="text-sm text-slate-500 mb-4">Куда отправлять уведомления и какие события дублировать в SMS.</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Канал по умолчанию</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'push', label: 'Только Push', hint: 'Бесплатно' },
                { v: 'sms', label: 'Только SMS', hint: 'Платно' },
                { v: 'both', label: 'Push + SMS', hint: 'Дублировать' },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setSettings({ ...settings, notification_channel: opt.v })}
                  data-testid={`notif-channel-${opt.v}`}
                  className={`p-3 rounded-lg border text-left transition ${
                    (settings.notification_channel || 'push') === opt.v
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.hint}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {(settings.notification_channel || 'push') === 'push' && 'Push дойдёт тем, кто разрешил уведомления. Тем кто не подписан — никаких уведомлений.'}
              {settings.notification_channel === 'sms' && 'Все уведомления уйдут SMS на номер из профиля. Push отключен.'}
              {settings.notification_channel === 'both' && 'Сначала push, дополнительно SMS. Подходит для критичных событий.'}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">События для SMS</p>
            <p className="text-xs text-slate-500 mb-3">
              {(settings.notification_channel || 'push') === 'push'
                ? 'Отметьте события, которые ДОЛЖНЫ доходить ВСЕГДА (SMS дублирует push на этих событиях).'
                : 'Эти события точно уйдут SMS.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'order_created_driver', label: 'Водитель: новая заявка' },
                { key: 'order_accepted_customer', label: 'Клиент: водитель найден' },
                { key: 'order_completed_customer', label: 'Клиент: поездка завершена' },
                { key: 'order_cancelled_driver', label: 'Водитель: клиент отменил' },
                { key: 'order_cancelled_customer', label: 'Клиент: водитель отменил' },
                { key: 'order_problem_customer', label: 'Клиент: проблема с заказом' },
                { key: 'order_problem_driver', label: 'Водитель: проблема с заказом' },
                { key: 'driver_activated', label: 'Водитель: аккаунт активирован' },
              ].map(evt => {
                const list = settings.sms_events || [];
                const checked = list.includes(evt.key);
                return (
                  <label
                    key={evt.key}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm cursor-pointer transition ${
                      checked ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      data-testid={`sms-evt-${evt.key}`}
                      onChange={() => {
                        const next = checked ? list.filter(k => k !== evt.key) : [...list, evt.key];
                        setSettings({ ...settings, sms_events: next });
                      }}
                      className="rounded text-green-600"
                    />
                    <span className="text-slate-700">{evt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Режимы работы</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div>
                <p className="font-medium text-slate-900">Тестовый режим</p>
                <p className="text-xs text-slate-500 mt-1">Код 1234 принимается для входа. Тестовые подсказки видны пользователям.</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  data-testid="settings-test-mode"
                  type="checkbox"
                  checked={settings.test_mode !== false}
                  onChange={(e) => setSettings({...settings, test_mode: e.target.checked})}
                  className="checkbox-custom"
                />
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-200">
              <div>
                <p className="font-medium text-slate-900">Режим тех. работ</p>
                <p className="text-xs text-slate-500 mt-1">Пользователи увидят сообщение о тех. работах</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenance_mode || false}
                  onChange={(e) => setSettings({...settings, maintenance_mode: e.target.checked})}
                  className="checkbox-custom"
                />
              </label>
            </div>

            {settings.maintenance_mode && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Текст уведомления</label>
                <textarea
                  value={settings.maintenance_text || ''}
                  onChange={(e) => setSettings({...settings, maintenance_text: e.target.value})}
                  className="input-field min-h-[100px]"
                  placeholder="Ведутся технические работы..."
                />
              </div>
            )}
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

  // ============ FAB BAR MANAGEMENT ============
  const emptyFab = { role: 'customer', label: '', icon_svg: '', title: '', content_html: '', order: 0, is_active: true };

  const handleSaveFab = async () => {
    if (!editingFab) return;
    if (!editingFab.label?.trim()) {
      alert('Введите название кнопки');
      return;
    }
    setFabSaving(true);
    try {
      if (editingFab.id) {
        await api('PUT', `/admin/fab-buttons/${editingFab.id}`, editingFab);
      } else {
        await api('POST', '/admin/fab-buttons', editingFab);
      }
      const fabData = await api('GET', '/admin/fab-buttons');
      setFabButtons(fabData);
      setEditingFab(null);
    } catch (e) {
      alert(e?.message || 'Ошибка сохранения');
    } finally {
      setFabSaving(false);
    }
  };

  const handleDeleteFab = async (id) => {
    if (!window.confirm('Удалить кнопку?')) return;
    try {
      await api('DELETE', `/admin/fab-buttons/${id}`);
      setFabButtons(fabButtons.filter(b => b.id !== id));
    } catch (e) {
      alert(e?.message || 'Ошибка удаления');
    }
  };

  const handleFabSvgUpload = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/fab-buttons/upload-svg`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка загрузки');
      setEditingFab({ ...editingFab, icon_svg: data.svg });
    } catch (e) {
      alert(e.message || 'Ошибка загрузки SVG');
    }
  };

  const renderFabBar = () => {
    const roleLabel = (r) => r === 'customer' ? 'Клиент' : r === 'driver' ? 'Водитель' : 'Оба';
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Fab-бар</h2>
            <p className="text-sm text-slate-500 mt-1">Настраиваемые кнопки нижнего меню (макс. 3 активных на роль). Первая иконка фиксированная: «Вызвать» / «Заявки».</p>
          </div>
          <button
            onClick={() => setEditingFab({ ...emptyFab })}
            className="btn-primary max-w-xs"
            data-testid="fab-add-btn"
          >
            <Plus className="w-4 h-4 mr-2" /> Добавить
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {fabButtons.length === 0 ? (
            <div className="p-10 text-center text-slate-400">Пока нет настроенных кнопок</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Иконка</th>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Роль</th>
                  <th className="px-4 py-3">Заголовок</th>
                  <th className="px-4 py-3">Порядок</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {fabButtons.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex w-7 h-7 items-center justify-center text-slate-700"
                        dangerouslySetInnerHTML={{ __html: b.icon_svg || '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' }}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{b.label}</td>
                    <td className="px-4 py-3 text-slate-600">{roleLabel(b.role)}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{b.title || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{b.order}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {b.is_active ? 'Активна' : 'Скрыта'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingFab({ ...b })}
                        className="text-slate-600 hover:text-green-600 p-1.5"
                        title="Редактировать"
                        data-testid={`fab-edit-${b.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFab(b.id)}
                        className="text-slate-600 hover:text-red-600 p-1.5 ml-1"
                        title="Удалить"
                        data-testid={`fab-delete-${b.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editingFab && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingFab(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{editingFab.id ? 'Редактировать кнопку' : 'Новая кнопка'}</h3>
                <button onClick={() => setEditingFab(null)} className="p-1.5 rounded-full hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Название (под иконкой)</label>
                <input
                  type="text"
                  value={editingFab.label}
                  onChange={(e) => setEditingFab({ ...editingFab, label: e.target.value })}
                  className="input-field"
                  maxLength={20}
                  placeholder="Например: Рейтинг"
                  data-testid="fab-edit-label"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Для кого</label>
                <select
                  value={editingFab.role}
                  onChange={(e) => setEditingFab({ ...editingFab, role: e.target.value })}
                  className="input-field"
                  data-testid="fab-edit-role"
                >
                  <option value="customer">Клиент</option>
                  <option value="driver">Водитель</option>
                  <option value="both">Оба</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SVG-иконка</label>
                {editingFab.icon_svg && (
                  <div className="mb-2 flex items-center gap-3">
                    <span className="inline-flex w-10 h-10 items-center justify-center bg-slate-100 rounded-lg text-slate-700"
                      dangerouslySetInnerHTML={{ __html: editingFab.icon_svg }}
                    />
                    <button
                      onClick={() => setEditingFab({ ...editingFab, icon_svg: '' })}
                      className="text-xs text-red-600 hover:underline"
                    >Очистить</button>
                  </div>
                )}
                <textarea
                  value={editingFab.icon_svg}
                  onChange={(e) => setEditingFab({ ...editingFab, icon_svg: e.target.value })}
                  className="input-field font-mono text-xs"
                  rows={4}
                  placeholder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>'
                  data-testid="fab-edit-svg"
                />
                <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 text-sm">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Загрузить SVG-файл</span>
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFabSvgUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <p className="text-xs text-slate-400 mt-1">SVG должен использовать <code>currentColor</code> для адаптации к теме.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Заголовок окна (необязательно)</label>
                <input
                  type="text"
                  value={editingFab.title || ''}
                  onChange={(e) => setEditingFab({ ...editingFab, title: e.target.value })}
                  className="input-field"
                  placeholder="Что увидит пользователь при нажатии"
                  data-testid="fab-edit-title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Содержимое (HTML)</label>
                <textarea
                  value={editingFab.content_html || ''}
                  onChange={(e) => setEditingFab({ ...editingFab, content_html: e.target.value })}
                  className="input-field"
                  rows={6}
                  placeholder="<p>Можно использовать HTML: <b>жирный</b>, &lt;a href&gt;ссылки&lt;/a&gt;, списки.</p>"
                  data-testid="fab-edit-content"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Порядок</label>
                  <input
                    type="number"
                    value={editingFab.order || 0}
                    onChange={(e) => setEditingFab({ ...editingFab, order: parseInt(e.target.value || '0', 10) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                  <select
                    value={editingFab.is_active ? '1' : '0'}
                    onChange={(e) => setEditingFab({ ...editingFab, is_active: e.target.value === '1' })}
                    className="input-field"
                  >
                    <option value="1">Активна</option>
                    <option value="0">Скрыта</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingFab(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
                >Отмена</button>
                <button
                  onClick={handleSaveFab}
                  disabled={fabSaving}
                  className="flex-1 btn-primary"
                  data-testid="fab-save-btn"
                >
                  {fabSaving ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============ PROFILE (admin credentials) ============
  const handleSaveCredentials = async () => {
    setCredMsg(null);
    if (!credForm.current_password) {
      setCredMsg({ type: 'error', text: 'Введите текущий пароль' });
      return;
    }
    const wantEmailChange = credForm.new_email && credForm.new_email !== (user?.email || '');
    const wantPasswordChange = !!credForm.new_password;
    if (!wantEmailChange && !wantPasswordChange) {
      setCredMsg({ type: 'error', text: 'Измените email или пароль' });
      return;
    }
    if (wantPasswordChange && credForm.new_password !== credForm.confirm_password) {
      setCredMsg({ type: 'error', text: 'Пароли не совпадают' });
      return;
    }
    setCredSaving(true);
    try {
      const payload = { current_password: credForm.current_password };
      if (wantEmailChange) payload.new_email = credForm.new_email;
      if (wantPasswordChange) payload.new_password = credForm.new_password;
      const res = await api('POST', '/admin/me/credentials', payload);
      setCredMsg({ type: 'success', text: 'Данные обновлены. Используйте новые при следующем входе.' });
      setCredForm({ current_password: '', new_email: res.email || credForm.new_email, new_password: '', confirm_password: '' });
      // Refresh user state so next change in same session detects the new email correctly
      try { await refreshUser?.(); } catch (_) {}
    } catch (e) {
      setCredMsg({ type: 'error', text: e?.message || 'Ошибка обновления' });
    } finally {
      setCredSaving(false);
    }
  };

  const renderProfile = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Профиль администратора</h2>
        <p className="text-sm text-slate-500 mt-1">Смена email и пароля. Для подтверждения операции введите текущий пароль.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Текущий email</label>
          <div className="px-3 py-2 bg-slate-50 rounded-lg text-slate-600 text-sm">{user?.email || '—'}</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Новый email</label>
          <input
            type="email"
            value={credForm.new_email}
            onChange={(e) => setCredForm({ ...credForm, new_email: e.target.value })}
            className="input-field"
            placeholder="new-admin@taxi.local"
            data-testid="profile-email-input"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Новый пароль</label>
            <input
              type="password"
              value={credForm.new_password}
              onChange={(e) => setCredForm({ ...credForm, new_password: e.target.value })}
              className="input-field"
              placeholder="Минимум 6 символов"
              data-testid="profile-password-input"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Подтверждение</label>
            <input
              type="password"
              value={credForm.confirm_password}
              onChange={(e) => setCredForm({ ...credForm, confirm_password: e.target.value })}
              className="input-field"
              placeholder="Повторите пароль"
              data-testid="profile-password-confirm"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <label className="block text-sm font-medium text-slate-700 mb-1">Текущий пароль *</label>
          <input
            type="password"
            value={credForm.current_password}
            onChange={(e) => setCredForm({ ...credForm, current_password: e.target.value })}
            className="input-field"
            placeholder="Введите текущий пароль"
            data-testid="profile-current-password"
            autoComplete="current-password"
          />
        </div>

        {credMsg && (
          <div className={`px-4 py-2 rounded-lg text-sm ${credMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`} data-testid="profile-msg">
            {credMsg.text}
          </div>
        )}

        <button
          onClick={handleSaveCredentials}
          disabled={credSaving}
          className="btn-primary w-full"
          data-testid="profile-save-btn"
        >
          {credSaving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );

  const renderBlockedDevices = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Заблокированные устройства</h2>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Ban className="w-4 h-4" />
          <span>{blockedDevices.filter(d => d.is_blocked).length} заблокировано</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-slate-600">ID устройства</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Причина</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Статус</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Заблокировано</th>
              <th className="text-right p-4 text-sm font-medium text-slate-600">Действия</th>
            </tr>
          </thead>
          <tbody>
            {blockedDevices.map((device) => (
              <tr key={device.device_id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-4">
                  <span className="font-mono text-sm text-slate-900">{device.device_id.slice(0, 16)}...</span>
                </td>
                <td className="p-4 text-sm text-slate-600">{device.reason || '—'}</td>
                <td className="p-4">
                  {device.is_blocked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      <Ban className="w-3 h-3" />
                      Заблокировано
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <Check className="w-3 h-3" />
                      Разблокировано
                    </span>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-500">
                  {device.blocked_at ? new Date(device.blocked_at).toLocaleString('ru-RU') : '—'}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    {device.is_blocked && (
                      <button
                        onClick={() => handleUnblockDevice(device.device_id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                      >
                        <Unlock className="w-4 h-4" />
                        Разблокировать
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {blockedDevices.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <Smartphone className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Нет заблокированных устройств</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderUpdates = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Обновления и модули</h2>

      {/* Upload Update */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-500" />
          Загрузить обновление
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Загрузите ZIP-архив с обновлением. Архив может содержать папки <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">backend/</code> и/или <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">frontend/</code>
        </p>

        <label 
          data-testid="update-upload-btn"
          className={`flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            updateUploading ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
          }`}
        >
          {updateUploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          ) : (
            <Archive className="w-8 h-8 text-slate-400" />
          )}
          <span className="text-sm text-slate-600 font-medium">
            {updateUploading ? 'Загрузка и применение...' : 'Нажмите для выбора ZIP-архива'}
          </span>
          <span className="text-xs text-slate-400">Макс. 100 МБ</span>
          <input
            type="file"
            accept=".zip"
            onChange={handleUpdateUpload}
            className="hidden"
            disabled={updateUploading}
          />
        </label>

        {updateResult && (
          <div className={`mt-4 p-4 rounded-xl ${updateResult.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-medium text-sm ${updateResult.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {updateResult.type === 'success' ? 'Обновление применено!' : 'Ошибка'}
            </p>
            <p className={`text-sm mt-1 ${updateResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {updateResult.message}
            </p>
            {updateResult.parts && updateResult.parts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {updateResult.parts.map((part, i) => (
                  <span key={i} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">{part}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-xs font-medium text-slate-600 mb-2">Структура ZIP-архива:</p>
          <pre className="text-xs text-slate-500 font-mono leading-relaxed">{`update.zip
├── backend/          (файлы бэкенда)
│   ├── server.py
│   └── requirements.txt
└── frontend/         (файлы фронтенда)
    ├── build/        (готовая сборка)
    └── src/          (или исходники)`}</pre>
        </div>
      </div>

      {/* Modules */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-500" />
            Модули
          </h3>
          <button 
            data-testid="add-module-btn"
            onClick={() => setShowAddModule(!showAddModule)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить модуль
          </button>
        </div>

        {showAddModule && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                data-testid="module-name-input"
                type="text"
                placeholder="Название модуля"
                value={newModule.name}
                onChange={(e) => setNewModule({...newModule, name: e.target.value})}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Описание"
                value={newModule.description}
                onChange={(e) => setNewModule({...newModule, description: e.target.value})}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Версия"
                value={newModule.version}
                onChange={(e) => setNewModule({...newModule, version: e.target.value})}
                className="input-field"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-2">ZIP-архив модуля (опционально)</label>
              <input
                data-testid="module-file-input"
                type="file"
                accept=".zip"
                id="moduleFileInput"
                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                data-testid="save-module-btn"
                onClick={() => {
                  const fileInput = document.getElementById('moduleFileInput');
                  const file = fileInput?.files?.[0];
                  handleAddModule(file);
                }}
                disabled={!newModule.name.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Сохранить
              </button>
              <button onClick={() => setShowAddModule(false)} className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700">
                Отмена
              </button>
            </div>
          </div>
        )}

        {modules.length > 0 ? (
          <div className="space-y-3">
            {modules.map(mod => (
              <div key={mod.id} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${mod.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mod.enabled ? 'bg-purple-100' : 'bg-slate-200'}`}>
                    <Package className={`w-5 h-5 ${mod.enabled ? 'text-purple-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${mod.enabled ? 'text-slate-900' : 'text-slate-400'}`}>{mod.name}</p>
                    <p className="text-xs text-slate-400">
                      {mod.description || 'Без описания'} &middot; v{mod.version}
                      {mod.filename && <span className="ml-2 text-purple-500">&middot; {mod.filename}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`p-2 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-500 transition-colors cursor-pointer ${moduleUploading === mod.id ? 'opacity-50 pointer-events-none' : ''}`} title="Загрузить архив">
                    {moduleUploading === mod.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => {
                        handleModuleFileUpload(mod.id, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    data-testid={`toggle-module-${mod.id}`}
                    onClick={() => handleToggleModule(mod.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    title={mod.enabled ? 'Отключить' : 'Включить'}
                  >
                    {mod.enabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                  </button>
                  <button
                    data-testid={`delete-module-${mod.id}`}
                    onClick={() => handleDeleteModule(mod.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Модули не установлены</p>
            <p className="text-xs mt-1">Нажмите «Добавить модуль» для начала</p>
          </div>
        )}
      </div>

      {/* Update history */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          История обновлений
        </h3>

        {updates.length > 0 ? (
          <div className="space-y-3">
            {updates.map(upd => (
              <div key={upd.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{upd.filename}</p>
                    <p className="text-xs text-slate-400">
                      {upd.files_count} файлов &middot; {upd.parts?.join(', ') || '—'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(upd.applied_at).toLocaleString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Обновлений пока не было</p>
          </div>
        )}
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Обзор' },
    { id: 'map', icon: Map, label: 'Карта' },
    { id: 'customers', icon: Users, label: 'Пассажиры' },
    { id: 'drivers', icon: Car, label: 'Водители' },
    { id: 'orders', icon: ClipboardList, label: 'Заказы' },
    { id: 'devices', icon: Smartphone, label: 'Устройства' },
    { id: 'updates', icon: Package, label: 'Обновления' },
    { id: 'logs', icon: MessageSquare, label: 'Логи' },
    { id: 'syslog', icon: AlertTriangle, label: 'Системные' },
    { id: 'notifications', icon: Bell, label: 'Уведомления' },
    { id: 'settings', icon: Settings, label: 'Настройки' },
    { id: 'fabbar', icon: Plus, label: 'Fab-бар' },
    { id: 'profile', icon: Key, label: 'Профиль' },
  ];

  const activeItem = navItems.find(n => n.id === activeTab);
  return (
    <div className="admin-container">
      {/* Mobile topbar */}
      <div className="admin-topbar">
        <button
          data-testid="admin-burger"
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center"
          aria-label="Меню"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          {activeItem?.icon && <activeItem.icon className="w-4 h-4 text-slate-500" />}
          <span className="font-semibold text-slate-900 text-sm">{activeItem?.label || 'Админ'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-600"
          aria-label="Выйти"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-6 admin-shell">
        {sidebarOpen && (
          <div
            className="admin-sidebar-backdrop lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar */}
        <div className={`admin-sidebar flex-shrink-0 lg:sticky lg:top-6 self-start ${sidebarOpen ? 'open' : ''}`}>
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900">Такси</p>
              <p className="text-xs text-slate-500">Админ-панель</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              aria-label="Закрыть меню"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
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
              {activeTab === 'devices' && renderBlockedDevices()}
              {activeTab === 'logs' && renderLogs()}
              {activeTab === 'syslog' && renderSystemLogs()}
              {activeTab === 'notifications' && renderNotifications()}
              {activeTab === 'settings' && renderSettings()}
              {activeTab === 'fabbar' && renderFabBar()}
              {activeTab === 'profile' && renderProfile()}
              {activeTab === 'updates' && renderUpdates()}
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
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateUser(editingUser)}
                  className="btn-primary flex-1"
                >
                  Сохранить
                </button>
                <button
                  data-testid="delete-user-btn"
                  onClick={() => setDeletingUser({ id: editingUser, phone: editForm.phone, name: editForm.name })}
                  className="px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center gap-2 font-medium"
                  title="Удалить пользователя"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </div>
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

      {/* Delete User Confirmation */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" data-testid="delete-user-modal">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Удалить навсегда?</h3>
                <p className="text-sm text-slate-500">Действие необратимо</p>
              </div>
            </div>
            <div className="p-5 space-y-3 text-sm text-slate-600">
              <p>
                Будет удалён пользователь <span className="font-medium text-slate-900">{deletingUser.name || deletingUser.phone || '—'}</span>.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-500">
                <li>Все связанные заказы клиента будут удалены</li>
                <li>Для водителя — заказы сохранятся, но без привязки</li>
                <li>Логи, уведомления, коды подтверждения — удалены</li>
              </ul>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-2">
              <button
                data-testid="cancel-delete-user"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                data-testid="confirm-delete-user"
                onClick={() => handleDeleteUser(deletingUser.id)}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
