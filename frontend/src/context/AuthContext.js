import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AuthContext = createContext(null);

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

  const axiosInstance = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

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
    const response = await axios.post(`${API}/auth/send-code`, { phone, role });
    return response.data;
  };

  const verifyCode = async (phone, code, role) => {
    const response = await axios.post(`${API}/auth/verify-code`, { phone, code, role });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('taxi_token', newToken);
    localStorage.setItem('taxi_role', role);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const registerDriver = async (data) => {
    const response = await axios.post(`${API}/auth/register-driver`, data);
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
      sendCode,
      verifyCode,
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
