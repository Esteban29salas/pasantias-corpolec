// frontend/src/components/Inventario.jsx
import { useEffect, useState } from 'react';
import ModalActaIngreso from './ActaDeIngreso';
import ModalCartaRD from './CartaRD';
import ModalDevolucion from './Devolucion';
import KardexView from './KardexView'; // <-- 1. IMPORTAMOS LA VISTA DE KARDEX
import Liberaciones from './Liberaciones';

export default function Inventario({ user }) {
  const [materiales, setMateriales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  
  const [modalIngresoAbierto, setModalIngresoAbierto] = useState(false);
  const [modalCartaRD, setModalCartaRD] = useState(false);
  const [modalDevolucion, setModalDevolucion] = useState(false);
  const [modalLiberaciones, setModalLiberaciones] = useState(false);

  // <-- 2. ESTADO PARA MANTENER EL MATERIAL SELECCIONADO DEL KARDEX
  const [materialIdKardex, setMaterialIdKardex] = useState(null);
  // Estado para capturar errores de validación individual por campo
  const [errorsMaterial, setErrorsMaterial] = useState({});

  const validarCampoMaterial = (campo, valor) => {
    let mensaje = "";

    if (campo === "codigo") {
      if (!valor) {
        mensaje = "El Código SAP es requerido.";
      } else if (valor.length > 10) {
        mensaje = "El código no puede exceder los 10 dígitos.";
      }
    }

    if (campo === "nombre" && !valor.trim()) {
      mensaje = "El nombre del material es requerido.";
    }

    if (campo === "unidad_medida" && !valor) {
      mensaje = "Seleccione una unidad de medida válida.";
    }

    setErrorsMaterial((prev) => ({ ...prev, [campo]: mensaje }));
    return mensaje;
  };



  const [nuevoMaterial, setNuevoMaterial] = useState({
    codigo: '',
    nombre: '',
    unidad_medida: '',
    stock_actual: 0,
  });

  const cargarMateriales = () => {
    fetch('http://127.0.0.1:8000/api/materiales/')
      .then((res) => res.json())
      .then((data) => {
        setMateriales(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch((err) => {
        console.error('Error al cargar inventario:', err);
        setCargando(false);
      });
  };

  useEffect(() => {
    cargarMateriales();
  }, []);

  const manejarCambioForm = (e) => {
    setNuevoMaterial({
      ...nuevoMaterial,
      [e.target.value ? e.target.name : e.target.name]: e.target.value,
    });
  };

const manejarCrear = async (e) => {
  e.preventDefault();

  // 1. Validación previa en el cliente
  const errCod = validarCampoMaterial("codigo", nuevoMaterial.codigo);
  const errNom = validarCampoMaterial("nombre", nuevoMaterial.nombre);
  const errUm = validarCampoMaterial("unidad_medida", nuevoMaterial.unidad_medida);

  if (errCod || errNom || errUm) {
    return; // Cancela el envío si no pasa la validación local
  }

  // 2. Saneamiento de datos antes del envío
  const datosAEnviar = {
    ...nuevoMaterial,
    codigo: nuevoMaterial.codigo.trim(),
    nombre: nuevoMaterial.nombre.trim(),
    unidad_medida: nuevoMaterial.unidad_medida ? nuevoMaterial.unidad_medida.toUpperCase().trim() : "PZA",
    stock_actual: parseFloat(nuevoMaterial.stock_actual) || 0, // Usar parseFloat por si usas decimales
  };

  try {
    const res = await fetch("http://localhost:8000/api/materiales/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datosAEnviar),
    });

    const respuestaTexto = await res.text();
    let data = null;
    try {
      data = JSON.parse(respuestaTexto);
    } catch {
      data = respuestaTexto;
    }

    if (res.ok) {
      setNuevoMaterial({ codigo: "", nombre: "", unidad_medida: "PZA", stock_actual: 0 });
      setErrorsMaterial({});
      cargarMateriales();
    } else {
      // 3. Asignar errores del backend directo al estado para mostrarlos en el formulario
      if (data && typeof data === "object") {
        setErrorsMaterial(data);
      } else {
        alert("Error en el servidor: " + data);
      }
    }
  } catch (error) {
    console.error("Error al guardar material:", error);
    alert("Error de conexión al registrar el material.");
  }
};

  const isAdmin = user?.rol === 'admin'; // Verifica si el usuario es administrador

  const manejarEliminar = async (codigo) => {
    if (!isAdmin) {
      alert('No tiene permisos para eliminar materiales. Solo usuarios administradores.');
      return;
    }
    if (!confirm(`¿Deseas eliminar el material con código ${codigo}?`)) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/materiales/${codigo}/`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMateriales(materiales.filter((item) => item.codigo !== codigo));
      } else {
        const errData = await res.json();
        alert(errData.error || 'No se puede eliminar el material.');
      }
    } catch {
      alert('Error de conexión al intentar eliminar.');
    }
  };

  const materialesFiltrados = materiales.filter(
    (item) =>
      (item.nombre && item.nombre.toLowerCase().includes(busqueda.toLowerCase())) ||
      (item.codigo && item.codigo.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <div className="module-container">
      {/* HEADER PRINCIPAL */}
      <div className="module-header">
        <div>
          <h2 className="module-title">📦 Gestión de Inventario</h2>
          <span className="module-subtitle">
            Control general de materiales y movimientos de almacén
          </span>
        </div>

        {/* BOTONES DE MODALES */}
        <div className="action-buttons-group">
          <button onClick={() => setModalIngresoAbierto(true)} className="btn-success">
            ➕ Registrar Acta Ingreso
          </button>

          <button onClick={() => setModalCartaRD(true)} className="btn-accent">
            📋 Retiro y Devolución (RD)
          </button>

          <button onClick={() => setModalDevolucion(true)} className="btn-primary">
            ↩️ Registrar Devolución
          </button>

          <button onClick={() => setModalLiberaciones(true)} className="btn-accent">
            📜 Liberaciones de Obra
          </button>
        </div>
      </div>

      {/* FORMULARIO DE REGISTRO DE MATERIAL */}
      <div className="card-container">
        <h3 className="card-title">
          <span>➕</span> Registrar Nuevo Material
        </h3>

        <form onSubmit={manejarCrear} noValidate>
          <div className="form-grid">
            {/* CÓDIGO SAP */}
            <div className="form-group">
              <label className="form-label">Código SAP <span className="text-danger">*</span></label>
              <input
                type="text"
                maxLength={10}
                value={nuevoMaterial.codigo}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setNuevoMaterial({ ...nuevoMaterial, codigo: val });
                  validarCampoMaterial("codigo", val);
                }}
                className={`form-control ${errorsMaterial.codigo ? "is-invalid" : ""}`}
              />
              {errorsMaterial.codigo && <span className="error-msg">{Array.isArray(errorsMaterial.codigo) ? errorsMaterial.codigo.join(", ") : errorsMaterial.codigo}</span>}
            </div>

            {/* NOMBRE DEL MATERIAL */}
            <div className="form-group">
              <label className="form-label">Nombre del Material <span className="text-danger">*</span></label>
              <input
                type="text"
                value={nuevoMaterial.nombre}
                onChange={(e) => {
                  setNuevoMaterial({ ...nuevoMaterial, nombre: e.target.value });
                  validarCampoMaterial("nombre", e.target.value);
                }}
                className={`form-control ${errorsMaterial.nombre ? "is-invalid" : ""}`}
              />
              {errorsMaterial.nombre && <span className="error-msg">{Array.isArray(errorsMaterial.nombre) ? errorsMaterial.nombre.join(", ") : errorsMaterial.nombre}</span>}
            </div>

            {/* UNIDAD DE MEDIDA */}
            <div className="form-group">
              <label className="form-label">Unidad de Medida <span className="text-danger">*</span></label>
              <select
                value={nuevoMaterial.unidad_medida}
                onChange={(e) => {
                  setNuevoMaterial({ ...nuevoMaterial, unidad_medida: e.target.value });
                  validarCampoMaterial("unidad_medida", e.target.value);
                }}
                className={`form-control ${errorsMaterial.unidad_medida ? "is-invalid" : ""}`}
              >
                <option value="">Seleccione...</option>
                <option value="PZA">Pieza (PZA)</option>
                <option value="UND">Unidad (UND)</option>
                <option value="MTS">Metros (MTS)</option>
                <option value="CM">Centímetros (CM)</option>
                <option value="KG">Kilogramos (KG)</option>
                <option value="GR">Gramos (GR)</option>
              </select>
              {errorsMaterial.unidad_medida && <span className="error-msg">{Array.isArray(errorsMaterial.unidad_medida) ? errorsMaterial.unidad_medida.join(", ") : errorsMaterial.unidad_medida}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Stock Inicial</label>
              <input
                type="number"
                name="stock_actual"
                min="0"
                step="0"
                placeholder="0"
                value={nuevoMaterial.stock_actual}
                onChange={manejarCambioForm}
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-success">
              💾 Guardar Material
            </button>
          </div>
        </form>
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="card-container">
        <div className="table-header-tools">
          <h3 className="card-title-sm">📋 Inventario Registrado</h3>

          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="form-input search-input"
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>Código SAP</th>
                <th style={{ width: '28%' }}>Nombre del Material</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Unidad</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Stock Mantenimiento (Libre)</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Stock Obra (Reservado)</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Stock Total</th>
                <th style={{ width: '20%', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">
                    Cargando inventario de almacén...
                  </td>
                </tr>
              ) : materialesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">
                    {busqueda ? 'No se encontraron resultados para la búsqueda.' : 'No hay materiales en el inventario.'}
                  </td>
                </tr>
              ) : (
                materialesFiltrados.map((item) => {
                  const stockMantenimiento = Number(item.stock_mantenimiento || 0);
                  const stockObra = Number(item.stock_obra || 0);
                  const stockTotal = Number(
                    item.stock_total !== undefined ? item.stock_total : stockMantenimiento + stockObra
                  );

                  return (
                  <tr key={item.codigo}>
                    <td className="font-bold">{item.codigo}</td>
                    <td>{item.nombre}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge-cargo">{item.unidad_medida}</span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="font-bold">
                      {stockMantenimiento}
                    </td>
                    <td style={{ textAlign: 'right' }} className="font-bold">
                      <span style={{ color: stockObra > 0 ? '#b45309' : undefined }}>
                        {stockObra}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="font-bold">
                      {stockTotal}
                    </td>
                    <td style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {/* <-- 3. BOTÓN PARA ABRIR EL KARDEX --> */}
                      <button
                        type="button"
                        onClick={() => setMaterialIdKardex(item.codigo)}
                        className="btn-accent"
                        style={{ padding: '4px 8px', fontSize: '13px' }}
                        title="Ver Kardex del Material"
                      >
                        📊 Kardex
                      </button>

                      <button
                        type="button"
                        onClick={() => manejarEliminar(item.codigo)}
                        className="btn-danger-sm"
                        title="Eliminar Material"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALES EXISTENTES */}
      <ModalActaIngreso
        isOpen={modalIngresoAbierto}
        onClose={() => setModalIngresoAbierto(false)}
        alGuardarExito={cargarMateriales}
      />

      <ModalCartaRD
        isOpen={modalCartaRD}
        onClose={() => setModalCartaRD(false)}
        alGuardarExito={cargarMateriales}
        user={user}
      />

      <ModalDevolucion
        isOpen={modalDevolucion}
        onClose={() => setModalDevolucion(false)}
        alGuardarExito={cargarMateriales}
      />

      <Liberaciones
        isOpen={modalLiberaciones}
        onClose={() => setModalLiberaciones(false)}
        user={user}
        alCambiarStock={cargarMateriales}
      />

      {/* <-- 4. MODAL DEL KARDEX DE MATERIAL --> */}
      {materialIdKardex && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-container" style={{ maxWidth: '950px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">📊 Historial de Movimientos (Kardex)</h3>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setMaterialIdKardex(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '16px' }}>
              <KardexView materialId={materialIdKardex} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}