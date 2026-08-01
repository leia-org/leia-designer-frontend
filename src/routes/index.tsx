import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useAuth } from "../context";
import { CreateLeia } from "../screens/CreateLeia";
import { Chat } from "../screens/Chat";
import { Edit } from "../screens/Edit";
import { Login } from "../screens/Login";
import { Register } from "../screens/Register";
import { Profile } from "../screens/Profile";
import { ForbiddenPage } from "../screens/ForbiddenPage";
import { LeiaSearch } from "../screens/LeiaSearch";
import { LeiaDrafts } from "../screens/LeiaDrafts";
import { UserManagement } from "../screens/UserManagement";
import { MyActivities } from "../screens/MyActivities";
import { ApiKeysPage } from "../screens/ApiKeys";
import { LabelManagement } from "../screens/LabelManagement.tsx";

const AuthenticatedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LoadingScreen />
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <LoadingScreen />
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
const AdvancedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!["admin", "advanced"].includes(user?.role ?? "")) return <ForbiddenPage />;

  return <>{children}</>;
};

const LoadingScreen = () => (
  <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
    <CircularProgress size={28} />
    <Typography color="text.secondary">Loading...</Typography>
  </Stack>
);

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
      <Route
        path="/edit/:sessionId"
        element={
          <AuthenticatedRoute>
            <Edit />
          </AuthenticatedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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
        path="/drafts"
        element={
          <AuthenticatedRoute>
            <LeiaDrafts />
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/api-keys"
        element={
          <AuthenticatedRoute>
            <ApiKeysPage />
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Box sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom>Admin Dashboard</Typography>
              <Typography color="text.secondary">This is an admin-only area.</Typography>
            </Box>
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
          <AdvancedRoute>
            <MyActivities />
          </AdvancedRoute>
        }
      />
      <Route
        path="/administration/labels"
        element={
          <AdminRoute>
            <LabelManagement />
          </AdminRoute>
        }
      />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
