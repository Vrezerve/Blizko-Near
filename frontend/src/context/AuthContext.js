import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AuthContext = createContext(null);

// Generate or get persistent device ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem('taxi_device_id');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('taxi_device_id', deviceId);
  }
  return deviceId;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('taxi_token'));
  const [deviceId] = useState(getDeviceId());

  const checkAuth = useCallback(async () => {
    const storedToken = localStorage.getItem('taxi_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      setUser(response.data);
      setToken(storedToken);
    } catch (error) {
      localStorage.removeItem('taxi_token');
      localStorage.removeItem('taxi_role');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const sendCode = async (phone, role) => {
    const response = await axios.post(`${API}/auth/send-code`, { 
      phone, 
      role,
      device_id: deviceId 
    });
    return response.data;
  };

  const verifyCode = async (phone, code, role) => {
    const response = await axios.post(`${API}/auth/verify-code`, { 
      phone, 
      code, 
      role,
      device_id: deviceId 
    });
    const { token: newToken, user: userData, has_pin } = response.data;
    localStorage.setItem('taxi_token', newToken);
    localStorage.setItem('taxi_role', role);
    if (has_pin) {
      localStorage.setItem('taxi_has_pin', 'true');
      localStorage.setItem('taxi_pin_phone', phone);
      localStorage.setItem('taxi_pin_role', role);
    }
    setToken(newToken);
    setUser(userData);
    return { user: userData, has_pin };
  };

  const setPin = async (pin) => {
    const authToken = token || localStorage.getItem('taxi_token');
    const response = await axios.post(`${API}/auth/set-pin`, { pin }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    localStorage.setItem('taxi_has_pin', 'true');
    if (user) {
      localStorage.setItem('taxi_pin_phone', user.phone);
      localStorage.setItem('taxi_pin_role', user.role);
    }
    return response.data;
  };

  const loginWithPin = async (phone, pin, role) => {
    const response = await axios.post(`${API}/auth/login-pin`, {
      phone, pin, role, device_id: deviceId
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('taxi_token', newToken);
    localStorage.setItem('taxi_role', role);
    localStorage.setItem('taxi_has_pin', 'true');
    localStorage.setItem('taxi_pin_phone', phone);
    localStorage.setItem('taxi_pin_role', role);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const checkHasPin = async (phone, role) => {
    const response = await axios.get(`${API}/auth/check-pin/${encodeURIComponent(phone)}/${role}`);
    return response.data;
  };

  const applyAuthResult = (newToken, userData, role, hasPin) => {
    localStorage.setItem('taxi_token', newToken);
    localStorage.setItem('taxi_role', role);
    if (hasPin) {
      localStorage.setItem('taxi_has_pin', 'true');
      localStorage.setItem('taxi_pin_phone', userData.phone);
      localStorage.setItem('taxi_pin_role', role);
    }
    setToken(newToken);
    setUser(userData);
  };

  const resetPinRequest = async (phone, role) => {
    const response = await axios.post(`${API}/auth/reset-pin-request`, {
      phone, role, device_id: deviceId
    });
    return response.data;
  };

  const resetPinVerify = async (phone, code, role, newPin) => {
    const response = await axios.post(`${API}/auth/reset-pin-verify`, {
      phone, code, role, device_id: deviceId, new_pin: newPin
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('taxi_token', newToken);
    localStorage.setItem('taxi_role', role);
    localStorage.setItem('taxi_has_pin', 'true');
    localStorage.setItem('taxi_pin_phone', phone);
    localStorage.setItem('taxi_pin_role', role);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const registerDriver = async (data) => {
    const response = await axios.post(`${API}/auth/register-driver`, {
      ...data,
      device_id: deviceId
    });
    return response.data;
  };

  const checkDriverStatus = async (phone) => {
    const response = await axios.post(`${API}/auth/check-driver`, { phone });
    return response.data;
  };

  const adminLogin = async (email, password) => {
    const response = await axios.post(`${API}/admin/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('taxi_token', newToken);
    localStorage.setItem('taxi_role', 'admin');
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    localStorage.removeItem('taxi_token');
    localStorage.removeItem('taxi_role');
    localStorage.removeItem('taxi_has_pin');
    localStorage.removeItem('taxi_pin_phone');
    localStorage.removeItem('taxi_pin_role');
    setToken(null);
    setUser(null);
  };

  const api = useCallback(async (method, endpoint, data = null) => {
    const config = {
      method,
      url: `${API}${endpoint}`,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    };
    if (data) {
      config.data = data;
    }
    const response = await axios(config);
    return response.data;
  }, [token]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      token,
      deviceId,
      sendCode,
      verifyCode,
      applyAuthResult,
      setPin,
      loginWithPin,
      checkHasPin,
      resetPinRequest,
      resetPinVerify,
      registerDriver,
      checkDriverStatus,
      adminLogin,
      logout,
      api,
      refreshUser: checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};
