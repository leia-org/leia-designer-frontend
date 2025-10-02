import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context";
import { CreateLeia } from "../screens/CreateLeia";
import { Chat } from "../screens/Chat";
import { Login } from "../screens/Login";
import { Profile } from "../screens/Profile";
import { ForbiddenPage } from "../screens/ForbiddenPage";
import { LeiaSearch } from "../screens/LeiaSearch";
import { UserManagement } from "../screens/UserManagement";
import { MyActivities } from "../screens/MyActivities";

const AuthenticatedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "admin") {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthenticatedRoute>
            <LeiaSearch />
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/chat/:sessionId"
        element={
          <AuthenticatedRoute>
            <Chat />
          </AuthenticatedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route
        path="/profile"
        element={
          <AuthenticatedRoute>
            <Profile />
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/create"
        element={
          <AuthenticatedRoute>
            <CreateLeia />
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <div className="p-8">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p>This is an admin-only area.</p>
            </div>
          </AdminRoute>
        }
      />
      <Route
        path="/administration/users"
        element={
          <AdminRoute>
            <UserManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/users/me/activities"
        element={
          <AuthenticatedRoute>
            <MyActivities />
          </AuthenticatedRoute>
        }
      />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
