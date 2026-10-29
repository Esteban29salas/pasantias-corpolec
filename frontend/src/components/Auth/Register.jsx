import { useState } from 'react';
import './Auth.css';

const Register = ({ onSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    apellidoCompleto: '',
    cedula: '',
    fechaNacimiento: '',
    cargo: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [showAdminSection, setShowAdminSection] = useState(false);
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
  const [rol, setRol] = useState('normal');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');

  // Código de autorización proporcionado por la empresa
  const AUTH_CODE = 'CORPOELEC2026';

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
  const cedulaRegex = /^[0-9]{6,9}$/;
  const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[@#$!]).{8,}$/;

  const validateField = (name, value) => {
    switch (name) {
      case 'nombreCompleto':
        if (!value.trim()) {
          return 'El nombre completo es requerido';
        }
        if (value.trim().length < 2) {
          return 'El nombre debe tener mínimo 2 caracteres';
        }
        if (!nameRegex.test(value.trim())) {
          return 'Solo se permiten letras y espacios';
        }
        return '';
      case 'apellidoCompleto':
        if (!value.trim()) {
          return 'El apellido completo es requerido';
        }
        if (value.trim().length < 2) {
          return 'El apellido debe tener mínimo 2 caracteres';
        }
        if (!nameRegex.test(value.trim())) {
          return 'Solo se permiten letras y espacios';
        }
        return '';
      case 'cedula':
        if (!value.trim()) {
          return 'La cédula es requerida';
        }
        if (!cedulaRegex.test(value.trim())) {
          return 'Solo números, sin puntos ni letras. Entre 6 y 9 dígitos';
        }
        return '';
      case 'fechaNacimiento':
        if (!value) {
          return 'La fecha de nacimiento es requerida';
        }
        const birthDate = new Date(value + 'T00:00:00');
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age < 18) {
          return 'Debe ser mayor de edad (mínimo 18 años)';
        }
        if (birthDate.getFullYear() > today.getFullYear()) {
          return 'El año no puede ser mayor al año actual';
        }
        return '';
      case 'cargo':
        if (!value.trim()) {
          return 'El cargo que posee es requerido';
        }
        if (value.trim().length < 3) {
          return 'El cargo debe tener mínimo 3 caracteres';
        }
        return '';
      case 'email':
        if (!value.trim()) {
          return 'El correo electrónico es requerido';
        }
        if (!emailRegex.test(value.trim())) {
          return 'Formato de correo electrónico inválido (ejemplo@dominio.com)';
        }
        return '';
      case 'password':
        if (!value) {
          return 'La contraseña es requerida';
        }
        if (value.length < 8) {
          return 'Mínimo 8 caracteres';
        }
        if (!/[A-Z]/.test(value)) {
          return 'Debe incluir al menos una letra mayúscula';
        }
        if (!/[0-9]/.test(value)) {
          return 'Debe incluir al menos un número';
        }
        if (!/[@#$!]/.test(value)) {
          return 'Debe incluir al menos un carácter especial (@, #, $, !)';
        }
        return '';
      case 'confirmPassword':
        if (!value) {
          return 'Debe confirmar la contraseña';
        }
        if (value !== formData.password) {
          return 'Las contraseñas no coinciden';
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
    
    // Limpiar mensajes al corregir
    if (touched[name]) {
      const errorMsg = validateField(name, value);
      setErrors(prev => ({
        ...prev,
        [name]: errorMsg
      }));
    }
    
    // Si cambia password, revalidar confirmación
    if (name === 'password' && touched.confirmPassword) {
      const confirmError = formData.confirmPassword !== value ? 'Las contraseñas no coinciden' : '';
      setErrors(prev => ({
        ...prev,
        confirmPassword: confirmError
      }));
    }
    
    setGeneralError('');
    setSuccess('');
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

  const handleAdminToggle = () => {
    if (!showAdminSection) {
      setShowAdminSection(true);
      setRol('normal');
      setCodigoAutorizacion('');
      setErrors(prev => ({ ...prev, codigoAutorizacion: '' }));
    } else {
      setShowAdminSection(false);
      setRol('normal');
      setCodigoAutorizacion('');
      setGeneralError('');
      setSuccess('');
      setErrors(prev => ({ ...prev, codigoAutorizacion: '' }));
    }
  };

  const handleCodigoChange = (e) => {
    const value = e.target.value;
    setCodigoAutorizacion(value);
    setGeneralError('');
    setSuccess('');
    
    if (showAdminSection) {
      if (value.trim() === '') {
        setErrors(prev => ({ ...prev, codigoAutorizacion: 'El código de autorización es obligatorio' }));
        setRol('normal');
      } else if (value === AUTH_CODE) {
        setErrors(prev => ({ ...prev, codigoAutorizacion: '' }));
        setRol('admin');
        setSuccess('Código correcto. Se registrará como Administrador.');
      } else {
        setErrors(prev => ({ ...prev, codigoAutorizacion: 'Código de autorización incorrecto' }));
        setRol('normal');
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const errorMsg = validateField(key, formData[key]);
      if (errorMsg) {
        newErrors[key] = errorMsg;
      }
    });
    
    if (showAdminSection) {
      if (codigoAutorizacion.trim() === '') {
        newErrors.codigoAutorizacion = 'El código de autorización es obligatorio al intentar registrar como administrador';
      } else if (codigoAutorizacion !== AUTH_CODE) {
        newErrors.codigoAutorizacion = 'Código de autorización incorrecto';
      }
    }
    
    setErrors(newErrors);
    const allTouched = {};
    Object.keys(formData).forEach(key => { allTouched[key] = true; });
    if (showAdminSection) allTouched.codigoAutorizacion = true;
    setTouched(allTouched);
    
    return Object.keys(newErrors).length === 0;
  };

  const hasErrors = () => {
    return Object.values(errors).some(error => error && error.trim() !== '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setSuccess('');

    if (!validateForm()) {
      setGeneralError('Por favor, corrija los errores en el formulario');
      return;
    }

    // Si seleccionó admin pero código incorrecto
    if (showAdminSection && codigoAutorizacion !== AUTH_CODE) {
      setErrors(prev => ({ ...prev, codigoAutorizacion: 'Código de autorización incorrecto' }));
      setRol('normal');
      setGeneralError('Código de autorización incorrecto. Se registrará como Usuario Normal.');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/usuarios/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cedula: formData.cedula,
          nombres: formData.nombreCompleto,
          apellidos: formData.apellidoCompleto,
          fecha_nacimiento: formData.fechaNacimiento,
          cargo: formData.cargo,
          email: formData.email,
          password: formData.password,
          rol: showAdminSection && codigoAutorizacion === AUTH_CODE ? 'admin' : 'normal'
        })
      });

      const data = await response.json();

      if (response.ok) {
        const userData = {
          ...formData,
          rol: showAdminSection && codigoAutorizacion === AUTH_CODE ? 'admin' : 'normal',
          id: data.id
        };

        console.log('Datos de registro:', userData);
        setSuccess('Registro exitoso!');
        
        if (onSuccess) {
          onSuccess(userData);
        }
      } else {
        // Manejar errores del backend
        if (data.cedula) {
          setErrors(prev => ({ ...prev, cedula: data.cedula[0] }));
        }
        if (data.email) {
          setErrors(prev => ({ ...prev, email: data.email[0] }));
        }
        setGeneralError('Error al registrar usuario. Verifique los datos.');
      }
    } catch (error) {
      console.error('Error en registro:', error);
      setGeneralError('Error al conectar con el servidor');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '650px' }}>
        <div className="auth-header">
          <h2>Crear Cuenta</h2>
          <p>Registro de Usuario - Sistema de Almacén Corpoelec</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {generalError && <div className="error-message">{generalError}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="nombreCompleto">
                Nombre completo *
              </label>
              <input
                type="text"
                id="nombreCompleto"
                name="nombreCompleto"
                className="form-input"
                value={formData.nombreCompleto}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ingrese su nombre completo"
                style={errors.nombreCompleto && touched.nombreCompleto ? { borderColor: '#DC2626' } : {}}
              />
              {errors.nombreCompleto && touched.nombreCompleto && (
                <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {errors.nombreCompleto}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="apellidoCompleto">
                Apellido completo *
              </label>
              <input
                type="text"
                id="apellidoCompleto"
                name="apellidoCompleto"
                className="form-input"
                value={formData.apellidoCompleto}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ingrese su apellido completo"
                style={errors.apellidoCompleto && touched.apellidoCompleto ? { borderColor: '#DC2626' } : {}}
              />
              {errors.apellidoCompleto && touched.apellidoCompleto && (
                <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {errors.apellidoCompleto}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cedula">
                Cédula *
              </label>
              <input
                type="text"
                id="cedula"
                name="cedula"
                className="form-input"
                value={formData.cedula}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: 25123456"
                style={errors.cedula && touched.cedula ? { borderColor: '#DC2626' } : {}}
              />
              {errors.cedula && touched.cedula && (
                <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {errors.cedula}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fechaNacimiento">
                Fecha de nacimiento *
              </label>
              <input
                type="date"
                id="fechaNacimiento"
                name="fechaNacimiento"
                className="form-input"
                value={formData.fechaNacimiento}
                onChange={handleChange}
                onBlur={handleBlur}
                style={errors.fechaNacimiento && touched.fechaNacimiento ? { borderColor: '#DC2626' } : {}}
              />
              {errors.fechaNacimiento && touched.fechaNacimiento && (
                <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {errors.fechaNacimiento}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cargo">
                Cargo que posee *
              </label>
              <input
                type="text"
                id="cargo"
                name="cargo"
                className="form-input"
                value={formData.cargo}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: Ingeniero, Técnico, etc."
                style={errors.cargo && touched.cargo ? { borderColor: '#DC2626' } : {}}
              />
              {errors.cargo && touched.cargo && (
                <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {errors.cargo}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Correo electrónico / Usuario *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ejemplo@dominio.com"
                style={errors.email && touched.email ? { borderColor: '#DC2626' } : {}}
              />
              {errors.email && touched.email && (
                <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {errors.email}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
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
                placeholder="Mínimo 8 caracteres"
                style={errors.password && touched.password ? { borderColor: '#DC2626' } : {}}
              />
              {errors.password && touched.password && (
                <span style={{ color: '#DC2626', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  {errors.password}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirmación de Contraseña *
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="form-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Repita la contraseña"
                style={errors.confirmPassword && touched.confirmPassword ? { borderColor: '#DC2626' } : {}}
              />
              {errors.confirmPassword && touched.confirmPassword && (
                <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {errors.confirmPassword}
                </span>
              )}
            </div>
          </div>

          <div className="admin-section">
            <button
              type="button"
              className={`admin-toggle ${showAdminSection ? 'active' : ''}`}
              onClick={handleAdminToggle}
            >
              {showAdminSection ? 'Cancelar registro como Admin' : 'Admin'}
            </button>

            {showAdminSection && (
              <div className="admin-code-section">
                <label className="admin-code-label" htmlFor="codigoAutorizacion">
                  Código de Autorización (proporcionado por la empresa) *
                </label>
                <input
                  type="text"
                  id="codigoAutorizacion"
                  className="admin-code-input"
                  value={codigoAutorizacion}
                  onChange={handleCodigoChange}
                  placeholder="INGRESE CÓDIGO"
                  maxLength={20}
                  style={errors.codigoAutorizacion && touched.codigoAutorizacion ? { borderColor: '#DC2626' } : {}}
                />
                {errors.codigoAutorizacion && touched.codigoAutorizacion && (
                  <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {errors.codigoAutorizacion}
                  </span>
                )}
                <div className={`role-indicator ${rol}`}>
                  {rol === 'admin' ? '✓ Se registrará como: Administrador' : '• Se registrará como: Usuario Normal'}
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="submit-btn"
            disabled={hasErrors()}
            style={hasErrors() ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            Crear Cuenta
          </button>
        </form>

        {onSwitchToLogin && (
          <div className="auth-footer">
            ¿Ya tienes una cuenta?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}>
              Iniciar Sesión
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
