import { useState, useEffect } from "react";

export default function ModalDetalleDocumento({ documento, onClose }) {
  const [datosCompletos, setDatosCompletos] = useState(documento || {});

  useEffect(() => {
    if (!documento || !documento.id) return;

    let endpoint = "";
    if (documento.tipo_doc === "Acta Entrada") endpoint = `http://localhost:8000/api/actas-entrada/${documento.id}/`;
    if (documento.tipo_doc === "Carta Retiro") endpoint = `http://localhost:8000/api/cartas-retiro/${documento.id}/`;
    if (documento.tipo_doc === "Carta Devolución") endpoint = `http://localhost:8000/api/cartas-devolucion/${documento.id}/`;

    if (endpoint) {
      fetch(endpoint)
        .then((res) => res.json())
        .then((data) => {
          setDatosCompletos(data);
        })
        .catch((err) => {
          console.error("Error al obtener el detalle completo:", err);
        });
    }
  }, [documento]);

  if (!documento) return null;

  const esActa = documento.tipo_doc === "Acta Entrada";
  const esRetiro = documento.tipo_doc === "Carta Retiro";
  const esDevolucion = documento.tipo_doc === "Carta Devolución";

  const listaDetalles = 
    datosCompletos.detalles || 
    datosCompletos.AE || 
    datosCompletos.RD || 
    datosCompletos.items ||
    datosCompletos.detalle_set || 
    documento.detalles || 
    [];

  const obtenerNombrePersonal = (campoPersonal, campoNombreTexto) => {
    if (!campoPersonal) return campoNombreTexto || "-";
    if (typeof campoPersonal === "object") {
      return campoPersonal.nombre_completo || campoPersonal.nombre || campoPersonal.nombres || campoPersonal.cedula || "-";
    }
    if (typeof campoPersonal === "string" || typeof campoPersonal === "number") {
      if (campoNombreTexto && typeof campoNombreTexto === "string") return campoNombreTexto;
      return `Cédula: ${campoPersonal}`;
    }
    return "-";
  };

  const recibidoTexto = obtenerNombrePersonal(datosCompletos.recibido_por, datosCompletos.recibido_por_nombre);
  const entregadoTexto = obtenerNombrePersonal(datosCompletos.entregado_por, datosCompletos.entregado_por_nombre);
  const retiradoTexto = obtenerNombrePersonal(datosCompletos.retirado_por, datosCompletos.retirado_por_nombre);
  const devueltoTexto = obtenerNombrePersonal(datosCompletos.devuelto_por, datosCompletos.devuelto_por_nombre);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "850px", width: "90%", padding: "20px" }}>
        
        {/* Encabezado */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #1f4e78", paddingBottom: "10px", marginBottom: "15px" }}>
          <h3 style={{ margin: 0, color: "#1f4e78" }}>
            Detalle de {documento.tipo_doc} - N° {documento.numero}
          </h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", fontWeight: "bold" }}>
            ✕
          </button>
        </div>

        {/* Información General y Personal */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", marginBottom: "15px", fontSize: "13px" }}>
          <div>
            <strong>Fecha:</strong> {documento.fecha ? documento.fecha.split("T")[0] : "-"}
          </div>
          <div>
            <strong>N° Orden / Documento:</strong> {documento.numero}
          </div>

          {esActa && (
            <>
              <div><strong>Recibido Por (Almacén):</strong> {recibidoTexto}</div>
              <div><strong>Entregado Por (Proveedor/Técnico):</strong> {entregadoTexto}</div>
            </>
          )}

          {esRetiro && (
            <>
              <div><strong>Entregado Por (Almacén):</strong> {entregadoTexto}</div>
              <div><strong>Retirado Por:</strong> {retiradoTexto}</div>
            </>
          )}

          {esDevolucion && (
            <>
              <div><strong>Recibido en Almacén Por:</strong> {recibidoTexto}</div>
              <div><strong>Devuelto Por:</strong> {devueltoTexto}</div>
            </>
          )}

          <div style={{ gridColumn: "span 2" }}>
            <strong>Observaciones / Destino:</strong> {datosCompletos.observaciones || datosCompletos.observacion || documento.observacion || "Sin observaciones"}
          </div>
        </div>

        {/* Tabla de Materiales */}
        <h4 style={{ color: "#059669", marginBottom: "8px" }}>Materiales Registrados</h4>
        <div className="table-wrapper" style={{ maxHeight: "250px", overflowY: "auto" }}>
          <table className="custom-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#1f4e78", color: "#fff" }}>
                <th>Código SAP</th>
                <th>Descripción / Material</th>
                <th>U/M</th>
                <th>Cantidad</th>
                {esDevolucion && <th>Condición</th>}
              </tr>
            </thead>
            <tbody>
                {listaDetalles.length > 0 ? (
                listaDetalles.map((det, idx) => {
                    const materialObj = det.material_obj || det.material || {};
                    
                    // Captura segura de código, descripción y unidad de medida
                    const cod = det.codigo_sap || det.codigo_material || materialObj.codigo || "-";
                    const desc = det.nombre_material || det.descripcion || materialObj.nombre || materialObj.descripcion || "Sin descripción";
                    const um = det.unidad_medida || materialObj.unidad_medida || "UND";
                    const cant = det.cantidad_despachada || det.cantidad || 0;

                    return (
                    <tr key={idx}>
                        <td><strong>{cod}</strong></td>
                        <td>{desc}</td>
                        <td>{um}</td>
                        <td><strong>{cant}</strong></td>
                        {esDevolucion && <td>{det.condicion || "OPERATIVO"}</td>}
                    </tr>
                    );
                })
                ) : (
                <tr>
                    <td colSpan={esDevolucion ? "5" : "4"} style={{ textAlign: "center", padding: "15px", color: "#64748b" }}>
                    No hay renglones de detalles asociados a este documento.
                    </td>
                </tr>
                )}
            </tbody>
          </table>
        </div>

        {/* Botón de Cierre */}
        <div style={{ marginTop: "15px", textAlign: "right" }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: "6px 16px" }}>
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}