import { useState, useEffect } from "react";
import ModalDetalleDocumento from "./ModalDetalles";
import ModalCrearCierre from "./ModalCrearCierre"; // 👈 Modal nuevo para crear cierre

export default function HistorialConsultasAnuales() {
  const [cierres, setCierres] = useState([]);
  const [cierreSeleccionado, setCierreSeleccionado] = useState(null);
  
  const fechaHoy = new Date().toISOString().split("T")[0];
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [errorFecha, setErrorFecha] = useState(""); // 👈 Estado para validación inline
  
  const [actasEntrada, setActasEntrada] = useState([]);
  const [cartasRetiro, setCartasRetiro] = useState([]);
  const [cartasDevolucion, setCartasDevolucion] = useState([]);
  
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState(null);
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false); // 👈 Control del modal

  const cargarCierres = () => {
    fetch("http://localhost:8000/api/cierre-anuales/")
      .then((res) => res.json())
      .then((data) => setCierres(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error al cargar cierres:", err));
  };

  useEffect(() => {
    cargarCierres();

    fetch("http://localhost:8000/api/actas-entrada/")
      .then((res) => res.json())
      .then((data) => setActasEntrada(Array.isArray(data) ? data : []));

    fetch("http://localhost:8000/api/cartas-retiro/")
      .then((res) => res.json())
      .then((data) => setCartasRetiro(Array.isArray(data) ? data : []));

    fetch("http://localhost:8000/api/cartas-devolucion/")
      .then((res) => res.json())
      .then((data) => setCartasDevolucion(Array.isArray(data) ? data : []));
  }, []);

  const handleDesdeChange = (e) => {
    const valor = e.target.value;
    setFechaDesde(valor);
    if (fechaHasta && valor > fechaHasta) {
      setErrorFecha("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
    } else {
      setErrorFecha("");
    }
  };

  const handleHastaChange = (e) => {
    const valor = e.target.value;
    if (fechaDesde && valor < fechaDesde) {
      setErrorFecha("La fecha 'Hasta' no puede ser anterior a la fecha 'Desde'.");
    } else {
      setErrorFecha("");
      setFechaHasta(valor);
    }
  };

  const obtenerDatosFiltrados = () => {
    let lista = [];

    if (filtroTipo === "TODOS" || filtroTipo === "ACTAS") {
      lista = [
        ...lista,
        ...actasEntrada.map((item) => ({
          ...item,
          tipo_doc: "Acta Entrada",
          numero: item.numero_acta || item.codigo || `ACTA-${item.id}`,
          fecha: item.fecha_recepcion || item.fecha || "-",
          observacion: item.observaciones || "Sin observaciones",
        })),
      ];
    }

    if (filtroTipo === "TODOS" || filtroTipo === "RETIROS") {
      lista = [
        ...lista,
        ...cartasRetiro.map((item) => ({
          ...item,
          tipo_doc: "Carta Retiro",
          numero: item.codigo_retiro || String(item.id).padStart(5, "0"),
          fecha: item.fecha_hora || item.fecha || "-",
          observacion: item.observaciones || item.destino_circuito || "Sin observaciones",
        })),
      ];
    }

    if (filtroTipo === "TODOS" || filtroTipo === "DEVOLUCIONES") {
      lista = [
        ...lista,
        ...cartasDevolucion.map((item) => {
          const codRetiro =
            item.codigo_retiro ||
            item.carta_retiro_codigo ||
            (typeof item.carta_retiro === "object" ? item.carta_retiro?.codigo_retiro : item.carta_retiro) ||
            item.id;

          const fechaDev = item.fecha_devolucion || item.fecha_hora || item.fecha || "-";

          return {
            ...item,
            tipo_doc: "Carta Devolución",
            numero: typeof codRetiro === "number" ? String(codRetiro).padStart(5, "0") : codRetiro,
            fecha: fechaDev,
            observacion: item.observaciones || "Sin observaciones",
          };
        }),
      ];
    }

    if (cierreSeleccionado) {
      lista = lista.filter((item) => {
        if (!item.fecha || item.fecha === "-") return false;
        const fechaItem = item.fecha.split("T")[0];
        return fechaItem >= cierreSeleccionado.fecha_inicio.split("T")[0] && 
               fechaItem <= cierreSeleccionado.fecha_cierre.split("T")[0];
      });
    }

    if (fechaDesde) {
      lista = lista.filter((item) => {
        if (!item.fecha || item.fecha === "-") return false;
        return item.fecha.split("T")[0] >= fechaDesde;
      });
    }

    if (fechaHasta && !errorFecha) {
      lista = lista.filter((item) => {
        if (!item.fecha || item.fecha === "-") return false;
        return item.fecha.split("T")[0] <= fechaHasta;
      });
    }

    return lista;
  };

  const datosMostrados = obtenerDatosFiltrados();

  const limpiarFiltrosFechas = () => {
    setFechaDesde("");
    setFechaHasta("");
    setErrorFecha("");
  };

  return (
    <div className="card-container" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h3 className="card-title" style={{ color: "#059669", margin: 0 }}>
          Consulta Histórica y Auditoría por Cierre Anual
        </h3>
        <button 
          onClick={() => setModalCierreAbierto(true)}
          className="btn-blue"
          style={{ backgroundColor: "#059669" }}
        >
          + Nuevo Cierre Anual
        </button>
      </div>

      {/* Contenedor de Filtros */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px", alignItems: "flex-start" }}>
        <div>
          <label className="form-label" style={{ display: "block", marginBottom: "5px" }}>Seleccionar Periodo / Cierre Anual:</label>
          <select 
            className="form-input"
            style={{ minWidth: "280px" }}
            value={cierreSeleccionado ? cierreSeleccionado.id : ""}
            onChange={(e) => {
              const id = e.target.value;
              const encontrado = cierres.find(c => String(c.id) === String(id));
              setCierreSeleccionado(encontrado || null);
            }}
          >
            <option value="">-- Ver Todo / Sin Filtro de Año --</option>
            {cierres.map((c) => (
              <option key={c.id} value={c.id}>
                Periodo: {c.fecha_inicio.split("T")[0]} al {c.fecha_cierre.split("T")[0]} ({c.observaciones || "Sin obs."})
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div>
              <label className="form-label" style={{ display: "block", marginBottom: "5px" }}>Desde:</label>
              <input 
                type="date"
                className="form-input"
                max={fechaHoy}
                value={fechaDesde}
                onChange={handleDesdeChange}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: "block", marginBottom: "5px" }}>Hasta:</label>
              <input 
                type="date"
                className="form-input"
                max={fechaHoy}
                value={fechaHasta}
                onChange={handleHastaChange}
              />
            </div>
            {(fechaDesde || fechaHasta) && (
              <button 
                type="button" 
                onClick={limpiarFiltrosFechas} 
                className="btn-cancel"
                style={{ height: "38px", padding: "0 12px" }}
              >
                Limpiar Fechas
              </button>
            )}
          </div>
          {/* Validación Inline en texto rojo */}
          {errorFecha && <span className="error-msg" style={{ display: "block", marginTop: "5px", color: "#dc2626", fontSize: "12px" }}>{errorFecha}</span>}
        </div>
      </div>

      {cierreSeleccionado && (
        <div style={{ background: "#ecfdf5", padding: "10px", borderRadius: "6px", marginBottom: "15px", fontSize: "12px", color: "#065f46" }}>
          Filtrando bajo el cierre seleccionado del <strong>{cierreSeleccionado.fecha_inicio.split("T")[0]}</strong> al <strong>{cierreSeleccionado.fecha_cierre.split("T")[0]}</strong>.
        </div>
      )}

      {/* Pestañas de Filtro de Documentos */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <button className={`btn-secondary ${filtroTipo === "TODOS" ? "active" : ""}`} onClick={() => setFiltroTipo("TODOS")}>
          Todos ({actasEntrada.length + cartasRetiro.length + cartasDevolucion.length})
        </button>
        <button className={`btn-secondary ${filtroTipo === "ACTAS" ? "active" : ""}`} onClick={() => setFiltroTipo("ACTAS")}>
          Actas de Entrada ({actasEntrada.length})
        </button>
        <button className={`btn-secondary ${filtroTipo === "RETIROS" ? "active" : ""}`} onClick={() => setFiltroTipo("RETIROS")}>
          Cartas de Retiro ({cartasRetiro.length})
        </button>
        <button className={`btn-secondary ${filtroTipo === "DEVOLUCIONES" ? "active" : ""}`} onClick={() => setFiltroTipo("DEVOLUCIONES")}>
          Cartas de Devolución ({cartasDevolucion.length})
        </button>
      </div>

      {/* Tabla de Resultados */}
      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr style={{ backgroundColor: "#1f4e78", color: "#fff" }}>
              <th>Tipo Documento</th>
              <th>N° / Código</th>
              <th>Fecha</th>
              <th>Observaciones / Destino</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {datosMostrados.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                  No hay registros disponibles para mostrar en este rango de fechas.
                </td>
              </tr>
            ) : (
              datosMostrados.map((item, index) => (
                <tr key={index}>
                  <td><strong>{item.tipo_doc}</strong></td>
                  <td>{item.numero}</td>
                  <td>{item.fecha ? item.fecha.split("T")[0] : "-"}</td>
                  <td>{item.observacion}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ padding: "3px 8px", fontSize: "11px", backgroundColor: "#1f4e78", color: "#fff" }}
                      onClick={() => setDocumentoSeleccionado(item)}
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modales */}
      {documentoSeleccionado && (
        <ModalDetalleDocumento documento={documentoSeleccionado} onClose={() => setDocumentoSeleccionado(null)} />
      )}

      {modalCierreAbierto && (
        <ModalCrearCierre 
          isOpen={modalCierreAbierto} 
          onClose={() => setModalCierreAbierto(false)} 
          alGuardarExito={cargarCierres} 
        />
      )}
    </div>
  );
}