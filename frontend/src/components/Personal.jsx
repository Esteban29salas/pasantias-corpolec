import { useEffect, useState } from 'react';
import { Users, UserPlus, Save, ClipboardList, Search } from 'lucide-react';

export default function Personal({ user }) {
  const [personal, setPersonal] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState({ cedula: '', nombre: '', apellido: '', cargo: '' });
  const [errors, setErrors] = useState({});
  const esAdmin = user?.rol === 'admin';

  useEffect(() => {
    if (!esAdmin) return;

    fetch('http://127.0.0.1:8000/api/personal/')
      .then((res) => res.json())
      .then((data) => {
        setPersonal(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch((err) => {
        console.error('Error al cargar personal:', err);
        setCargando(false);
      });
  }, [esAdmin]);

  const cargarPersonal = () => {
    fetch('http://127.0.0.1:8000/api/personal/')
      .then((res) => res.json())
      .then((data) => {
        setPersonal(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('Error al recargar personal:', err));
  };

  const validarCampo = (campo, valor) => {
    let mensaje = "";
    const valLimpio = String(valor).trim();

    if (campo === "cedula") {
      if (!valLimpio) {
        mensaje = "La cédula es requerida.";
      } else if (!/^\d+$/.test(valLimpio)) {
        mensaje = "La cédula debe contener solo números.";
      } else if (valLimpio.length < 5) {
        mensaje = "Ingrese un número de cédula válido.";
      }
    }

    if (campo === "nombre" && !valLimpio) {
      mensaje = "El nombre es requerido.";
    }

    if (campo === "apellido" && !valLimpio) {
      mensaje = "El apellido es requerido.";
    }

    if (campo === "cargo" && !valLimpio) {
      mensaje = "Debe seleccionar un cargo.";
    }

    setErrors((prev) => ({ ...prev, [campo]: mensaje }));
    return mensaje;
  };

  const manejarCambioInput = (campo, valor) => {
    setNuevo((prev) => ({ ...prev, [campo]: valor }));
    validarCampo(campo, valor);
  };

  const validarFormularioCompleto = () => {
    const errCedula = validarCampo("cedula", nuevo.cedula);
    const errNombre = validarCampo("nombre", nuevo.nombre);
    const errApellido = validarCampo("apellido", nuevo.apellido);
    const errCargo = validarCampo("cargo", nuevo.cargo);

    return !(errCedula || errNombre || errApellido || errCargo);
  };

  const manejarGuardar = async (e) => {
    e.preventDefault();

    if (!validarFormularioCompleto()) return;

    try {
      const res = await fetch('http://127.0.0.1:8000/api/personal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nuevo,
          cedula: nuevo.cedula.trim(),
          nombre: nuevo.nombre.trim(),
          apellido: nuevo.apellido.trim(),
          cargo: nuevo.cargo.toUpperCase().trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        cargarPersonal();
        setNuevo({ cedula: '', nombre: '', apellido: '', cargo: '' });
        setErrors({});
        alert('Personal registrado con éxito.');
      } else {
        const mensaje = data.detail || JSON.stringify(data);
        alert(`No se pudo registrar: ${mensaje}`);
      }
    } catch {
      alert('Error de conexión con el servidor.');
    }
  };

  const personalFiltrado = personal.filter((p) => {
    const busquedaLower = busqueda.toLowerCase().trim();
    return (
      (p.cedula && p.cedula.toLowerCase().includes(busquedaLower)) ||
      (p.nombre && p.nombre.toLowerCase().includes(busquedaLower)) ||
      (p.apellido && p.apellido.toLowerCase().includes(busquedaLower)) ||
      (p.cargo && p.cargo.toLowerCase().includes(busquedaLower))
    );
  });

  if (!esAdmin) {
    return (
      <div className="module-container">
        <div className="card-container" style={{ padding: '24px', textAlign: 'center' }}>
          <h2 className="module-title">Acceso restringido</h2>
          <p style={{ color: '#475569' }}>
            La gestión de personal es exclusiva de usuarios administradores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="module-container">
      
      {/* ENCABEZADO DE SECCIÓN */}
      <div className="module-header">
        <div>
          <h2 className="module-title"><Users size={22} /> Gestión de Personal</h2>
          <span className="module-subtitle">
            Administración de personal técnico y administrativo autorizado
          </span>
        </div>
      </div>

      {/* FORMULARIO DE REGISTRO */}
      <div className="card-container">
        <h3 className="card-title">
          <UserPlus size={18} /> Registrar Nuevo Personal
        </h3>

        <form onSubmit={manejarGuardar} noValidate>
          <div className="form-grid">
            {/* Campo Cédula */}
            <div className="form-group">
              <label className="form-label">
                Cédula <span className="required-asterisk">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. 12345678"
                value={nuevo.cedula}
                onChange={(e) => manejarCambioInput('cedula', e.target.value)}
                onBlur={(e) => validarCampo('cedula', e.target.value)}
                className={`form-input ${errors.cedula ? 'input-error' : ''}`}
              />
              {errors.cedula && <span className="error-text">{errors.cedula}</span>}
            </div>

            {/* Campo Nombre */}
            <div className="form-group">
              <label className="form-label">
                Nombre <span className="required-asterisk">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Juan"
                value={nuevo.nombre}
                onChange={(e) => manejarCambioInput('nombre', e.target.value)}
                onBlur={(e) => validarCampo('nombre', e.target.value)}
                className={`form-input ${errors.nombre ? 'input-error' : ''}`}
              />
              {errors.nombre && <span className="error-text">{errors.nombre}</span>}
            </div>

            {/* Campo Apellido */}
            <div className="form-group">
              <label className="form-label">
                Apellido <span className="required-asterisk">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Pérez"
                value={nuevo.apellido}
                onChange={(e) => manejarCambioInput('apellido', e.target.value)}
                onBlur={(e) => validarCampo('apellido', e.target.value)}
                className={`form-input ${errors.apellido ? 'input-error' : ''}`}
              />
              {errors.apellido && <span className="error-text">{errors.apellido}</span>}
            </div>

            {/* Campo Cargo */}
            <div className="form-group">
              <label className="form-label">
                Cargo <span className="required-asterisk">*</span>
              </label>
              <select
                value={nuevo.cargo}
                onChange={(e) => manejarCambioInput('cargo', e.target.value)}
                onBlur={(e) => validarCampo('cargo', e.target.value)}
                className={`form-input ${errors.cargo ? 'input-error' : ''}`}
              >
                <option value="">Seleccione Cargo...</option>
                <option value="INGENIERO">INGENIERO</option>
                <option value="LICENCIADO">LICENCIADO</option>
                <option value="ANALISTA">ANALISTA</option>
                <option value="OPERADOR">OPERADOR</option>
              </select>
              {errors.cargo && <span className="error-text">{errors.cargo}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              <Save size={16} /> Registrar Personal
            </button>
          </div>
        </form>
      </div>

      {/* BARRA DE BÚSQUEDA Y TABLA DE RESULTADOS */}
      <div className="card-container">
        <div className="table-header-tools">
          <h3 className="card-title-sm"><ClipboardList size={18} /> Lista de Personal Registrado</h3>

          <div className="search-box">
            <span className="search-icon"><Search size={16} /></span>
            <input
              type="text"
              placeholder="Buscar por cédula, nombre o cargo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="form-input search-input"
            />
          </div>
        </div>

        {/* TABLA */}
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Cédula</th>
                <th style={{ width: '50%' }}>Nombre Completo</th>
                <th style={{ width: '30%' }}>Cargo</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="3" className="table-empty-cell">
                    Cargando datos del personal...
                  </td>
                </tr>
              ) : personalFiltrado.length === 0 ? (
                <tr>
                  <td colSpan="3" className="table-empty-cell">
                    {busqueda ? 'No se encontraron resultados para la búsqueda.' : 'No hay personal registrado.'}
                  </td>
                </tr>
              ) : (
                personalFiltrado.map((p) => (
                  <tr key={p.cedula}>
                    <td className="font-bold">{p.cedula}</td>
                    <td>{p.nombre} {p.apellido}</td>
                    <td>
                      <span className="badge-cargo">{p.cargo}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}