import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('elister_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    const cachedUser = localStorage.getItem('elister_user');
    return !cachedUser;
  });

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await authService.getMe();
        if (res.data?.data) {
          setUser(res.data.data);
          try {
            localStorage.setItem('elister_user', JSON.stringify(res.data.data));
          } catch {}
        }
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('elister_user');
          setUser(null);
        }
      }
    } else {
      setUser(null);
      localStorage.removeItem('elister_user');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    let deviceId = localStorage.getItem('elister_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('elister_device_id', deviceId);
    }
    const res = await authService.login({ email, password, deviceId });
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
      if (res.data.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('elister_user', JSON.stringify(res.data.user));
        } catch {}
      }
    }
    return res.data;
  };

  const signup = async (userData) => {
    const res = await authService.signup(userData);
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
      if (res.data.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('elister_user', JSON.stringify(res.data.user));
        } catch {}
      }
    }
    return res.data;
  };

  const verifyOtp = async (email, otp) => {
    let deviceId = localStorage.getItem('elister_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('elister_device_id', deviceId);
    }
    const res = await authService.verifyOtp({ email, otp, deviceId });
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
      if (res.data.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('elister_user', JSON.stringify(res.data.user));
        } catch {}
      }
    }
    return res.data;
  };

  const resendOtp = async (email) => {
    const res = await authService.resendOtp({ email });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('elister_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, loadUser, verifyOtp, resendOtp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
