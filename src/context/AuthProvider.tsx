import React, { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { AuthContext, type AuthContextType } from "./AuthContext";
import type { DecodedToken } from "../models";
import { setAuthToken } from "../lib/authToken";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const decodeToken = (token: string): DecodedToken | null => {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  const login = useCallback((newToken: string) => {
    setAuthToken(newToken);
    setToken(newToken);
    const decoded = decodeToken(newToken);
    setUser(decoded);
  }, []);

  const clearLocalSession = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const syncSession = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/session`,
        { credentials: "include" },
      );
      if (!response.ok) {
        clearLocalSession();
        return false;
      }

      const data = await response.json() as { token?: string };
      if (!data.token) {
        clearLocalSession();
        return false;
      }

      login(data.token);
      return true;
    } catch (error) {
      console.error("Error synchronizing Auth session:", error);
      return false;
    }
  }, [clearLocalSession, login]);

  const logout = useCallback(() => {
    void fetch(
      `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/logout`,
      { method: "POST", credentials: "include" },
    ).catch((error) => console.error("Error closing Auth session:", error));
    clearLocalSession();
    navigate("/login");
  }, [clearLocalSession, navigate]);

  useEffect(() => {
    localStorage.removeItem("token");
    void syncSession().finally(() => setIsLoading(false));
  }, [syncSession]);

  useEffect(() => {
    const refresh = () => void syncSession();
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [syncSession]);

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
