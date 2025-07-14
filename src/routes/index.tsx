import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context';
import { CreateLeia } from '../screens/CreateLeia';
import { Chat } from '../screens/Chat';
import { Login } from '../screens/Login';
import { Profile } from '../screens/Profile';

const AuthenticatedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  if (!user || !user.role || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <AuthenticatedRoute>
          <CreateLeia />
        </AuthenticatedRoute>
      } />
      <Route path="/chat" element={
        <AuthenticatedRoute>
          <Chat />
        </AuthenticatedRoute>
      } />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={
        <AuthenticatedRoute>
          <Profile />
        </AuthenticatedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};