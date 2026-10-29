import { useState, useEffect, useRef } from "react";
import { RotateCcw, Maximize2, Minimize2, X, FileSpreadsheet, FolderOpen, ClipboardList, Package, Save, ChevronDown, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ModalDevolucion({ isOpen, onClose, alGuardarExito }) {
  const formRef = useRef(null);
  const [esMaximizado, setEsMaximizado] = useState(false);

  const toggleMaximizar = () => {
    setEsMaximizado((prev) => !prev);
    setPosicion({ x: 0, y: 0 });
  };

  const [mostrarOpcionesExportar, setMostrarOpcionesExportar] = useState(false);

  const [cartasRetiroList, setCartasRetiroList] = useState([]);
  const [personalList, setPersonalList] = useState([]);
  const [cartaSeleccionadaId, setCartaSeleccionadaId] = useState("");

  const [cabecera, setCabecera] = useState({
    codigo_retiro: "",
    fecha_devolucion: new Date().toISOString().split("T")[0],
    tipo_movimiento: "ENTRADA",
    devuelto_por: "",
    recibido_por: "",
    observaciones_devolucion: "",
  });

  const [detalles, setDetalles] = useState([]);
  const [errors, setErrors] = useState({ cabecera: {}, detalles: [] });

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
      fetch("http://localhost:8000/api/cartas-retiro/")
        .then((res) => res.json())
        .then((data) => setCartasRetiroList(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Error al cargar cartas de retiro:", err));

      fetch("http://localhost:8000/api/personal/")
        .then((res) => res.json())
        .then((data) => setPersonalList(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Error al cargar personal:", err));
    }
  }, [isOpen]);

  const validarCampoCabecera = (campo, valor) => {
    let mensaje = "";
    if (campo === "codigo_retiro" && !valor) mensaje = "Seleccione un Acta Origen.";
    if (campo === "fecha_devolucion" && !valor) mensaje = "La fecha de devolución es requerida.";
    if (campo === "devuelto_por" && !valor) mensaje = "Seleccione la persona que devuelve.";
    if (campo === "recibido_por" && !valor) mensaje = "Seleccione la persona que recibe en almacén.";

    setErrors((prev) => ({
      ...prev,
      cabecera: { ...prev.cabecera, [campo]: mensaje },
    }));
    return mensaje;
  };

  const handleSeleccionarCarta = (codigo) => {
    setCartaSeleccionadaId(codigo);
    validarCampoCabecera("codigo_retiro", codigo);

    if (!codigo) {
      setDetalles([]);
      setErrors((prev) => ({ ...prev, detalles: [] }));
      return;
    }

    const carta = cartasRetiroList.find((c) => String(c.codigo_retiro) === String(codigo));
    if (carta && carta.detalles) {
      const dev = carta.retirado_por || cabecera.devuelto_por;
      const rec = carta.entregado_por || cabecera.recibido_por;

      setCabecera((prev) => ({
        ...prev,
        codigo_retiro: carta.codigo_retiro,
        recibido_por: rec,
        devuelto_por: dev,
      }));

      const mapaAgrupado = {};

      carta.detalles.forEach((d) => {
        const cod = d.codigo_sap || d.material_codigo || (typeof d.material === "object" ? d.material?.codigo : d.material);
        const descCandidata = d.descripcion || d.material_nombre || (typeof d.material === "object" ? d.material?.nombre : null);
        const desc = descCandidata && descCandidata !== "Material sin descripción" ? descCandidata : "";
        const um = d.unidad_medida || (typeof d.material === "object" ? d.material?.unidad_medida : null) || "UND";

        const despachado = Number(d.cantidad || 0);
        const yaDevuelto = Number(d.cantidad_devuelta || 0);

        if (!mapaAgrupado[cod]) {
          mapaAgrupado[cod] = {
            material_id: typeof d.material === "object" ? d.material?.codigo : d.material,
            codigo_sap: cod,
            descripcion: desc || "Material sin descripción",
            unidad_medida: um,
            cantidad_despachada: despachado,
            cantidad_devuelta: yaDevuelto,
            nueva_devolucion: 0,
            condicion: d.condicion || "OPERATIVO",
            observacion: "",
          };
        } else {
          mapaAgrupado[cod].cantidad_despachada += despachado;
          mapaAgrupado[cod].cantidad_devuelta += yaDevuelto;

          if (desc && mapaAgrupado[cod].descripcion === "Material sin descripción") {
            mapaAgrupado[cod].descripcion = desc;
          }
        }
      });

      const nuevosDetalles = Object.values(mapaAgrupado).map((item) => {
        const disponible = Math.max(0, item.cantidad_despachada - item.cantidad_devuelta);
        return {
          ...item,
          disponible_devolucion: disponible,
          nueva_devolucion: 0,
        };
      });

      setDetalles(nuevosDetalles);

      const erroresDetalles = nuevosDetalles.map((item) => {
        if (item.disponible_devolucion === 0) {
          return { nueva_devolucion: `Material devuelto en su totalidad (${item.cantidad_devuelta} de ${item.cantidad_despachada}).` };
        }
        return {};
      });

      setErrors((prev) => ({
        ...prev,
        detalles: erroresDetalles,
      }));
    } else {
      setDetalles([]);
      setErrors((prev) => ({ ...prev, detalles: [] }));
    }
  };

  const validarCampoDetalle = (index, campo, valor, itemActual) => {
    let mensaje = "";
    if (campo === "nueva_devolucion") {
      const cant = parseInt(valor, 10);
      const limiteMaximo = itemActual.disponible_devolucion !== undefined 
        ? itemActual.disponible_devolucion 
        : Number(itemActual.cantidad_despachada || 0);

      if (isNaN(cant) || cant <= 0) {
        mensaje = "La cantidad a devolver debe ser mayor a 0.";
      } else if (cant > limiteMaximo) {
        mensaje = `Máximo disponible para devolver: ${limiteMaximo}`;
      }
    }

    setErrors((prev) => {
      const nuevosErrores = [...prev.detalles];
      nuevosErrores[index] = { ...nuevosErrores[index], [campo]: mensaje };
      return { ...prev, detalles: nuevosErrores };
    });
    return mensaje;
  };

  const handleCabeceraChange = (campo, valor) => {
    setCabecera((prev) => ({ ...prev, [campo]: valor }));
    validarCampoCabecera(campo, valor);
  };

  const handleChangeDetalle = (index, campo, valor) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index][campo] = valor;
    setDetalles(nuevosDetalles);
    validarCampoDetalle(index, campo, valor, nuevosDetalles[index]);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (!rows || rows.length === 0) {
          alert("El archivo Excel está vacío.");
          return;
        }

        let headerIndex = rows.findIndex((row) =>
          row.some((cell) => {
            const txt = String(cell).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return txt.includes("CODIGO SAP") || txt.includes("SAP");
          })
        );
        if (headerIndex === -1) headerIndex = 0;
        const headers = rows[headerIndex].map((h) => String(h).trim());

        const rawJson = [];
        for (let i = headerIndex + 1; i < rows.length; i++) {
          const rowData = rows[i];
          if (!rowData || rowData.length === 0) continue;
          const rowObj = {};
          headers.forEach((header, colIdx) => {
            if (header) rowObj[header] = rowData[colIdx] !== undefined ? rowData[colIdx] : "";
          });
          rawJson.push(rowObj);
        }

        const listaMapeada = rawJson.map((fila) => {
          const obtenerValor = (...claves) => {
            for (let key of Object.keys(fila)) {
              const keyNormalizada = key.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
              for (let c of claves) {
                if (keyNormalizada.includes(c.toUpperCase().replace(/[^A-Z0-9]/g, ""))) return fila[key];
              }
            }
            return "";
          };
          return {
            codigo_sap: obtenerValor("CODIGOSAP", "CODIGO_SAP", "SAP"),
            descripcion: obtenerValor("DESCRIPCION", "MATERIAL", "NOMBRE"),
            unidad_medida: obtenerValor("UM", "UNIDAD") || "UND",
            cantidad_despachada: Number(obtenerValor("CANTDESP", "DESPACHADO", "CANTIDAD") || 0),
            nueva_devolucion: Number(obtenerValor("CANTDEV", "DEVOLVER") || 0),
            condicion: obtenerValor("COND", "CONDICION") || "OPERATIVO",
            observacion: obtenerValor("OBSERVACION") || "",
          };
        }).filter((item) => item.codigo_sap);

        if (listaMapeada.length > 0) {
          setDetalles(listaMapeada);
          setErrors((prev) => ({ ...prev, detalles: listaMapeada.map(() => ({})) }));
          alert("¡Datos importados correctamente del archivo!");
        }
      } catch (err) {
        console.error("Error al procesar Excel:", err);
        alert("Ocurrió un error al leer el archivo.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = async () => {
    try {
      const payload = {
        info_producto: {
          codigo_sap: cabecera.codigo_retiro,
          fecha_ingresada: cabecera.fecha_devolucion,
          entregado_por: cabecera.devuelto_por,
          retirado_por: cabecera.recibido_por,
          destino_circuito: cabecera.observaciones_devolucion,
        },
        detalles: detalles.map((d) => ({
          codigo_sap: d.codigo_sap,
          descripcion: d.descripcion,
          unidad_medida: d.unidad_medida,
          estado: d.condicion,
          cantidad_despachada: d.cantidad_despachada,
          cantidad_devuelta: d.nueva_devolucion,
          observacion: d.observacion,
        })),
      };

      await fetch("http://localhost:8000/api/kardex/excel/generar/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Error exportar Excel:", err);
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("CORPOELEC - DEVOLUCIÓN Y REINGRESO DE MATERIALES", 105, 12, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Acta Origen:", 14, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`${cabecera.codigo_retiro || "-"}`, 36, 20);

      doc.setFont("helvetica", "bold");
      doc.text("Fecha Devolución:", 120, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`${cabecera.fecha_devolucion}`, 148, 20);

      const headers = [["N°", "Código SAP", "Descripción", "U/M", "Desp.", "A Devolver", "Cond.", "Observación"]];
      const dataFilas = detalles.map((item, index) => [
        index + 1,
        item.codigo_sap || "-",
        item.descripcion || "-",
        item.unidad_medida || "UND",
        item.cantidad_despachada || "0",
        item.nueva_devolucion || "0",
        item.condicion || "OPERATIVO",
        item.observacion || "-",
      ]);

      autoTable(doc, {
        startY: 26,
        head: headers,
        body: dataFilas,
        theme: "grid",
        margin: { left: 14, right: 14 },
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          fontSize: 7.5,
        },
        styles: { fontSize: 7.5, cellPadding: 2 },
      });

      const finalY = doc.lastAutoTable.finalY || 150;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Observaciones:", 14, finalY + 8);

      doc.setFont("helvetica", "normal");
      const obsTexto = cabecera.observaciones_devolucion || "Sin observaciones.";
      doc.text(doc.splitTextToSize(obsTexto, 182), 14, finalY + 13);

      const pdfBlob = doc.output("blob");
      window.open(URL.createObjectURL(pdfBlob), "_blank");
    } catch (error) {
      console.error("Error al generar PDF:", error);
      alert("Ocurrió un error al generar la vista previa del PDF.");
    }
  };

  const handleGuardarYExportar = async (accion) => {
    setMostrarOpcionesExportar(false);
    if (formRef.current) formRef.current.requestSubmit();

    if (accion === "excel") await handleExportExcel();
    else if (accion === "pdf") handleExportPDF();
  };

  const validarFormularioCompleto = () => {
    let esValido = true;
    const errActa = validarCampoCabecera("codigo_retiro", cabecera.codigo_retiro);
    const errFecha = validarCampoCabecera("fecha_devolucion", cabecera.fecha_devolucion);
    const errDevuelto = validarCampoCabecera("devuelto_por", cabecera.devuelto_por);
    const errRecibido = validarCampoCabecera("recibido_por", cabecera.recibido_por);

    if (errActa || errFecha || errDevuelto || errRecibido) esValido = false;

    let alMenosUnoParaDevolver = false;
    detalles.forEach((item, index) => {
      const errCant = validarCampoDetalle(index, "nueva_devolucion", item.nueva_devolucion, item);
      if (errCant) esValido = false;
      if (parseFloat(item.nueva_devolucion) > 0) alMenosUnoParaDevolver = true;
    });

    if (!alMenosUnoParaDevolver) {
      alert("Debe ingresar al menos una cantidad mayor a 0 para devolver.");
      esValido = false;
    }

    return esValido;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormularioCompleto()) return;

    const itemsADevolver = detalles.filter((d) => Number(d.nueva_devolucion) > 0);

    const payload = {
      carta_retiro: cabecera.codigo_retiro,
      fecha_devolucion: cabecera.fecha_devolucion,
      devuelto_por: cabecera.devuelto_por,
      recibido_por: cabecera.recibido_por,
      observaciones: cabecera.observaciones_devolucion,
      detalles: itemsADevolver.map((item) => ({
        material: item.material_id,
        material_codigo: item.codigo_sap,
        cantidad: parseInt(item.nueva_devolucion) || 0,
        cantidad_devuelta: parseInt(item.nueva_devolucion) || 0,
        estado: item.condicion,
        condicion: item.condicion,
        observacion: item.observacion,
      })),
    };

    try {
      const res = await fetch("http://localhost:8000/api/cartas-devolucion/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        alert("¡Devolución registrada correctamente! El stock fue actualizado.");
        if (alGuardarExito) alGuardarExito();
        onClose();
      } else {
        alert("Error al procesar la devolución: " + JSON.stringify(data));
      }
    } catch (err) {
      alert("Error de conexión con el servidor: " + err.message);
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
        {/* BARRA SUPERIOR ARRASTRABLE Y CONTROLES DE VENTANA */}
        <div onMouseDown={!esMaximizado ? iniciarArrastre : undefined} className="modal-header">
          <div className="modal-header-info">
            <span className="modal-header-icon"><RotateCcw size={22} /></span>
            <div>
              <h2 className="modal-title">Devolución y Reingreso de Materiales</h2>
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
            <button type="button" onClick={onClose} className="btn-close-modal" title="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="modal-body">
          {/* BOTÓN DE IMPORTACIÓN EXCEL */}
          <div
            style={{
              border: "2px dashed #a7f3d0",
              backgroundColor: "#ecfdf5",
              borderRadius: "8px",
              padding: "15px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong style={{ fontSize: "13px", color: "#065f46", display: "flex", alignItems: "center", gap: "6px" }}>
                <FileSpreadsheet size={16} /> Importar Datos desde Excel / CSV
              </strong>
              <span style={{ fontSize: "11px", color: "#047857" }}>
                Cargue un archivo para auto-completar las cantidades a devolver.
              </span>
            </div>
            <label
              style={{
                backgroundColor: "#059669",
                color: "#fff",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FolderOpen size={16} /> Cargar Excel / CSV
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            {/* INFORMACIÓN GENERAL */}
            <div className="card-container bg-slate-50" style={{ padding: "15px", marginBottom: "20px" }}>
              <h3 className="card-title" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#059669", marginBottom: "12px" }}>
                <ClipboardList size={18} /> Información General de Devolución
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" }}>
                <div className="form-group">
                  <label className="form-label">
                    N° Orden / Acta Origen <span className="required-asterisk">*</span>
                  </label>
                  <select
                    value={cartaSeleccionadaId}
                    onChange={(e) => handleSeleccionarCarta(e.target.value)}
                    className={`form-input ${errors.cabecera?.codigo_retiro ? "input-error" : ""}`}
                  >
                    <option value="">Seleccione Acta...</option>
                    {cartasRetiroList.map((c) => {
                      const fechaCruda = c.fecha_hora || c.fecha || "";
                      const fechaFormateada = fechaCruda ? fechaCruda.split("T")[0] : "Sin fecha";
                      
                      return (
                        <option key={c.id || c.codigo_retiro} value={c.codigo_retiro}>
                          Acta N° {c.codigo_retiro} ({fechaFormateada})
                        </option>
                      );
                    })}
                  </select>
                  {errors.cabecera?.codigo_retiro && (
                    <span className="error-text">{errors.cabecera.codigo_retiro}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo Movimiento</label>
                  <select
                    value={cabecera.tipo_movimiento}
                    onChange={(e) => setCabecera({ ...cabecera, tipo_movimiento: e.target.value })}
                    className="form-input input-disabled"
                    disabled
                  >
                    <option value="ENTRADA">03.- Devolución (Entrada)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Fecha de Devolución <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="date"
                    value={cabecera.fecha_devolucion}
                    onChange={(e) => handleCabeceraChange("fecha_devolucion", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("fecha_devolucion", e.target.value)}
                    className={`form-input ${errors.cabecera?.fecha_devolucion ? "input-error" : ""}`}
                  />
                  {errors.cabecera?.fecha_devolucion && (
                    <span className="error-text">{errors.cabecera.fecha_devolucion}</span>
                  )}
                </div>
              </div>
            </div>

            {/* TABLA DE MATERIALES */}
            <div className="card-container" style={{ marginBottom: "20px" }}>
              <h3 className="card-title-sm" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#059669", marginBottom: "10px" }}>
                <Package size={18} /> Cantidades a Reingresar al Inventario
              </h3>

              {detalles.length === 0 ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    backgroundColor: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "8px",
                    color: "#64748b",
                    fontSize: "13px",
                  }}
                >
                  Seleccione un Acta de Retiro arriba o presione "Cargar Excel / CSV" para cargar los items.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                        <th>Código SAP</th>
                        <th>Descripción</th>
                        <th style={{ textAlign: "center" }}>U/M</th>
                        <th style={{ textAlign: "center" }}>Despachado</th>
                        <th style={{ textAlign: "center", width: "120px" }}>Cant. A Devolver *</th>
                        <th style={{ textAlign: "center", width: "130px" }}>Condición</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalles.map((item, idx) => {
                        const errDetalle = errors.detalles[idx] || {};
                        return (
                          <tr key={idx}>
                            <td><strong>{item.codigo_sap}</strong></td>
                            <td>{item.descripcion}</td>
                            <td className="text-center">{item.unidad_medida}</td>
                            <td className="text-center font-bold" style={{ color: "#2563eb" }}>
                              {item.cantidad_despachada}
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={item.cantidad_despachada || 9999}
                                value={item.nueva_devolucion}
                                onChange={(e) => handleChangeDetalle(idx, "nueva_devolucion", e.target.value)}
                                onBlur={(e) => validarCampoDetalle(idx, "nueva_devolucion", e.target.value, item)}
                                className={`form-input text-center font-bold ${errDetalle.nueva_devolucion ? "input-error" : ""}`}
                              />
                              {errDetalle.nueva_devolucion && (
                                <span className="error-text" style={{ color: "#dc2626", fontSize: "11px", display: "block", marginTop: "4px" }}>
                                  {errDetalle.nueva_devolucion}
                                </span>
                              )}
                            </td>
                            <td>
                              <select
                                value={item.condicion}
                                onChange={(e) => handleChangeDetalle(idx, "condicion", e.target.value)}
                                className="form-input"
                              >
                                <option value="OPERATIVO">OPERATIVO</option>
                                <option value="DETERIORADO">DETERIORADO</option>
                                <option value="REPARACION">EN REPARACIÓN</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={item.observacion}
                                onChange={(e) => handleChangeDetalle(idx, "observacion", e.target.value)}
                                placeholder="Ej. Reingreso en buen estado"
                                className="form-input"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* OBSERVACIONES Y PERSONAL */}
            <div className="card-container bg-slate-50" style={{ padding: "15px", marginBottom: "20px" }}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" style={{ color: "#059669", textAlign: "center" }}>
                  Observaciones de la Devolución
                </label>
                <textarea
                  rows="2"
                  value={cabecera.observaciones_devolucion}
                  onChange={(e) => setCabecera({ ...cabecera, observaciones_devolucion: e.target.value })}
                  placeholder="Motivo de devolución, detalles del estado del material..."
                  className="form-input"
                ></textarea>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" style={{ color: "#059669" }}>
                    Personal que Devuelve <span className="required-asterisk">*</span>
                  </label>
                  <select
                    value={cabecera.devuelto_por}
                    onChange={(e) => handleCabeceraChange("devuelto_por", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("devuelto_por", e.target.value)}
                    className={`form-input ${errors.cabecera?.devuelto_por ? "input-error" : ""}`}
                  >
                    <option value="">Seleccione Personal...</option>
                    {personalList.map((p) => (
                      <option key={p.id || p.cedula} value={p.cedula}>
                        {p.cedula} - {p.nombre} {p.apellido}
                      </option>
                    ))}
                  </select>
                  {errors.cabecera?.devuelto_por && (
                    <span className="error-text">{errors.cabecera.devuelto_por}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: "#059669" }}>
                    Personal que Recibe en Almacén <span className="required-asterisk">*</span>
                  </label>
                  <select
                    value={cabecera.recibido_por}
                    onChange={(e) => handleCabeceraChange("recibido_por", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("recibido_por", e.target.value)}
                    className={`form-input ${errors.cabecera?.recibido_por ? "input-error" : ""}`}
                  >
                    <option value="">Seleccione Personal...</option>
                    {personalList.map((p) => (
                      <option key={p.id || p.cedula} value={p.cedula}>
                        {p.cedula} - {p.nombre} {p.apellido}
                      </option>
                    ))}
                  </select>
                  {errors.cabecera?.recibido_por && (
                    <span className="error-text">{errors.cabecera.recibido_por}</span>
                  )}
                </div>
              </div>
            </div>

            {/* BOTONES INFERIORES CON MENÚ DESPLEGABLE DE EXPORTACIÓN */}
            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>

              <div className="dropdown-container">
                <button
                  type="button"
                  className="btn-green"
                  onClick={() => setMostrarOpcionesExportar(!mostrarOpcionesExportar)}
                  disabled={detalles.length === 0}
                >
                  <Save size={16} /> Registrar y Exportar <ChevronDown size={14} />
                </button>

                {mostrarOpcionesExportar && (
                  <div className="dropdown-menu" style={{ top: "auto", bottom: "100%", marginBottom: "4px" }}>
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