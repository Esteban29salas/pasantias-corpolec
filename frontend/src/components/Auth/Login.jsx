import { useState } from 'react';
import './Auth.css';

const Login = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        if (!value.trim()) {
          return 'El correo / usuario es obligatorio';
        }
        if (!emailRegex.test(value.trim())) {
          return 'Formato de correo electrónico inválido (ejemplo@dominio.com)';
        }
        return '';
      case 'password':
        if (!value.trim()) {
          return 'La contraseña es obligatoria';
        }
        if (value.length < 8) {
          return 'La contraseña debe tener mínimo 8 caracteres';
        }
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar mensajes de error al corregir
    if (touched[name]) {
      const errorMsg = validateField(name, value);
      setErrors(prev => ({
        ...prev,
        [name]: errorMsg
      }));
    }
    
    setGeneralError('');
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    const errorMsg = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: errorMsg
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const errorMsg = validateField(key, formData[key]);
      if (errorMsg) {
        newErrors[key] = errorMsg;
      }
    });
    setErrors(newErrors);
    setTouched({
      email: true,
      password: true
    });
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return formData.email.trim() && formData.password.trim() && 
           emailRegex.test(formData.email.trim()) && 
           formData.password.length >= 8 && 
           Object.values(errors).every(error => !error || error.trim() === '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/usuarios/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        const userData = {
          email: data.email,
          cedula: data.cedula,
          nombreCompleto: `${data.nombres} ${data.apellidos}`,
          rol: data.rol,
          autenticado: true,
          ...data
        };
        
        console.log('Login exitoso:', userData);
        
        if (onLoginSuccess) {
          onLoginSuccess(userData);
        }
      } else {
        setGeneralError(data.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setGeneralError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Iniciar Sesión</h2>
          <p>Sistema de Gestión de Almacén - Corpoelec</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {generalError && <div className="error-message">{generalError}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Correo / Usuario *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Ejemplo: usuario@corpolec.com"
              style={errors.email && touched.email ? { borderColor: '#DC2626' } : {}}
            />
            {errors.email && touched.email && (
              <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                {errors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Contraseña *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Ingrese su contraseña"
              style={errors.password && touched.password ? { borderColor: '#DC2626' } : {}}
            />
            {errors.password && touched.password && (
              <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                {errors.password}
              </span>
            )}
          </div>

          <button 
            type="submit" 
            className="submit-btn" 
            disabled={loading || !isFormValid()}
            style={(loading || !isFormValid()) ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        {onSwitchToRegister && (
          <div className="auth-footer">
            ¿No tienes una cuenta?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToRegister(); }}>
              Crear Cuenta
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
