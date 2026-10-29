import { useState } from 'react';
import Login from './Login';
import Register from './Register';
import './Auth.css';

const AuthPage = ({ onLoginSuccess }) => {
  const [currentView, setCurrentView] = useState('login'); // 'login' o 'register'

  const handleLoginSuccess = (userData) => {
    if (onLoginSuccess) {
      onLoginSuccess(userData);
    }
  };

  const handleRegisterSuccess = (userData) => {
    // Después del registro exitoso, redirigir al login o iniciar sesión automáticamente
    alert('Registro exitoso. Por favor inicie sesión.');
    setCurrentView('login');
  };

  return (
    <>
      {currentView === 'login' ? (
        <Login 
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={() => setCurrentView('register')}
        />
      ) : (
        <Register 
          onSuccess={handleRegisterSuccess}
          onSwitchToLogin={() => setCurrentView('login')}
        />
      )}
    </>
  );
};

export default AuthPage;
