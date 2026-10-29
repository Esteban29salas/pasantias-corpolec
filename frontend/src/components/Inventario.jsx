// frontend/src/components/Inventario.jsx
import { useEffect, useState } from 'react';
import { Package, ClipboardCheck, ClipboardList, RotateCcw, Plus, Save, Search, ChartColumn, Trash2, X } from 'lucide-react';
import ModalActaIngreso from './ActaDeIngreso';
import ModalCartaRD from './CartaRD';
import ModalDevolucion from './Devolucion';
import Liberaciones from './Liberaciones';
import KardexView from './KardexView'; // <-- 1. IMPORTAMOS LA VISTA DE KARDEX

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

    if (campo === "nombre" && !String(valor).trim()) {
      mensaje = "El nombre del material es requerido.";
    }

    if (campo === "descripcion") {
      const texto = String(valor || "").trim();
      const textoSinEspacios = texto.replace(/\./g, "").replace(/\s/g, "");
      if (!texto) {
        mensaje = "La descripción del material es requerida.";
      } else if (textoSinEspacios.length < 10 || textoSinEspacios.length > 500) {
        mensaje = "La descripción debe tener entre 10 y 500 caracteres útiles.";
      }
    }

    if (campo === "unidad_medida" && !valor) {
      mensaje = "Seleccione una unidad de medida válida.";
    }

    if (campo === "stock_mantenimiento" || campo === "stock_obra") {
      const numero = Number(valor);
      if (valor === "" || Number.isNaN(numero) || numero < 0) {
        mensaje = "Ingrese un stock válido mayor o igual a 0.";
      }
    }

    setErrorsMaterial((prev) => ({ ...prev, [campo]: mensaje }));
    return mensaje;
  };

  const [nuevoMaterial, setNuevoMaterial] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    unidad_medida: '',
    stock_mantenimiento: 0,
    stock_obra: 0,
    proyecto_obra: '',
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
      [e.target.name]: e.target.value,
    });
  };

  const manejarCrear = async (e) => {
    e.preventDefault();

    // 1. Validación previa en el cliente
    const errCod = validarCampoMaterial("codigo", nuevoMaterial.codigo);
    const errNom = validarCampoMaterial("nombre", nuevoMaterial.nombre);
    const errDesc = validarCampoMaterial("descripcion", nuevoMaterial.descripcion);
    const errUm = validarCampoMaterial("unidad_medida", nuevoMaterial.unidad_medida);
    const errStockM = validarCampoMaterial("stock_mantenimiento", nuevoMaterial.stock_mantenimiento);
    const errStockO = validarCampoMaterial("stock_obra", nuevoMaterial.stock_obra);

    const stockMantenimiento = parseFloat(nuevoMaterial.stock_mantenimiento) || 0;
    const stockObra = parseFloat(nuevoMaterial.stock_obra) || 0;
    const proyectoObra = String(nuevoMaterial.proyecto_obra || "").trim();

    if (stockObra > 0 && !proyectoObra) {
      setErrorsMaterial((prev) => ({
        ...prev,
        proyecto_obra: "Indique el proyecto o calle para el stock de Obra.",
      }));
    } else {
      setErrorsMaterial((prev) => ({ ...prev, proyecto_obra: "" }));
    }

    if (errCod || errNom || errDesc || errUm || errStockM || errStockO) {
      return; // Cancela el envío si no pasa la validación local
    }

    if (stockObra > 0 && !proyectoObra) {
      return;
    }

    // 2. Saneamiento de datos antes del envío
    const datosAEnviar = {
      codigo: nuevoMaterial.codigo.trim(),
      nombre: nuevoMaterial.nombre.trim(),
      descripcion: nuevoMaterial.descripcion.trim(),
      unidad_medida: nuevoMaterial.unidad_medida ? nuevoMaterial.unidad_medida.toUpperCase().trim() : "PZA",
      stock_mantenimiento: stockMantenimiento,
      stock_obra: stockObra,
      proyecto_obra: stockObra > 0 ? proyectoObra : "",
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
        setNuevoMaterial({
          codigo: "",
          nombre: "",
          descripcion: "",
          unidad_medida: "PZA",
          stock_mantenimiento: 0,
          stock_obra: 0,
          proyecto_obra: "",
        });
        setErrorsMaterial({});
        cargarMateriales();
      } else {
        // 3. Asignar errores del backend directo al estado
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
          <h2 className="module-title"><Package size={22} /> Gestión de Inventario</h2>
          <span className="module-subtitle">
            Control general de materiales y movimientos de almacén
          </span>
        </div>

        {/* BOTONES DE MODALES */}
        <div className="action-buttons-group">
          <button onClick={() => setModalIngresoAbierto(true)} className="btn-success">
            <ClipboardCheck size={16} /> Registrar Acta Ingreso
          </button>

          <button onClick={() => setModalCartaRD(true)} className="btn-accent">
            <ClipboardList size={16} /> Retiro y Devolución (RD)
          </button>

          <button onClick={() => setModalDevolucion(true)} className="btn-primary">
            <RotateCcw size={16} /> Registrar Devolución
          </button>

          {isAdmin && (
            <button onClick={() => setModalLiberaciones(true)} className="btn-dark-blue">
              <ClipboardList size={16} /> Liberación y Solicitudes
            </button>
          )}
        </div>
      </div>

      {/* FORMULARIO DE REGISTRO DE MATERIAL */}
      <div className="card-container">
        <h3 className="card-title">
          <Plus size={18} /> Registrar Nuevo Material
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
                {errorsMaterial.codigo && (
                  <span className="error-msg">
                    {Array.isArray(errorsMaterial.codigo) ? errorsMaterial.codigo.join(", ") : errorsMaterial.codigo}
                  </span>
                )}
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
                {errorsMaterial.nombre && (
                  <span className="error-msg">
                    {Array.isArray(errorsMaterial.nombre) ? errorsMaterial.nombre.join(", ") : errorsMaterial.nombre}
                  </span>
                )}
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
                  <option value="KM">Kilómetros (KM)</option>
                  <option value="CM">Centímetros (CM)</option>
                  <option value="KG">Kilogramos (KG)</option>
                  <option value="GR">Gramos (GR)</option>
                  <option value="TON">Toneladas (TON)</option>
                </select>
                {errorsMaterial.unidad_medida && (
                  <span className="error-msg">
                    {Array.isArray(errorsMaterial.unidad_medida) ? errorsMaterial.unidad_medida.join(", ") : errorsMaterial.unidad_medida}
                  </span>
                )}
              </div>

              {/* DESCRIPCIÓN */}
              <div className="form-group span-2">
                <label className="form-label">Descripción del Material <span className="text-danger">*</span></label>
                <textarea
                  rows="2"
                  value={nuevoMaterial.descripcion}
                  onChange={(e) => {
                    setNuevoMaterial({ ...nuevoMaterial, descripcion: e.target.value });
                    validarCampoMaterial("descripcion", e.target.value);
                  }}
                  className={`form-control ${errorsMaterial.descripcion ? "is-invalid" : ""}`}
                  placeholder="Descripción técnica o detalle del material..."
                />
                {errorsMaterial.descripcion && (
                  <span className="error-msg">
                    {Array.isArray(errorsMaterial.descripcion) ? errorsMaterial.descripcion.join(", ") : errorsMaterial.descripcion}
                  </span>
                )}
              </div>

              {/* STOCK MANTENIMIENTO */}
              <div className="form-group">
                <label className="form-label">Stock Inicial Mantenimiento</label>
                <input
                  type="number"
                  name="stock_mantenimiento"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={nuevoMaterial.stock_mantenimiento}
                  onChange={(e) => {
                    setNuevoMaterial({ ...nuevoMaterial, stock_mantenimiento: e.target.value });
                    validarCampoMaterial("stock_mantenimiento", e.target.value);
                  }}
                  className={`form-control ${errorsMaterial.stock_mantenimiento ? "is-invalid" : ""}`}
                />
                {errorsMaterial.stock_mantenimiento && (
                  <span className="error-msg">{errorsMaterial.stock_mantenimiento}</span>
                )}
              </div>

              {/* STOCK OBRA */}
              <div className="form-group">
                <label className="form-label">Stock Inicial Obra</label>
                <input
                  type="number"
                  name="stock_obra"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={nuevoMaterial.stock_obra}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setNuevoMaterial({
                      ...nuevoMaterial,
                      stock_obra: valor,
                      proyecto_obra: Number(valor) > 0 ? nuevoMaterial.proyecto_obra : "",
                    });
                    validarCampoMaterial("stock_obra", valor);
                  }}
                  className={`form-control ${errorsMaterial.stock_obra ? "is-invalid" : ""}`}
                />
                {errorsMaterial.stock_obra && (
                  <span className="error-msg">{errorsMaterial.stock_obra}</span>
                )}
              </div>

              {/* PROYECTO / CALLE DEL STOCK OBRA */}
              <div className="form-group span-2">
                <label className="form-label">Proyecto / Calle del Stock Obra</label>
                <input
                  type="text"
                  name="proyecto_obra"
                  value={nuevoMaterial.proyecto_obra}
                  onChange={manejarCambioForm}
                  className={`form-control ${errorsMaterial.proyecto_obra ? "is-invalid" : ""}`}
                  placeholder="Ej. Calle 5, Sector Centro, Obra 123..."
                  disabled={Number(nuevoMaterial.stock_obra) <= 0}
                />
                {errorsMaterial.proyecto_obra && (
                  <span className="error-msg">
                    {Array.isArray(errorsMaterial.proyecto_obra) ? errorsMaterial.proyecto_obra.join(", ") : errorsMaterial.proyecto_obra}
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Stock total inicial: {(parseFloat(nuevoMaterial.stock_mantenimiento) || 0) + (parseFloat(nuevoMaterial.stock_obra) || 0)}
                </span>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-success">
                <Save size={16} /> Guardar Material
              </button>
            </div>
          </form>
      </div>

      <div className="card-container" style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>
        Los usuarios normales pueden registrar nuevos materiales. Editar o eliminar requiere rol de administrador.
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="card-container">
        <div className="table-header-tools">
          <h3 className="card-title-sm"><ClipboardList size={18} /> Inventario Registrado</h3>

          <div className="search-box">
            <span className="search-icon"><Search size={16} /></span>
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
                <th style={{ width: '12%' }}>Código SAP</th>
                <th style={{ width: '26%' }}>Nombre del Material</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Unidad</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Stock Mantenimiento</th>
                <th style={{ width: '22%', textAlign: 'right' }}>Stock Obra</th>
                <th style={{ width: '9%', textAlign: 'right' }}>Stock Total</th>
                <th style={{ width: '9%', textAlign: 'center' }}>Acciones</th>
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
                  const stockObra = Number(item.stock_obra || 0);
                  return (
                    <tr key={item.codigo}>
                      <td className="font-bold">{item.codigo}</td>
                      <td>{item.nombre}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge-cargo">{item.unidad_medida}</span>
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-bold">
                        <span style={{ color: '#0f766e' }}>{item.stock_mantenimiento ?? 0}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="font-bold" style={{ color: '#b45309' }}>
                          {item.stock_obra ?? 0}
                        </div>
                        {stockObra > 0 && (
                          <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                            {item.proyecto_obra || 'Sin proyecto/calle indicado'}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-bold">
                        {item.stock_total ?? item.stock_actual}
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
                          <ChartColumn size={14} /> Kardex
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => manejarEliminar(item.codigo)}
                            className="btn-danger-sm"
                            title="Eliminar Material"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
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

      {isAdmin && (
        <Liberaciones
          isOpen={modalLiberaciones}
          onClose={() => setModalLiberaciones(false)}
          user={user}
          alCambiarStock={cargarMateriales}
        />
      )}

      {/* <-- 4. MODAL DEL KARDEX DE MATERIAL --> */}
      {materialIdKardex && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-container" style={{ maxWidth: '950px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title"><ChartColumn size={20} /> Historial de Movimientos (Kardex)</h3>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setMaterialIdKardex(null)}
                title="Cerrar"
              >
                <X size={18} />
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