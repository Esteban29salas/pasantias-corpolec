import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Inicio from './components/Inicio';
import Inventario from './components/Inventario';
import Personal from './components/Personal';
import CierreAnual from './components/CierreAnual';
import Liberaciones from './components/Liberaciones';
import AuthPage from './components/Auth/AuthPage';
import { TOKEN_KEY, USER_KEY } from './services/api';

function leerUsuarioGuardado() {
  try {
    const guardado = localStorage.getItem(USER_KEY);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return null;
  }
}

function PaginaLiberaciones({ user }) {
  const navigate = useNavigate();

  return (
    <Liberaciones
      isOpen
      user={user}
      onClose={() => navigate('/inventario')}
    />
  );
}

function App() {
  const [user, setUser] = useState(leerUsuarioGuardado);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY))
  );

  const esAdmin = user?.rol === 'admin';

  const handleLoginSuccess = (userData) => {
    if (userData.token) {
      localStorage.setItem(TOKEN_KEY, userData.token);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
        <Route
          path="/personal"
          element={esAdmin ? <Personal user={user} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/liberaciones"
          element={esAdmin ? <PaginaLiberaciones user={user} /> : <Navigate to="/" replace />}
        />
        <Route path="/cierre-anual" element={<CierreAnual user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
