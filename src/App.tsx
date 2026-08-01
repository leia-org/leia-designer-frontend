import { BrowserRouter as Router, useLocation } from 'react-router-dom'
import { Box } from '@mui/material'
import { AuthProvider } from './context'
import { AppRoutes } from './routes'
import { LeiaThemeProvider } from './theme/LeiaThemeProvider'
import { WorkspaceFrame } from './components/shared/WorkspaceFrame'

const AUTH_ROUTES = new Set(['/login', '/register'])
const SIDEBARLESS_ROUTES = new Set(['/create'])

function RoutedApplication() {
  const location = useLocation()

  if (AUTH_ROUTES.has(location.pathname)) {
    return <AppRoutes />
  }

  const isSidebarlessRoute =
    SIDEBARLESS_ROUTES.has(location.pathname) ||
    location.pathname.startsWith('/edit/')

  if (isSidebarlessRoute) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <AppRoutes />
      </Box>
    )
  }

  return (
    <WorkspaceFrame>
      <AppRoutes />
    </WorkspaceFrame>
  )
}

function App() {
  return (
    <LeiaThemeProvider>
      <Router>
        <AuthProvider>
          <RoutedApplication />
        </AuthProvider>
      </Router>
    </LeiaThemeProvider>
  )
}

export default App
