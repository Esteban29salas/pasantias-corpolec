import { useState, useEffect, useRef } from "react";
import "../App.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ActaDeIngreso({ isOpen, onClose, alGuardarExito }) {
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
    numero_acta: "",
    fecha: new Date().toISOString().split("T")[0],
    ceco: CECO_CODIGO,
    unidad_tecnica: UNIDAD_TECNICA_DEFAULT,
    entregado_por: "",
    recibido_por: "",
    observaciones_generales: "",
  });

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
      destino: "M",
    },
  ]);

  const [errors, setErrors] = useState({
    cabecera: {},
    detalles: [{}],
  });

  const [materialList, setMaterialList] = useState([]);
  const [personalList, setPersonalList] = useState([]);

  const printRef = useRef(null);

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
      fetch("http://localhost:8000/api/materiales/")
        .then((res) => res.json())
        .then((data) => setMaterialList(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Error al cargar materiales:", err));

      fetch("http://localhost:8000/api/personal/")
        .then((res) => res.json())
        .then((data) => setPersonalList(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Error al cargar personal:", err));
    }
  }, [isOpen]);

  // Validaciones Inline
  const validarCampoCabecera = (campo, valor) => {
    let mensaje = "";

    if (campo === "numero_acta") {
      const val = String(valor).trim();
      if (!val) {
        mensaje = "El N° Orden / Acta es requerido.";
      } else if (!/^\d{1,4}$/.test(val)) {
        mensaje = "El código solo debe contener hasta 4 números (1 al 9999).";
      } else {
        const num = parseInt(val, 10);
        if (num < 1 || num > 9999) {
          mensaje = "El número debe estar entre 1 y 9999.";
        }
      }
    }

    if (campo === "fecha") {
      if (!valor) {
        mensaje = "La fecha es requerida.";
      } else {
        const fechaSeleccionada = new Date(valor);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (fechaSeleccionada > hoy) {
          mensaje = "La fecha no puede ser posterior al día de hoy.";
        }
      }
    }

    if (campo === "observaciones_generales" && !String(valor).trim()) {
      mensaje = "Las observaciones generales son requeridas.";
    }

    if (campo === "entregado_por" && !valor) {
      mensaje = "Debe seleccionar quién entrega.";
    }
    if (campo === "recibido_por" && !valor) {
      mensaje = "Debe seleccionar quién recibe.";
    }

    setErrors((prev) => ({
      ...prev,
      cabecera: {
        ...prev.cabecera,
        [campo]: mensaje,
      },
    }));
    return mensaje;
  };

  const validarCampoDetalle = (index, campo, valor) => {
    let mensaje = "";

    if (campo === "material" && !valor) {
      mensaje = "Seleccione un material.";
    }

    if (campo === "descripcion" && !String(valor).trim()) {
      mensaje = "La descripción no puede estar vacía.";
    }

    if (campo === "observacion" && !String(valor).trim()) {
      mensaje = "La observación es requerida.";
    }

    if (campo === "cantidad_despachada") {
      const valStr = String(valor).trim();
      if (!valStr) {
        mensaje = "La cantidad es requerida.";
      } else if (!/^\d+([.,]0+)?$/.test(valStr)) {
        mensaje = "Solo se permiten cantidades enteras (ej. 2, 2.00 o 2,00).";
      } else {
        const cantEntera = parseInt(valStr.replace(",", ".").split(".")[0], 10);
        if (isNaN(cantEntera) || cantEntera <= 0) {
          mensaje = "La cantidad debe ser mayor a 0.";
        }
      }
    }

    setErrors((prev) => {
      const nuevosErrores = [...(prev.detalles || [])];
      nuevosErrores[index] = {
        ...nuevosErrores[index],
        [campo]: mensaje,
      };
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

    if (campo === "material") {
      const matEncontrado = materialList.find((m) => String(m.codigo) === String(valor));
      if (matEncontrado) {
        nuevosDetalles[index].descripcion = matEncontrado.descripcion || matEncontrado.nombre || "";
        nuevosDetalles[index].unidad_medida = matEncontrado.unidad_medida || "UND";
        // Asignación automática del folio/página del Kardex si el material lo posee
        nuevosDetalles[index].pag = matEncontrado.pag_kardex ? String(matEncontrado.pag_kardex) : "1";
      }
    }

    setDetalles(nuevosDetalles);
    validarCampoDetalle(index, campo, valor);
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
        destino: "M",
      },
    ]);
    setErrors((prev) => ({
      ...prev,
      detalles: [...(prev.detalles || []), {}],
    }));
  };

  const eliminarFila = (index) => {
    if (detalles.length === 1) return;
    setDetalles(detalles.filter((_, idx) => idx !== index));
    setErrors((prev) => ({
      ...prev,
      detalles: (prev.detalles || []).filter((_, idx) => idx !== index),
    }));
  };

  // --- IMPORTACIÓN ---
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const dataJson = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!dataJson || dataJson.length === 0) {
          alert("El archivo importado no contiene filas de datos.");
          return;
        }

        const filasImportadas = dataJson.map((row) => {
          const codSap = String(row["Código SAP"] || row["Codigo"] || row["SAP"] || "").trim();
          const desc = String(row["Descripción"] || row["Descripcion"] || "").trim();
          const cant = row["Cantidad"] || row["Cant. Desp."] || 1;
          const um = String(row["U/M"] || row["Unidad"] || "UND").trim();
          const cond = String(row["Condición"] || row["Condicion"] || "OPERATIVO").trim();
          const obs = String(row["Observaciones"] || row["Observacion"] || "").trim();
          const pagina = String(row["Pág"] || "1").trim();
          const destinoRaw = String(row["Destino"] || row["Origen"] || "M").trim().toUpperCase();
          const destino = destinoRaw.startsWith("O") ? "O" : "M";

          return {
            material: codSap,
            descripcion: desc,
            unidad_medida: um,
            condicion: cond,
            cantidad_despachada: cant,
            cantidad_devuelta: 0,
            observacion: obs,
            pag: pagina,
            destino,
          };
        });

        setDetalles(filasImportadas);
        setErrors((prev) => ({
          ...prev,
          detalles: filasImportadas.map(() => ({})),
        }));
        alert(`Se importaron ${filasImportadas.length} materiales desde el archivo correctamente.`);
      } catch (err) {
        alert("Error al leer el archivo Excel/CSV: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- EXPORTACIÓN ---
// --- EXPORTACIÓN ---
  const handleExportExcel = async () => {
    try {
      const payload = {
        info_producto: {
          codigo_sap: cabecera.numero_acta || "0000",
          fecha_ingresada: cabecera.fecha,
          entregado_por: cabecera.entregado_por,
          retirado_por: cabecera.recibido_por,
          destino_circuito: cabecera.observaciones_generales,
        },
        detalles: detalles.map((item) => {
          const matObj = materialList.find((m) => String(m.codigo) === String(item.material));
          return {
            material: matObj ? matObj.id : item.material,
            cantidad: parseInt(String(item.cantidad_despachada).replace(",", ".").split(".")[0], 10),
            unidad_medida: item.unidad_medida,
            estado: item.condicion || "OPERATIVO",
            observacion: item.observacion,
            destino: item.destino || "M",
          };
        }),
      };

      const response = await fetch("http://localhost:8000/api/kardex/excel/generar/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await response.json();
      if (!response.ok) throw new Error(res.error || "Error al generar el Excel");
      console.log(res.mensaje);
    } catch (error) {
      console.error("Error al procesar el archivo Excel:", error);
      alert("No se pudo generar ni abrir el archivo Excel.");
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("CORPOELEC - REGISTRO DE RECEPCIÓN / ACTA DE INGRESO", 105, 12, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("01.- Fecha:", 14, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`${cabecera.fecha || "-"}`, 32, 20);

      doc.setFont("helvetica", "bold");
      doc.text("06.- N° Orden / Acta:", 75, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`${cabecera.numero_acta || "S/N"}`, 108, 20);

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
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { halign: "center", cellWidth: 25 },
          2: { cellWidth: 41 },
          3: { halign: "center", cellWidth: 12 },
          4: { halign: "center", cellWidth: 20 },
          5: { halign: "center", cellWidth: 18 },
          6: { halign: "center", cellWidth: 18 },
          7: { cellWidth: 30 },
          8: { halign: "center", cellWidth: 10 },
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

      const firmaY = finalY + 28 + obsLineas.length * 4;

      const formatFirma = (personaObj, valorBase) => {
        if (!personaObj) return valorBase || "";
        const cedula = personaObj.cedula ? `V-${personaObj.cedula}` : "";
        const nombre = personaObj.nombre_completo || `${personaObj.nombre || ""} ${personaObj.apellido || ""}`.trim();
        return cedula ? `${cedula} - ${nombre}` : nombre;
      };

      const pEntregado = personalList.find(
        (p) => String(p.id) === String(cabecera.entregado_por) || String(p.cedula) === String(cabecera.entregado_por)
      );

      const pRecibido = personalList.find(
        (p) => String(p.id) === String(cabecera.recibido_por) || String(p.cedula) === String(cabecera.recibido_por)
      );

      const entregadoTexto = formatFirma(pEntregado, cabecera.entregado_por);
      const recibidoTexto = formatFirma(pRecibido, cabecera.recibido_por);

      doc.line(20, firmaY, 90, firmaY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("16.- Entregado Por:", 20, firmaY + 5);
      doc.setFont("helvetica", "normal");
      doc.text(String(entregadoTexto), 20, firmaY + 10);

      doc.line(120, firmaY, 190, firmaY);
      doc.setFont("helvetica", "bold");
      doc.text("17.- Recibido / Retirado Por:", 120, firmaY + 5);
      doc.setFont("helvetica", "normal");
      doc.text(String(recibidoTexto), 120, firmaY + 10);

      const pdfBlob = doc.output("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, "_blank");
    } catch (error) {
      console.error("Error al generar el PDF:", error);
      alert("Ocurrió un error al generar la vista previa del PDF.");
    }
  };

  const resetFormulario = () => {
    setCabecera({
      numero_acta: "",
      fecha: new Date().toISOString().split("T")[0],
      ceco: CECO_CODIGO,
      unidad_tecnica: UNIDAD_TECNICA_DEFAULT,
      entregado_por: "",
      recibido_por: "",
      observaciones_generales: "",
    });

    setDetalles([
      {
        material: "",
        descripcion: "",
        unidad_medida: "UND",
        condicion: "OPERATIVO",
        cantidad_despachada: 1,
        cantidad_devuelta: 0,
        observacion: "",
        pag: "1",
        destino: "M",
      },
    ]);

    setErrors({ cabecera: {}, detalles: [{}] });
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

    const errActa = validarCampoCabecera("numero_acta", cabecera.numero_acta);
    const errFecha = validarCampoCabecera("fecha", cabecera.fecha);
    const errObs = validarCampoCabecera("observaciones_generales", cabecera.observaciones_generales);
    const errEntregado = validarCampoCabecera("entregado_por", cabecera.entregado_por);
    const errRecibido = validarCampoCabecera("recibido_por", cabecera.recibido_por);

    if (errActa || errFecha || errObs || errEntregado || errRecibido) esValido = false;

    detalles.forEach((item, index) => {
      const errMat = validarCampoDetalle(index, "material", item.material);
      const errDesc = validarCampoDetalle(index, "descripcion", item.descripcion);
      const errCant = validarCampoDetalle(index, "cantidad_despachada", item.cantidad_despachada);
      const errObsMat = validarCampoDetalle(index, "observacion", item.observacion);

      if (errMat || errDesc || errCant || errObsMat) esValido = false;
    });

    return esValido;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormularioCompleto()) {
      return;
    }

    const datosParaEnviar = {
      numero_acta: cabecera.numero_acta,
      fecha_recepcion: cabecera.fecha,
      origen: "Almacén Principal",
      ceco: cabecera.ceco,
      unidad_tecnica: cabecera.unidad_tecnica,
      entregado_por: cabecera.entregado_por,
      recibido_por: parseInt(cabecera.recibido_por, 10),
      observaciones: cabecera.observaciones_generales,
      detalles: detalles.map((item) => ({
        material: item.material,
        cantidad: parseInt(String(item.cantidad_despachada).replace(",", ".").split(".")[0], 10),
        unidad_medida: item.unidad_medida,
        estado: item.condicion || "OPERATIVO",
        observacion: item.observacion,
        destino: item.destino || "M",
      })),
    };

    try {
      const res = await fetch("http://localhost:8000/api/actas-entrada/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosParaEnviar),
      });

      const respuestaTexto = await res.text();
      let data = null;

      try {
        data = JSON.parse(respuestaTexto);
      } catch {
        data = respuestaTexto;
      }

      if (res.ok) {
        alert("Acta de ingreso procesada y stock actualizado correctamente.");
        if (alGuardarExito) alGuardarExito();
        resetFormulario();
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
        alert("Error al procesar acta de ingreso:\n\n" + mensajeError);
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
        <div onMouseDown={iniciarArrastre} className="modal-header">
          <div className="modal-header-info">
            <span className="modal-header-icon">📦</span>
            <div>
              <h2 className="modal-title">
                Acta de Ingreso / Recepción de Materiales
              </h2>
              <span className="modal-subtitle">
                {esMaximizado ? "Ventana maximizada" : "Mantén presionado en este encabezado para mover la ventana"}
              </span>
            </div>
          </div>
          <div className="modal-header-controls no-drag" style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={toggleMaximizar}
              className="btn-header-action"
              title={esMaximizado ? "Restaurar tamaño" : "Maximizar pantalla"}
            >
              {esMaximizado ? "🗗" : "🗖"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-close-modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* HERRAMIENTAS DE IMPORTACIÓN Y EXPORTACIÓN */}
        <div className="modal-toolbar">
          <div>
            <label className="btn-blue">
              📥 Cargar Excel / CSV
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportExcel}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {/* DESPLEGABLE DE ACCIONES ARRIBA */}
          <div className="dropdown-container">
            <button
              type="button"
              className="btn-green"
              onClick={() => setMostrarOpcionesExportarArriba(!mostrarOpcionesExportarArriba)}
            >
              <span>💾</span>
              <span>Guardar y Exportar</span>
              <span style={{ fontSize: "10px" }}>▼</span>
            </button>

            {mostrarOpcionesExportarArriba && (
              <div className="dropdown-menu">
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleGuardarYExportar("guardar")}
                >
                  <span>💾</span> Solo Guardar
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleGuardarYExportar("excel")}
                >
                  <span>📊</span> Exportar en Excel
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleGuardarYExportar("pdf")}
                >
                  <span>📄</span> Exportar en PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CONTENIDO IMPRIMIBLE DEL FORMULARIO */}
        <div ref={printRef} className="modal-body">
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            {/* DATOS ADMINISTRATIVOS */}
            <div className="form-section">
              <h3 className="form-section-title">
                Datos Administrativos
              </h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    01.- Fecha <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={cabecera.fecha}
                    onChange={(e) => handleCabeceraChange("fecha", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("fecha", e.target.value)}
                    className={`form-control ${errors.cabecera?.fecha ? "is-invalid" : ""}`}
                  />
                  {errors.cabecera?.fecha && <span className="error-msg">{errors.cabecera.fecha}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    06.- N° Orden / Acta <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Ej. 1234"
                    value={cabecera.numero_acta}
                    onChange={(e) => handleCabeceraChange("numero_acta", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("numero_acta", e.target.value)}
                    className={`form-control ${errors.cabecera?.numero_acta ? "is-invalid" : ""}`}
                  />
                  {errors.cabecera?.numero_acta && (
                    <span className="error-msg">{errors.cabecera.numero_acta}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Estructura
                  </label>
                  <input type="text" value={ESTRUCTU_DEFAULT} disabled readOnly className="form-control" />
                </div>

                <div className="form-group span-2">
                  <label className="form-label">
                    02.- CECO
                  </label>
                  <input
                    type="text"
                    value={`${CECO_CODIGO} - ${CECO_NOMBRE}`}
                    disabled
                    readOnly
                    className="form-control"
                  />
                </div>

                <div className="form-group span-2">
                  <label className="form-label">
                    05.- Unidad Técnica
                  </label>
                  <input type="text" value={UNIDAD_TECNICA_DEFAULT} disabled readOnly className="form-control" />
                </div>
              </div>
            </div>

            {/* TABLA DE MATERIALES */}
            <div style={{ marginBottom: "20px" }}>
              <div className="table-header-flex">
                <h3 className="form-section-title" style={{ margin: 0 }}>
                  Detalle de Materiales
                </h3>
                <button
                  type="button"
                  onClick={agregarFila}
                  className="btn-blue"
                >
                  + Agregar Renglón
                </button>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", minWidth: "160px" }}>07. Código SAP *</th>
                      <th style={{ textAlign: "left", minWidth: "180px" }}>08. Descripción</th>
                      <th style={{ textAlign: "center", width: "65px" }}>09. U/M</th>
                      <th style={{ textAlign: "center", width: "120px" }}>10. Cond.</th>
                      <th style={{ textAlign: "center", width: "130px" }}>Destino *</th>
                      <th style={{ textAlign: "center", width: "100px" }}>11. Cant. Desp. *</th>
                      <th style={{ textAlign: "center", width: "90px" }}>12. Cant. Dev.</th>
                      <th style={{ textAlign: "left", minWidth: "140px" }}>13. Observaciones *</th>
                      <th style={{ textAlign: "center", width: "50px" }}>14. Pág</th>
                      <th style={{ textAlign: "center", width: "50px" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((mat, idx) => {
                      const errDetalle = (errors.detalles && errors.detalles[idx]) || {};
                      return (
                        <tr key={idx}>
                          <td>
                            <select
                              value={mat.material}
                              onChange={(e) => handleChangeDetalle(idx, "material", e.target.value)}
                              onBlur={(e) => validarCampoDetalle(idx, "material", e.target.value)}
                              className={`form-control ${errDetalle.material ? "is-invalid" : ""}`}
                            >
                              <option value="">
                                Seleccione...
                              </option>
                              {materialList.map((m) => (
                                <option key={m.codigo} value={m.codigo}>
                                  {m.codigo} - {m.descripcion || m.nombre}
                                </option>
                              ))}
                            </select>
                            {errDetalle.material && <span className="error-msg">{errDetalle.material}</span>}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={mat.descripcion}
                              onChange={(e) => handleChangeDetalle(idx, "descripcion", e.target.value)}
                              onBlur={(e) => validarCampoDetalle(idx, "descripcion", e.target.value)}
                              className={`form-control ${errDetalle.descripcion ? "is-invalid" : ""}`}
                              placeholder="Descripción"
                            />
                            {errDetalle.descripcion && <span className="error-msg">{errDetalle.descripcion}</span>}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={mat.unidad_medida}
                              onChange={(e) => handleChangeDetalle(idx, "unidad_medida", e.target.value)}
                              className="form-control text-center"
                            />
                          </td>
                          <td>
                            <select
                              value={mat.condicion}
                              onChange={(e) => handleChangeDetalle(idx, "condicion", e.target.value)}
                              className="form-control"
                            >
                              <option value="OPERATIVO">OPERATIVO</option>
                              <option value="DETERIORADO">DETERIORADO</option>
                              <option value="REPARACION">EN REPARACIÓN</option>
                            </select>
                          </td>
                          <td>
                            <select
                              value={mat.destino || "M"}
                              onChange={(e) => handleChangeDetalle(idx, "destino", e.target.value)}
                              className="form-control"
                              title="Destino del material ingresado"
                            >
                              <option value="M">M - Mantenimiento</option>
                              <option value="O">O - Obra</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0"
                              value={mat.cantidad_despachada}
                              onChange={(e) => handleChangeDetalle(idx, "cantidad_despachada", e.target.value)}
                              onBlur={(e) => validarCampoDetalle(idx, "cantidad_despachada", e.target.value)}
                              className={`form-control text-right ${errDetalle.cantidad_despachada ? "is-invalid" : ""}`}
                            />
                            {errDetalle.cantidad_despachada && (
                              <span className="error-msg">{errDetalle.cantidad_despachada}</span>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0"
                              value={mat.cantidad_devuelta}
                              onChange={(e) => handleChangeDetalle(idx, "cantidad_devuelta", e.target.value)}
                              className="form-control text-right"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={mat.observacion}
                              onChange={(e) => handleChangeDetalle(idx, "observacion", e.target.value)}
                              onBlur={(e) => validarCampoDetalle(idx, "observacion", e.target.value)}
                              className={`form-control ${errDetalle.observacion ? "is-invalid" : ""}`}
                              placeholder="Observación..."
                            />
                            {errDetalle.observacion && <span className="error-msg">{errDetalle.observacion}</span>}
                          </td>
                          {/* 🔒 CAMPO PÁG BLOQUEADO / NO EDITABLE */}
                          <td>
                            <input
                              type="text"
                              value={mat.pag}
                              readOnly
                              disabled
                              className="form-control text-center input-disabled"
                              title="Página / Folio generado automáticamente por el Kardex"
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => eliminarFila(idx)}
                              disabled={detalles.length === 1}
                              className="btn-danger-icon"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* OBSERVACIONES Y PERSONAL */}
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "20px" }}>
              <div className="form-group">
                <label className="form-label-blue">
                  15.- Observaciones Generales <span className="text-danger">*</span>
                </label>
                <textarea
                  rows="2"
                  value={cabecera.observaciones_generales}
                  onChange={(e) => handleCabeceraChange("observaciones_generales", e.target.value)}
                  onBlur={(e) => validarCampoCabecera("observaciones_generales", e.target.value)}
                  placeholder="Ej. Material asignado para sustitución de transformador..."
                  className={`form-control ${errors.cabecera?.observaciones_generales ? "is-invalid" : ""}`}
                ></textarea>
                {errors.cabecera?.observaciones_generales && (
                  <span className="error-msg">{errors.cabecera.observaciones_generales}</span>
                )}
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label-blue">
                    16.- Entregado Por <span className="text-danger">*</span>
                  </label>
                  <select
                    value={cabecera.entregado_por}
                    onChange={(e) => handleCabeceraChange("entregado_por", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("entregado_por", e.target.value)}
                    className={`form-control ${errors.cabecera?.entregado_por ? "is-invalid" : ""}`}
                  >
                    <option value="">
                      Seleccione Personal...
                    </option>
                    {personalList.map((p) => (
                      <option key={p.id || p.cedula} value={p.cedula}>
                        {p.cedula} - {p.nombre} {p.apellido}
                      </option>
                    ))}
                  </select>
                  {errors.cabecera?.entregado_por && (
                    <span className="error-msg">{errors.cabecera.entregado_por}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label-blue">
                    17.- Recibido / Retirado Por <span className="text-danger">*</span>
                  </label>
                  <select
                    value={cabecera.recibido_por}
                    onChange={(e) => handleCabeceraChange("recibido_por", e.target.value)}
                    onBlur={(e) => validarCampoCabecera("recibido_por", e.target.value)}
                    className={`form-control ${errors.cabecera?.recibido_por ? "is-invalid" : ""}`}
                  >
                    <option value="">
                      Seleccione Personal...
                    </option>
                    {personalList.map((p) => (
                      <option key={p.id || p.cedula} value={p.cedula}>
                        {p.cedula} - {p.nombre} {p.apellido}
                      </option>
                    ))}
                  </select>
                  {errors.cabecera?.recibido_por && (
                    <span className="error-msg">{errors.cabecera.recibido_por}</span>
                  )}
                </div>
              </div>
            </div>

            {/* BOTONES INFERIORES */}
            <div className="modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="btn-cancel"
              >
                Cancelar
              </button>

              <div className="dropdown-container">
                <button
                  type="button"
                  className="btn-green"
                  onClick={() => setMostrarOpcionesExportarAbajo(!mostrarOpcionesExportarAbajo)}
                >
                  💾 Guardar y Exportar ▼
                </button>

                {mostrarOpcionesExportarAbajo && (
                  <div className="dropdown-menu" style={{ top: "auto", bottom: "100%", marginTop: 0, marginBottom: "4px" }}>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleGuardarYExportar("guardar")}
                    >
                      💾 Solo Guardar
                    </button>
                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleGuardarYExportar("excel")}
                    >
                      📊 Exportar en Excel
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleGuardarYExportar("pdf")}
                    >
                      📄 Exportar en PDF
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