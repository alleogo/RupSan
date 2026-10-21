import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Restore the stored session immediately so pages don't redirect to login before validation finishes
  const [user, setUser] = useState(() => {
    try {
      return localStorage.getItem('token') ? JSON.parse(localStorage.getItem('user')) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate stored session against the backend on startup
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      // Verify the token is still valid and refresh the stored user details
      api.get('/auth/me')
        .then((res) => {
          // Only update when the details changed, so pages that depend on `user` don't refetch
          const fresh = res.data.success && res.data.user ? JSON.stringify(res.data.user) : null;
          if (fresh && fresh !== localStorage.getItem('user')) {
            localStorage.setItem('user', fresh);
            setUser(res.data.user);
          }
        })
        .catch(() => {
          // Token is expired or invalid — clear the stale session
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user: userData } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return { success: true, message: response.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
