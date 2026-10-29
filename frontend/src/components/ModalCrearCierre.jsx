import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import "../App.css";

export default function ModalCrearCierre({ isOpen, onClose, alGuardarExito }) {
  const fechaHoy = new Date().toISOString().split("T")[0];

  // Función para calcular exactamente 365 días después
  const calcularFechaCierre = (fechaInicioStr) => {
    if (!fechaInicioStr) return "";
    const fecha = new Date(fechaInicioStr);
    fecha.setDate(fecha.getDate() + 365);
    return fecha.toISOString().split("T")[0];
  };

  const [fechaInicio, setFechaInicio] = useState(fechaHoy);
  const [fechaCierre, setFechaCierre] = useState(calcularFechaCierre(fechaHoy));
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleInicioChange = (e) => {
    const nuevaInicio = e.target.value;
    setFechaInicio(nuevaInicio);
    setFechaCierre(calcularFechaCierre(nuevaInicio));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const payload = {
      fecha_inicio: `${fechaInicio}T00:00:00Z`,
      fecha_cierre: `${fechaCierre}T00:00:00Z`,
      observaciones: observaciones,
    };

    try {
      const res = await fetch("http://localhost:8000/api/cierre-anuales/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Cierre anual registrado con éxito.");
        if (alGuardarExito) alGuardarExito();
        onClose();
      } else {
        let msg = "Error al registrar el cierre.";
        if (typeof data === "object") {
          msg = Object.entries(data)
            .map(([k, v]) => `${k.toUpperCase()}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
        }
        setError(msg);
      }
    } catch (err) {
      setError("Error de conexión con el servidor: " + err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "500px" }}>
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="modal-header-icon"><CalendarDays size={22} /></span>
            <div>
              <h2 className="modal-title">Registrar Nuevo Cierre Anual</h2>
              <span className="modal-subtitle">El sistema calculará automáticamente el periodo de 365 días.</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-close-modal" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: "15px" }}>
              <label className="form-label">Fecha de Inicio <span className="text-danger">*</span></label>
              <input
                type="date"
                className="form-control"
                value={fechaInicio}
                onChange={handleInicioChange}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: "15px" }}>
              <label className="form-label">Fecha de Cierre (Automática - 365 días) <span className="text-danger">*</span></label>
              <input
                type="date"
                className="form-control"
                value={fechaCierre}
                readOnly
                disabled
                style={{ backgroundColor: "#f1f5f9" }}
              />
              <small style={{ color: "#64748b", fontSize: "11px" }}>Requerido exactamente 365 días posteriores por el backend.</small>
            </div>

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label className="form-label">Observaciones / Descripción del Periodo</label>
              <textarea
                className="form-control"
                rows="3"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej. Periodo fiscal anual..."
                maxLength={50}
              ></textarea>
              <small style={{ color: "#64748b", fontSize: "11px" }}>Máximo 50 caracteres.</small>
            </div>

            {error && (
              <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px", borderRadius: "6px", marginBottom: "15px", fontSize: "12px", whiteSpace: "pre-line" }}>
                {error}
              </div>
            )}

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={onClose} className="btn-cancel">Cancelar</button>
              <button type="submit" className="btn-green">Guardar Cierre Anual</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}