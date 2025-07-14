import { BrowserRouter as Router } from 'react-router-dom'
import { AuthProvider } from './context'
import { AppRoutes } from './routes'

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
