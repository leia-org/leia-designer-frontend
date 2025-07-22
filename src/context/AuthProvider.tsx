import React, { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { AuthContext, type AuthContextType } from './AuthContext';
import type { DecodedToken } from '../models';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const isTokenExpired = (token: string): boolean => {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  };

  const decodeToken = (token: string): DecodedToken | null => {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    const decoded = decodeToken(newToken);
    setUser(decoded);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    
    if (storedToken) {
      if (isTokenExpired(storedToken)) {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } else {
        const decoded = decodeToken(storedToken);
        setToken(storedToken);
        setUser(decoded);
      }
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (isTokenExpired(token)) {
        logout();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [token, logout]);

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
