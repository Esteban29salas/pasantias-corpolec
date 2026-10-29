import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Inicio from './components/Inicio';
import Inventario from './components/Inventario';
import Personal from './components/Personal';
import CierreAnual from './components/CierreAnual';
import AuthPage from './components/Auth/AuthPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Inicio user={user} />} />
        <Route path="/inventario" element={<Inventario user={user} />} />
        <Route path="/personal" element={<Personal user={user} />} />
        <Route path="/cierre-anual" element={<CierreAnual />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;