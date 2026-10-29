import { useEffect, useState } from "react";
import "../App.css";

const API = "http://localhost:8000/api";

const formatoFecha = (valor) => {
  if (!valor) return "-";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString("es-VE");
};

export default function Liberaciones({ isOpen, onClose, user, alCambiarStock }) {
  const [tab, setTab] = useState("pendientes");
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState("");

  const isAdmin = user?.rol === "admin";

  const cargarDatos = async () => {
    try {
      const [resPendientes, resHistorial] = await Promise.all([
        fetch(`${API}/liberaciones/?estado=PENDIENTE`),
        fetch(`${API}/historial-liberaciones/`),
      ]);

      const dataPendientes = await resPendientes.json();
      const dataHistorial = await resHistorial.json();

      setPendientes(Array.isArray(dataPendientes) ? dataPendientes : []);
      setHistorial(Array.isArray(dataHistorial) ? dataHistorial : []);
    } catch (err) {
      console.error("Error al cargar liberaciones:", err);
      setError("No se pudo cargar la información de liberaciones.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      Promise.resolve().then(() => cargarDatos());
    }
  }, [isOpen]);

  const resolverSolicitud = async (solicitud, accion) => {
    if (!isAdmin) {
      alert("Solo un administrador puede aprobar o rechazar liberaciones de obra.");
      return;
    }

    const mensaje =
      accion === "aprobar"
        ? `¿Autorizar la liberación de ${solicitud.cantidad} ${solicitud.unidad_medida || ""} de ${solicitud.material_nombre}? Se descontará del Stock Obra.`
        : `¿Rechazar la solicitud de ${solicitud.material_nombre}?`;

    if (!confirm(mensaje)) return;

    const motivo =
      accion === "aprobar"
        ? window.prompt("Motivo / observación de la liberación:", solicitud.motivo || "") ?? ""
        : window.prompt("Motivo del rechazo:", solicitud.motivo || "") ?? "";

    setProcesando(solicitud.id);
    setError("");

    try {
      const res = await fetch(`${API}/liberaciones/${solicitud.id}/${accion}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          administrador_id: user?.id,
          administrador_nombre: user?.nombreCompleto,
          motivo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || "No se pudo procesar la solicitud.");
      }

      await cargarDatos();
      if (alCambiarStock) alCambiarStock();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ display: "flex" }}>
      <div className="modal-content" style={{ maxWidth: "1100px", width: "94%" }}>
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="modal-header-icon">📜</span>
            <div>
              <h2 className="modal-title">Liberaciones de Material de Obra</h2>
              <span className="modal-subtitle">
                Solicitudes pendientes de aprobación e historial de auditoría
              </span>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => setTab("pendientes")}
              className={tab === "pendientes" ? "btn-primary" : "btn-secondary"}
            >
              ⏳ Pendientes ({pendientes.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("historial")}
              className={tab === "historial" ? "btn-primary" : "btn-secondary"}
            >
              📜 Historial de Liberaciones ({historial.length})
            </button>
          </div>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "10px 14px",
                borderRadius: "6px",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}

          {!isAdmin && tab === "pendientes" && (
            <div
              style={{
                background: "#fef3c7",
                color: "#92400e",
                padding: "10px 14px",
                borderRadius: "6px",
                marginBottom: "12px",
              }}
            >
              Solo usuarios con rol administrador pueden aprobar o rechazar solicitudes.
            </div>
          )}

          {cargando ? (
            <p>Cargando información...</p>
          ) : tab === "pendientes" ? (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Código SAP</th>
                    <th>Material</th>
                    <th style={{ textAlign: "center" }}>Cantidad</th>
                    <th style={{ textAlign: "center" }}>Stock Obra</th>
                    <th>Proyecto / Observación</th>
                    <th>RD</th>
                    <th>Solicitado por</th>
                    <th>Fecha</th>
                    <th style={{ textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="table-empty-cell">
                        No hay solicitudes de liberación pendientes.
                      </td>
                    </tr>
                  ) : (
                    pendientes.map((solicitud) => (
                      <tr key={solicitud.id}>
                        <td className="font-bold">{solicitud.material_codigo}</td>
                        <td>{solicitud.material_nombre}</td>
                        <td style={{ textAlign: "center" }} className="font-bold">
                          {solicitud.cantidad} {solicitud.unidad_medida}
                        </td>
                        <td style={{ textAlign: "center" }}>{solicitud.stock_obra_actual}</td>
                        <td>{solicitud.proyecto_origen || solicitud.motivo || "-"}</td>
                        <td>{solicitud.codigo_retiro || "-"}</td>
                        <td>{solicitud.solicitado_por_nombre || "-"}</td>
                        <td>{formatoFecha(solicitud.fecha_solicitud)}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn-success"
                            style={{ padding: "4px 8px", fontSize: "12px", marginRight: "6px" }}
                            disabled={!isAdmin || procesando === solicitud.id}
                            onClick={() => resolverSolicitud(solicitud, "aprobar")}
                          >
                            ✔ Aprobar
                          </button>
                          <button
                            type="button"
                            className="btn-danger-sm"
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                            disabled={!isAdmin || procesando === solicitud.id}
                            onClick={() => resolverSolicitud(solicitud, "rechazar")}
                          >
                            ✕ Rechazar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Código SAP</th>
                    <th>Material</th>
                    <th style={{ textAlign: "center" }}>Cantidad liberada</th>
                    <th>Proyecto / Observación origen</th>
                    <th>Autorizado por</th>
                    <th>Motivo / Observación</th>
                    <th>Documento</th>
                    <th>Fecha y hora</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="table-empty-cell">
                        Aún no existen liberaciones de obra registradas.
                      </td>
                    </tr>
                  ) : (
                    historial.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold">{item.material_codigo}</td>
                        <td>{item.material_nombre}</td>
                        <td style={{ textAlign: "center" }} className="font-bold">
                          {item.cantidad} {item.unidad_medida}
                        </td>
                        <td>{item.proyecto_origen || "-"}</td>
                        <td>{item.administrador_nombre || "-"}</td>
                        <td>{item.motivo || "-"}</td>
                        <td>{item.numero_documento || "-"}</td>
                        <td>{formatoFecha(item.fecha_hora)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-cancel">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
