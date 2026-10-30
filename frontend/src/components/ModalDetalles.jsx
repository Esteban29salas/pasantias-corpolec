import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function ModalDetalleDocumento({ documento, onClose }) {
  const [datosCompletos, setDatosCompletos] = useState(documento || {});
  const [archivosSoporte, setArchivosSoporte] = useState({
    imagen_soporte_1: null,
    imagen_soporte_2: null,
  });
  const [subiendoSoporte, setSubiendoSoporte] = useState(false);
  const [errorSoporte, setErrorSoporte] = useState("");
  const [mensajeSoporte, setMensajeSoporte] = useState("");

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

  const subirSoporte = async () => {
    const formData = new FormData();
    let hayArchivos = false;

    ["imagen_soporte_1", "imagen_soporte_2"].forEach((campo) => {
      if (archivosSoporte[campo]) {
        formData.append(campo, archivosSoporte[campo]);
        hayArchivos = true;
      }
    });

    if (!hayArchivos) {
      setErrorSoporte("Seleccione al menos una imagen de soporte.");
      return;
    }

    setSubiendoSoporte(true);
    setErrorSoporte("");
    setMensajeSoporte("");

    try {
      const res = await fetch(`http://localhost:8000/api/cartas-retiro/${documento.id}/soporte/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.detail || "No se pudieron subir las imágenes.");
      }

      setDatosCompletos((prev) => ({ ...prev, ...data }));
      setArchivosSoporte({ imagen_soporte_1: null, imagen_soporte_2: null });
      setMensajeSoporte("Imágenes de soporte actualizadas correctamente.");
    } catch (err) {
      setErrorSoporte(err.message);
    } finally {
      setSubiendoSoporte(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "850px", width: "90%", padding: "20px" }}>
        
        {/* Encabezado */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #1f4e78", paddingBottom: "10px", marginBottom: "15px" }}>
          <h3 style={{ margin: 0, color: "#1f4e78" }}>
            Detalle de {documento.tipo_doc} - N° {documento.numero}
          </h3>
          <button onClick={onClose} title="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1f4e78" }}>
            <X size={20} />
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

        {esRetiro && (
          <div style={{ marginTop: "15px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
            <h4 style={{ color: "#059669", margin: "0 0 10px 0" }}>Soporte Documental</h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              {[
                ["imagen_soporte_1", "Imagen 1"],
                ["imagen_soporte_2", "Imagen 2"],
              ].map(([campo, etiqueta]) => (
                <div key={campo}>
                  {datosCompletos[campo] ? (
                    <a href={datosCompletos[campo]} target="_blank" rel="noreferrer">
                      <img
                        src={datosCompletos[campo]}
                        alt={etiqueta}
                        style={{
                          width: "100%",
                          maxHeight: "140px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                        }}
                      />
                    </a>
                  ) : (
                    <div
                      style={{
                        height: "90px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px dashed #cbd5e1",
                        borderRadius: "6px",
                        color: "#64748b",
                        fontSize: "12px",
                      }}
                    >
                      {etiqueta}: sin imagen
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={(e) =>
                  setArchivosSoporte((prev) => ({
                    ...prev,
                    imagen_soporte_1: e.target.files?.[0] || null,
                  }))
                }
              />
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={(e) =>
                  setArchivosSoporte((prev) => ({
                    ...prev,
                    imagen_soporte_2: e.target.files?.[0] || null,
                  }))
                }
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={subirSoporte}
                disabled={subiendoSoporte}
                style={{ padding: "5px 12px", fontSize: "12px" }}
              >
                {subiendoSoporte ? "Subiendo..." : "Guardar imágenes"}
              </button>
              {errorSoporte && <span style={{ color: "#dc2626", fontSize: "12px" }}>{errorSoporte}</span>}
              {mensajeSoporte && <span style={{ color: "#059669", fontSize: "12px" }}>{mensajeSoporte}</span>}
            </div>
          </div>
        )}

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