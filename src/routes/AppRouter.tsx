import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from '../screens/Login'
import { Dashboard } from '../screens/Dashboard'
import { AuthProvider } from '../context'
import { ProtectedRoute } from '../components/ProtectedRoute'

export const AppRouter = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}
