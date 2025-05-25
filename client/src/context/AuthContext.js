import React, { createContext, useState, useEffect, useContext } from 'react';
import axiosInstance, { setAuthToken } from './axiosInstance'; 

export const AuthContext = createContext(); 

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { 
    setAuthToken(token);
  }, [token]);


  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false); 
        return;
      }

      try {
        const res = await axiosInstance.get('/api/auth/me');
        if (!res.data?.data) {
          throw new Error('Invalid user data received');
        }
        setUser(res.data.data);
        setIsAuthenticated(true);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Auth Error:', err.response?.data || err.message); //remove token
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        setError('Session expired. Please log in again.');
      }
    };

    loadUser(); 
  }, [token]);

  const register = async (name, email, password, phone) => {
    const config = { 
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const body = JSON.stringify({ name, email, password, phone });

    try { 
      const res = await axiosInstance.post('/api/auth/register', body, config);
      if (!res.data?.token) { 
        throw new Error('Invalid response from server');
      }
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setIsAuthenticated(true);
      setError(null);
      return res.data;
    } catch (err) {
      console.error('Registration Error:', err.response?.data || err.message);
      const errorMsg =
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' && err.response.data) ||
        'Registration failed. Please try again.';
      setError(errorMsg);
      throw err;
    }
  };

  const login = async (email, password) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const body = JSON.stringify({ email, password });

    try {
      const res = await axiosInstance.post('/api/auth/login', body, config);
      if (!res.data?.token) {
        throw new Error('Invalid response from server');
      }
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setIsAuthenticated(true);
      setError(null);
      return res.data;
    } catch (err) {
      console.error('Login Error:', err.response?.data || err.message);
      const errorMsg =
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' && err.response.data) ||
        'Login failed. Please try again.';
      setError(errorMsg);
      throw err;
    }
  };
  const updateProfile = async (userData) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    try {
      const res = await axiosInstance.put('/api/auth/update', userData, config);
      if (!res.data?.data) {
        throw new Error('Invalid profile update response');
      }
      setUser(res.data.data);
      return res.data;
    } catch (err) {
      console.error('Update Profile Error:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.error || 'Profile update failed';
      setError(errorMsg);
      throw err;
    }
  };
  const changePassword = async (currentPassword, newPassword) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const body = JSON.stringify({ currentPassword, newPassword });

    try {
      const res = await axiosInstance.put('/api/auth/password', body, config);
      return res.data;
    } catch (err) {
      console.error('Password Change Error:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.error || 'Password change failed';
      setError(errorMsg);
      throw err;
    }
  };
  const logout = async () => {
    try {
      await axiosInstance.get('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err.response?.data || err.message);
    }

    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };


  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated,
        loading,
        user,
        error,
        register,
        login,
        logout,
        updateProfile,
        changePassword,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
export default AuthProvider;