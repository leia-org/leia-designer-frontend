import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Hello World</h1>
          <p className="text-gray-600">Tu aplicación está lista</p>
        </div>
      </div>
    </Router>
  )
}

export default App
