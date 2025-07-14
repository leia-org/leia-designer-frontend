import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuthContextType, AuthState, LoginCredentials } from '../models/Auth';
import { loginUser, logoutUser, getCurrentUser } from '../lib/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  });

  useEffect(() => {
    const user = getCurrentUser();
    setState({
      user,
      isAuthenticated: !!user,
      isLoading: false
    });
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const user = await loginUser(credentials);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = () => {
    logoutUser();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}; 