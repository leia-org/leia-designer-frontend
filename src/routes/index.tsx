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

// ... imports
import { Layout } from "../components/layout";

// ... Routes ...

export const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthenticatedRoute>
            <Layout title="Dashboard">
              <LeiaSearch />
            </Layout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/chat/:sessionId"
        element={
          <AuthenticatedRoute>
            <Layout title="Chat Session">
              <Chat />
            </Layout>
          </AuthenticatedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route
        path="/profile"
        element={
          <AuthenticatedRoute>
            <Layout title="Profile">
              <Profile />
            </Layout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/create"
        element={
          <AuthenticatedRoute>
            <Layout title="Create New Exercise">
              <CreateLeia />
            </Layout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Layout title="Administration">
              <div className="p-8">
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p>This is an admin-only area.</p>
              </div>
            </Layout>
          </AdminRoute>
        }
      />
      <Route
        path="/administration/users"
        element={
          <AdminRoute>
            <Layout title="User Management">
              <UserManagement />
            </Layout>
          </AdminRoute>
        }
      />
      <Route
        path="/users/me/activities"
        element={
          <AdminRoute>
            <Layout title="My Activities">
              <MyActivities />
            </Layout>
          </AdminRoute>
        }
      />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
