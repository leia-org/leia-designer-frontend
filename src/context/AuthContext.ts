import { createContext } from 'react';
import type { DecodedToken } from '../models';

export interface AuthContextType {
  token: string | null;
  user: DecodedToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  setUser: (user: DecodedToken | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
