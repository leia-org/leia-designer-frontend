import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CreateLeia } from '../screens/CreateLeia';
import { ChatManager } from '../screens/ChatManager';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <CreateLeia />
      } />
      <Route path="/chat" element={
        <ChatManager />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const LoginForm = () => {
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await login({ email, password });
    } catch (err) {
      setError('Credenciales inválidas');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Iniciar Sesión
      </button>
    </form>
  );
}; 