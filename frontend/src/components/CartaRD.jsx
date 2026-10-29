import { useState, useEffect, useRef } from "react";
import { ClipboardList, Maximize2, Minimize2, X, Save, ChevronDown, FileSpreadsheet, FileText, Trash2, Image, Upload } from "lucide-react";
import "../App.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ModalCartaRD({ isOpen, onClose, alGuardarExito, user }) {
  const formRef = useRef(null);
  const UNIDAD_TECNICA_DEFAULT = "DPTO MTTO Y ATC AVER SC TC LA FRIA TACHIRA";
  const CECO_CODIGO = "E350203";
  const CECO_NOMBRE = "SERVICIOS TIPO C LA FRIA";
  const ESTRUCTU_DEFAULT = "40001445";

  // Estado para maximizar la ventana
  const [esMaximizado, setEsMaximizado] = useState(false);

  const toggleMaximizar = () => {
    setEsMaximizado((prev) => !prev);
    setPosicion({ x: 0, y: 0 });
  };

  const [cabecera, setCabecera] = useState({
    codigo_retiro: "",
    fecha: new Date().toISOString().split("T")[0],
    tipo_movimiento: "SALIDA",
    ceco: CECO_CODIGO,
    unidad_tecnica: UNIDAD_TECNICA_DEFAULT,
    entregado_por: "",
    retirado_por: "",
    observaciones_generales: "",
  });

  // Menús desplegables de exportación (Arriba y Abajo)
  const [mostrarOpcionesExportarArriba, setMostrarOpcionesExportarArriba] = useState(false);
  const [mostrarOpcionesExportarAbajo, setMostrarOpcionesExportarAbajo] = useState(false);

  const [detalles, setDetalles] = useState([
    {
      material: "",
      descripcion: "",
      unidad_medida: "UND",
      condicion: "OPERATIVO",
      cantidad_despachada: 1,
      cantidad_devuelta: 0,
      observacion: "",
      pag: "1",
      origen: "M",
    },
  ]);

  const [errors, setErrors] = useState({
    cabecera: {},
    detalles: [{}],
  });

  const [materialList, setMaterialList] = useState([]);
  const [personalList, setPersonalList] = useState([]);
  
  // Estado para imágenes de soporte
  const [imagenesSoporte, setImagenesSoporte] = useState({
    imagen_soporte_1: null,
    imagen_soporte_2: null,
  });

  // Arrastre del Modal
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [estaArrastrando, setEstaArrastrando] = useState(false);
  const arrastrandoRef = useRef(false);
  const inicioArrastreRef = useRef({ x: 0, y: 0 });

  const iniciarArrastre = (e) => {
    if (e.target.closest(".no-drag") || esMaximizado) return;
    arrastrandoRef.current = true;
    setEstaArrastrando(true);
    inicioArrastreRef.current = {
      x: e.clientX - posicion.x,
      y: e.clientY - posicion.y,
    };

    const alMover = (ev) => {
      if (!arrastrandoRef.current) return;
      setPosicion({
        x: ev.clientX - inicioArrastreRef.current.x,
        y: ev.clientY - inicioArrastreRef.current.y,
      });
    };

    const alSoltar = () => {
      arrastrandoRef.current = false;
      setEstaArrastrando(false);
      window.removeEventListener("mousemove", alMover);
      window.removeEventListener("mouseup", alSoltar);
    };

    window.addEventListener("mousemove", alMover);
    window.addEventListener("mouseup", alSoltar);
  };

  useEffect(() => {
    if (isOpen) {
      // Las peticiones fetch se mantienen intactas aquí dentro
      fetch("http://localhost:8000/api/cartas-retiro/")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            let maxId = 0;
            data.forEach((item) => {
              const num = parseInt(String(item.codigo_retiro).replace(/\D/g, ""), 10);
              if (!isNaN(num) && num > maxId) maxId = num;
            });
            const proximo = String(maxId + 1).padStart(5, "0");
            setCabecera((prev) => ({ ...prev, codigo_retiro: proximo }));
          } else {
            setCabecera((prev) => ({ ...prev, codigo_retiro: "00001" }));
          }
        })
        .catch(() => setCabecera((prev) => ({ ...prev, codigo_retiro: "00001" })));

      fetch("http://localhost:8000/api/materiales/")
        .then((res) => res.json())
        .then((data) => setMaterialList(Array.isArray(data) ? data : []))
        .catch(() => {});

      fetch("http://localhost:8000/api/personal/")
        .then((res) => res.json())
        .then((data) => setPersonalList(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isOpen]);

  const validarCampoCabecera = (campo, valor) => {
    let mensaje = "";
    if (campo === "fecha" && !valor) mensaje = "La fecha es requerida.";
    if (campo === "entregado_por" && !valor) mensaje = "Debe seleccionar quién entrega.";
    if (campo === "retirado_por" && !valor) mensaje = "Debe seleccionar quién recibe.";

    setErrors((prev) => ({
      ...prev,
      cabecera: { ...prev.cabecera, [campo]: mensaje },
    }));
    return mensaje;
  };

  const validarCampoDetalle = (index, campo, valor, itemActual) => {
    let mensaje = "";
    if (campo === "material" && !valor) {
      mensaje = "Seleccione un material.";
    }
    if (campo === "cantidad_despachada") {
      const cant = parseFloat(valor);
      const stockMax = itemActual?.stock_disponible !== undefined ? itemActual.stock_disponible : Infinity;
      if (isNaN(cant) || cant <= 0) {
        mensaje = "La cantidad debe ser mayor a 0.";
      }
      else if (cant > stockMax) {
        mensaje = `La cantidad no puede superar el stock disponible (${stockMax}).`;
      }
    }

    setErrors((prev) => {
      const nuevosErroresDetalles = [...prev.detalles];
      nuevosErroresDetalles[index] = {
        ...nuevosErroresDetalles[index],
        [campo]: mensaje,
      };
      return { ...prev, detalles: nuevosErroresDetalles };
    });
    return mensaje;
  };

  const handleCabeceraChange = (campo, valor) => {
    setCabecera({ ...cabecera, [campo]: valor });
    validarCampoCabecera(campo, valor);
  };

  const obtenerStockDisponible = (material, origen) => {
    if (!material) return 0;
    return origen === "O"
      ? Number(material.stock_obra || 0)
      : Number(material.stock_mantenimiento || 0);
  };

  const handleChangeDetalle = (index, campo, valor) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index][campo] = valor;

    if (campo === "material" || campo === "origen") {
      const matEncontrado = materialList.find(
        (m) => String(m.codigo) === String(nuevosDetalles[index].material)
      );
      if (matEncontrado) {
        if (campo === "material") {
          nuevosDetalles[index].descripcion = matEncontrado.descripcion || matEncontrado.nombre || "";
          nuevosDetalles[index].unidad_medida = matEncontrado.unidad_medida || "UND";
          nuevosDetalles[index].pag = matEncontrado.pag_kardex ? String(matEncontrado.pag_kardex) : "1";
        }
        nuevosDetalles[index].stock_disponible = obtenerStockDisponible(
          matEncontrado,
          nuevosDetalles[index].origen || "M"
        );
      }
    }

    setDetalles(nuevosDetalles);
    validarCampoDetalle(index, campo, valor, nuevosDetalles[index]);

    if ((campo === "material" || campo === "origen") && nuevosDetalles[index].material) {
      validarCampoDetalle(
        index,
        "cantidad_despachada",
        nuevosDetalles[index].cantidad_despachada,
        nuevosDetalles[index]
      );
    }
  };

  const agregarFila = () => {
    setDetalles([
      ...detalles,
      {
        material: "",
        descripcion: "",
        unidad_medida: "UND",
        condicion: "OPERATIVO",
        cantidad_despachada: 1,
        cantidad_devuelta: 0,
        observacion: "",
        pag: "1",
        origen: "M",
      },
    ]);
    setErrors((prev) => ({
      ...prev,
      detalles: [...prev.detalles, {}],
    }));
  };

  const eliminarFila = (index) => {
    if (detalles.length === 1) return;
    setDetalles(detalles.filter((_, idx) => idx !== index));
    setErrors((prev) => ({
      ...prev,
      detalles: prev.detalles.filter((_, idx) => idx !== index),
    }));
  };

  // --- EXPORTACIÓN EXCEL ---
  const handleExportExcel = async () => {
    try {
      const payload = {
        info_producto: {
          codigo_sap: cabecera.codigo_retiro,
          fecha_ingresada: cabecera.fecha,
          entregado_por: cabecera.entregado_por,
          retirado_por: cabecera.retirado_por,
          destino_circuito: cabecera.observaciones_generales,
        },
        detalles: detalles.map((d) => ({
          codigo_sap: d.material,
          descripcion: d.descripcion,
          unidad_medida: d.unidad_medida,
          estado: d.condicion,
          cantidad_despachada: d.cantidad_despachada,
          cantidad_devuelta: 0,
          observacion: d.observacion,
          destino: d.origen || "M",
        })),
      };

      const response = await fetch("http://localhost:8000/api/kardex/excel/generar/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await response.json();
      if (!response.ok) throw new Error(res.error || "Error al generar el Excel");
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      alert("No se pudo generar ni abrir el archivo Excel.");
    }
  };

  // --- EXPORTACIÓN PDF ---
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("CORPOELEC - RETIRO Y DEVOLUCIÓN DE MATERIALES (KARDEX RD)", 105, 12, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("01.- Fecha:", 14, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`${cabecera.fecha || "-"}`, 32, 20);

      doc.setFont("helvetica", "bold");
      doc.text("06.- N° Orden / Acta:", 75, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`${cabecera.codigo_retiro || "S/N"}`, 108, 20);

      doc.setFont("helvetica", "bold");
      doc.text("Estructura:", 145, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`${ESTRUCTU_DEFAULT}`, 165, 20);

      doc.setFont("helvetica", "bold");
      doc.text("02.- CECO:", 14, 26);
      doc.setFont("helvetica", "normal");
      const cecoTexto = `${CECO_CODIGO} - ${CECO_NOMBRE}`;
      const cecoLineas = doc.splitTextToSize(cecoTexto, 85);
      doc.text(cecoLineas, 32, 26);

      doc.setFont("helvetica", "bold");
      doc.text("05.- Unidad Técnica:", 120, 26);
      doc.setFont("helvetica", "normal");
      const unidadTexto = `${UNIDAD_TECNICA_DEFAULT}`;
      const unidadLineas = doc.splitTextToSize(unidadTexto, 62);
      doc.text(unidadLineas, 148, 26);

      const alturaHeaderY = Math.max(26 + cecoLineas.length * 4, 26 + unidadLineas.length * 4);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, alturaHeaderY + 1, 196, alturaHeaderY + 1);

      const headers = [["N°", "Código SAP", "Descripción", "U/M", "Cond.", "Cant. Desp.", "Cant. Dev.", "Observación", "Pág"]];
      const dataFilas = detalles.map((item, index) => [
        index + 1,
        item.material || "-",
        item.descripcion || "-",
        item.unidad_medida || "UND",
        item.condicion || "OPERATIVO",
        item.cantidad_despachada || "0",
        item.cantidad_devuelta || "0",
        item.observacion || "-",
        item.pag || "1",
      ]);

      autoTable(doc, {
        startY: alturaHeaderY + 4,
        head: headers,
        body: dataFilas,
        theme: "grid",
        margin: { left: 14, right: 14 },
        headStyles: {
          fillColor: [31, 78, 120],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          fontSize: 7.5,
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          overflow: "linebreak",
        },
      });

      const finalY = doc.lastAutoTable.finalY || 150;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("15.- Observaciones Generales:", 14, finalY + 8);

      doc.setFont("helvetica", "normal");
      const obsTexto = cabecera.observaciones_generales || "Sin observaciones.";
      const obsLineas = doc.splitTextToSize(obsTexto, 182);
      doc.text(obsLineas, 14, finalY + 13);

      const pdfBlob = doc.output("blob");
      window.open(URL.createObjectURL(pdfBlob), "_blank");
    } catch (error) {
      console.error("Error al generar el PDF:", error);
      alert("Ocurrió un error al generar la vista previa del PDF.");
    }
  };

  const handleGuardarYExportar = async (accion) => {
    setMostrarOpcionesExportarArriba(false);
    setMostrarOpcionesExportarAbajo(false);

    try {
      if (formRef.current) {
        formRef.current.requestSubmit();
      }

      if (accion === "excel") {
        await handleExportExcel();
      } else if (accion === "pdf") {
        handleExportPDF();
      }
    } catch (error) {
      console.error("Error al procesar la acción:", error);
    }
  };

  const validarFormularioCompleto = () => {
    let esValido = true;
    const errFecha = validarCampoCabecera("fecha", cabecera.fecha);
    const errEntregado = validarCampoCabecera("entregado_por", cabecera.entregado_por);
    const errRetirado = validarCampoCabecera("retirado_por", cabecera.retirado_por);

    if (errFecha || errEntregado || errRetirado) esValido = false;

    detalles.forEach((item, index) => {
      const errMat = validarCampoDetalle(index, "material", item.material);
      const errCant = validarCampoDetalle(index, "cantidad_despachada", item.cantidad_despachada);
      if (errMat || errCant) esValido = false;
    });

    return esValido;
  };

  // --- ENVÍO DE DATOS MEDIANTE FORMDATA PARA ARCHIVOS (IMÁGENES) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormularioCompleto()) return;

    const formData = new FormData();
    formData.append("codigo_retiro", cabecera.codigo_retiro);
    formData.append("fecha", cabecera.fecha);
    formData.append("ceco", cabecera.ceco);
    formData.append("unidad_tecnica", cabecera.unidad_tecnica);
    formData.append("entregado_por", cabecera.entregado_por);
    formData.append("retirado_por", cabecera.retirado_por);
    formData.append("destino_circuito", cabecera.observaciones_generales);
    if (user?.id) formData.append("usuario_id", user.id);
    if (user?.nombreCompleto) formData.append("usuario_nombre", user.nombreCompleto);

    // Mapeo de detalles como JSON string para enviarse en FormData
    const detallesFormateados = detalles.map((item) => ({
      material: item.material,
      cantidad: parseInt(String(item.cantidad_despachada).replace(",", ".").split(".")[0], 10),
      unidad_medida: item.unidad_medida,
      condicion: item.condicion,
      observacion: item.observacion,
      pag: item.pag,
      origen: item.origen || "M",
    }));
    formData.append("detalles", JSON.stringify(detallesFormateados));

    // Adjuntar imágenes si existen
    if (imagenesSoporte.imagen_soporte_1) {
      formData.append("imagen_soporte_1", imagenesSoporte.imagen_soporte_1);
    }
    if (imagenesSoporte.imagen_soporte_2) {
      formData.append("imagen_soporte_2", imagenesSoporte.imagen_soporte_2);
    }

    try {
      const res = await fetch("http://localhost:8000/api/cartas-retiro/", {
        method: "POST",
        body: formData, // Enviar como multipart/form-data
      });

      const respuestaTexto = await res.text();
      let data = null;

      try {
        data = JSON.parse(respuestaTexto);
      } catch {
        data = respuestaTexto;
      }

      if (res.ok) {
        window.dispatchEvent(new Event("liberaciones-actualizadas"));
        
        // 👈 Limpiar las imágenes aquí al tener éxito
        setImagenesSoporte({ imagen_soporte_1: null, imagen_soporte_2: null });

        if (data?.solicitudes_creadas > 0) {
          alert(
            `Carta de Retiro registrada. El stock de Mantenimiento fue descontado de inmediato y ${data.solicitudes_creadas} solicitud(es) de material de Obra quedaron PENDIENTES de aprobación por el administrador.`
          );
        } else {
          alert("Carta de Retiro procesada y stock de Mantenimiento actualizado correctamente.");
        }
        if (alGuardarExito) alGuardarExito();
        onClose();
      } else {
        let mensajeError = "Error en la solicitud";
        if (data && typeof data === "object") {
          mensajeError = Object.entries(data)
            .map(([campo, msgs]) => `${campo.toUpperCase()}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
            .join("\n");
        } else if (typeof data === "string") {
          mensajeError = data;
        }
        alert("Error al procesar carta de retiro:\n\n" + mensajeError);
      }
    } catch (error) {
      alert("Error de conexión con el servidor: " + error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className={`modal-content ${esMaximizado ? "modal-maximizado" : ""}`}
        style={{
          transform: esMaximizado ? "none" : `translate(${posicion.x}px, ${posicion.y}px)`,
          transition: estaArrastrando ? "none" : "all 0.2s ease-out",
        }}
      >
        {/* BARRA SUPERIOR ARRASTRABLE Y CON BOTÓN DE MAXIMIZAR */}
        <div onMouseDown={!esMaximizado ? iniciarArrastre : undefined} className="modal-header">
          <div className="modal-header-info">
            <span className="modal-header-icon"><ClipboardList size={22} /></span>
            <div>
              <h2 className="modal-title">Retiro y Devolución de Materiales (KARDEX RD)</h2>
              <span className="modal-subtitle">
                {esMaximizado ? "Ventana maximizada" : "Mantén presionado en este encabezado para mover la ventana"}
              </span>
            </div>
          </div>

          <div className="modal-header-controls no-drag" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={toggleMaximizar}
              className="btn-header-action"
              title={esMaximizado ? "Restaurar tamaño" : "Maximizar ventana"}
            >
              {esMaximizado ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-close-modal"
              title="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* HERRAMIENTAS / MENÚ DESPLEGABLE SUPERIOR DE EXPORTACIÓN */}
        <div className="modal-toolbar">
          <div />
          <div className="dropdown-container">
            <button
              type="button"
              className="btn-green"
              onClick={() => setMostrarOpcionesExportarArriba(!mostrarOpcionesExportarArriba)}
            >
              <Save size={16} />
              <span>Guardar y Exportar</span>
              <ChevronDown size={14} />
            </button>

            {mostrarOpcionesExportarArriba && (
              <div className="dropdown-menu">
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleGuardarYExportar("guardar")}
                >
                  <Save size={15} /> Solo Guardar
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleGuardarYExportar("excel")}
                >
                  <FileSpreadsheet size={15} /> Exportar en Excel
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleGuardarYExportar("pdf")}
                >
                  <FileText size={15} /> Exportar en PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CONTENIDO MODAL */}
        <div className="modal-body">
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            
            {/* DATOS ADMINISTRATIVOS */}
            <div className="card-container bg-slate-50">
              <h3 className="card-title">Datos Administrativos</h3>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    01.- Fecha <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="date"
                    value={cabecera.fecha}
                    onChange={(e) => handleCabeceraChange("fecha", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("fecha", e.target.value)}
                    className={`form-input ${errors.cabecera?.fecha ? "input-error" : ""}`}
                  />
                  {errors.cabecera?.fecha && <span className="error-text">{errors.cabecera.fecha}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    06.- N° Orden / Acta <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={cabecera.codigo_retiro}
                    readOnly
                    disabled
                    className="form-input input-disabled"
                  />
                  {errors.cabecera?.codigo_retiro && (
                    <span className="error-text">{errors.cabecera.codigo_retiro}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo Movimiento</label>
                  <select
                    value={cabecera.tipo_movimiento}
                    onChange={(e) => handleCabeceraChange("tipo_movimiento", e.target.value)}
                    className="form-input"
                  >
                    <option value="SALIDA">04.- Retiro (Salida)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Estructura</label>
                  <input type="text" value={ESTRUCTU_DEFAULT} disabled readOnly className="form-input input-disabled" />
                </div>

                <div className="form-group grid-col-2">
                  <label className="form-label">02.- CECO</label>
                  <input
                    type="text"
                    value={`${CECO_CODIGO} - ${CECO_NOMBRE}`}
                    disabled
                    readOnly
                    className="form-input input-disabled"
                  />
                </div>

                <div className="form-group grid-col-2">
                  <label className="form-label">05.- Unidad Técnica</label>
                  <input type="text" value={UNIDAD_TECNICA_DEFAULT} disabled readOnly className="form-input input-disabled" />
                </div>
              </div>
            </div>

            {/* TABLA DE MATERIALES */}
            <div className="card-container">
              <div className="table-header-tools">
                <h3 className="card-title-sm">Detalle de Materiales</h3>
                <button type="button" onClick={agregarFila} className="btn-primary-sm">
                  + Agregar Renglón
                </button>
              </div>

              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: "160px" }}>07. Código SAP *</th>
                      <th style={{ minWidth: "180px" }}>08. Descripción</th>
                      <th style={{ width: "65px", textAlign: "center" }}>09. U/M</th>
                      <th style={{ width: "120px", textAlign: "center" }}>10. Cond.</th>
                      <th style={{ width: "140px", textAlign: "center" }}>Origen *</th>
                      <th style={{ width: "110px", textAlign: "center" }}>11. Cant. Desp. *</th>
                      <th style={{ width: "90px", textAlign: "center" }}>12. Cant. Dev.</th>
                      <th style={{ minWidth: "140px" }}>13. Observaciones</th>
                      <th style={{ width: "50px", textAlign: "center" }}>14. Pág</th>
                      <th style={{ width: "50px", textAlign: "center" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((mat, idx) => {
                      const errDetalle = errors.detalles[idx] || {};
                      return (
                        <tr key={idx}>
                          <td>
                            <select
                              value={mat.material}
                              onChange={(e) => handleChangeDetalle(idx, "material", e.target.value)}
                              onBlur={(e) => validarCampoDetalle(idx, "material", e.target.value)}
                              className={`form-input ${errDetalle.material ? "input-error" : ""}`}
                            >
                              <option value="">Seleccione...</option>
                              {materialList.map((m) => (
                                <option key={m.codigo} value={m.codigo}>
                                  {m.codigo} - {m.descripcion || m.nombre}
                                </option>
                              ))}
                            </select>
                            {errDetalle.material && <span className="error-text">{errDetalle.material}</span>}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={mat.descripcion}
                              onChange={(e) => handleChangeDetalle(idx, "descripcion", e.target.value)}
                              className="form-input bg-slate-50"
                              placeholder="Descripción"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={mat.unidad_medida}
                              onChange={(e) => handleChangeDetalle(idx, "unidad_medida", e.target.value)}
                              className="form-input text-center"
                            />
                          </td>
                          <td>
                            <select
                              value={mat.condicion}
                              onChange={(e) => handleChangeDetalle(idx, "condicion", e.target.value)}
                              className="form-input"
                            >
                              <option value="OPERATIVO">OPERATIVO</option>
                              <option value="DETERIORADO">DETERIORADO</option>
                              <option value="REPARACION">EN REPARACIÓN</option>
                            </select>
                          </td>
                          <td>
                            <select
                              value={mat.origen || "M"}
                              onChange={(e) => handleChangeDetalle(idx, "origen", e.target.value)}
                              className="form-input"
                              title="Origen del despacho"
                            >
                              <option value="M">M - Mantenimiento</option>
                              <option value="O">O - Obra</option>
                            </select>
                            {mat.material && (
                              <span style={{ display: "block", fontSize: "10px", color: "#64748b" }}>
                                Stock: {mat.stock_disponible ?? 0}
                              </span>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              max={mat.stock_disponible || 99999}
                              value={mat.cantidad_despachada}
                              onChange={(e) => handleChangeDetalle(idx, "cantidad_despachada", e.target.value)}
                              onBlur={(e) => validarCampoDetalle(idx, "cantidad_despachada", e.target.value, mat)}
                              className={`form-input text-right font-bold ${errDetalle.cantidad_despachada ? "input-error" : ""}`}
                            />
                            {errDetalle.cantidad_despachada && (
                              <span className="error-text" style={{ color: "#dc2626", fontSize: "11px", display: "block" }}>
                                {errDetalle.cantidad_despachada}
                              </span>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0"
                              value={mat.cantidad_devuelta}
                              onChange={(e) => handleChangeDetalle(idx, "cantidad_devuelta", e.target.value)}
                              className="form-input text-right"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={mat.observacion}
                              onChange={(e) => handleChangeDetalle(idx, "observacion", e.target.value)}
                              className="form-input"
                            />
                          </td>
                          {/* CAMPO PÁG BLOQUEADO / NO EDITABLE */}
                          <td>
                            <input
                              type="text"
                              value={mat.pag}
                              readOnly
                              disabled
                              className="form-input text-center input-disabled"
                              title="Página / Folio generado automáticamente por el Kardex"
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => eliminarFila(idx)}
                              disabled={detalles.length === 1}
                              className="btn-danger-square"
                              title="Eliminar renglón"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECCIÓN DE IMÁGENES DE SOPORTE DE LA CARTA DE RETIRO CON ICONO UPLOAD */}
            <div className="card-container bg-slate-50" style={{ marginBottom: "16px" }}>
              <h3 className="card-title-sm" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Image size={18} /> Imágenes de Soporte Documental (Opcional)
              </h3>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Upload size={14} /> Soporte Fotográfico 1:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={(e) =>
                      setImagenesSoporte((prev) => ({
                        ...prev,
                        imagen_soporte_1: e.target.files[0] || null,
                      }))
                    }
                  />
                  {imagenesSoporte.imagen_soporte_1 && (
                    <span style={{ fontSize: "11px", color: "#059669", marginTop: "4px", display: "block" }}>
                      ✓ {imagenesSoporte.imagen_soporte_1.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Upload size={14} /> Soporte Fotográfico 2:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={(e) =>
                      setImagenesSoporte((prev) => ({
                        ...prev,
                        imagen_soporte_2: e.target.files[0] || null,
                      }))
                    }
                  />
                  {imagenesSoporte.imagen_soporte_2 && (
                    <span style={{ fontSize: "11px", color: "#059669", marginTop: "4px", display: "block" }}>
                      ✓ {imagenesSoporte.imagen_soporte_2.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* OBSERVACIONES Y PERSONAL */}
            <div className="card-container bg-slate-50">
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label">15.- Observaciones Generales</label>
                <textarea
                  rows="2"
                  value={cabecera.observaciones_generales}
                  onChange={(e) => handleCabeceraChange("observaciones_generales", e.target.value)}
                  placeholder="Ej. Material asignado para sustitución de transformador..."
                  className="form-input"
                ></textarea>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    16.- Entregado Por <span className="required-asterisk">*</span>
                  </label>
                  <select
                    value={cabecera.entregado_por}
                    onChange={(e) => handleCabeceraChange("entregado_por", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("entregado_por", e.target.value)}
                    className={`form-input ${errors.cabecera?.entregado_por ? "input-error" : ""}`}
                  >
                    <option value="">Seleccione Personal...</option>
                    {personalList.map((p) => (
                      <option key={p.id || p.cedula} value={p.cedula}>
                        {p.cedula} - {p.nombre} {p.apellido}
                      </option>
                    ))}
                  </select>
                  {errors.cabecera?.entregado_por && (
                    <span className="error-text">{errors.cabecera.entregado_por}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    17.- Recibido / Retirado Por <span className="required-asterisk">*</span>
                  </label>
                  <select
                    value={cabecera.retirado_por}
                    onChange={(e) => handleCabeceraChange("retirado_por", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("retirado_por", e.target.value)}
                    className={`form-input ${errors.cabecera?.retirado_por ? "input-error" : ""}`}
                  >
                    <option value="">Seleccione Personal...</option>
                    {personalList.map((p) => (
                      <option key={p.id || p.cedula} value={p.cedula}>
                        {p.cedula} - {p.nombre} {p.apellido}
                      </option>
                    ))}
                  </select>
                  {errors.cabecera?.retirado_por && (
                    <span className="error-text">{errors.cabecera.retirado_por}</span>
                  )}
                </div>
              </div>
            </div>

            {/* BOTONES INFERIORES Y MENÚ DESPLEGABLE DE EXPORTACIÓN */}
            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>

              <div className="dropdown-container">
                <button
                  type="button"
                  className="btn-green"
                  onClick={() => setMostrarOpcionesExportarAbajo(!mostrarOpcionesExportarAbajo)}
                >
                  <Save size={16} /> Guardar y Exportar <ChevronDown size={14} />
                </button>

                {mostrarOpcionesExportarAbajo && (
                  <div className="dropdown-menu" style={{ top: "auto", bottom: "100%", marginTop: 0, marginBottom: "4px" }}>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleGuardarYExportar("guardar")}
                    >
                      <Save size={15} /> Solo Guardar
                    </button>
                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleGuardarYExportar("excel")}
                    >
                      <FileSpreadsheet size={15} /> Exportar en Excel
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleGuardarYExportar("pdf")}
                    >
                      <FileText size={15} /> Exportar en PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}