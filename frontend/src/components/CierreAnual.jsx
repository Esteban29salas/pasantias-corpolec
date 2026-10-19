import { useState } from 'react';

export default function CierreAnual({ alCompletarCierre }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [cargando, setCargando] = useState(false);
  const [respuestaBackend, setRespuestaBackend] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!window.confirm(`¿Confirmas ejecutar el Cierre de Año Fiscal ${ano}?`)) {
      return;
    }

    setCargando(true);
    setRespuestaBackend(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/cierre-anuales/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ano: parseInt(ano, 10) })
      });

      const data = await res.json();

      if (res.ok) {
        setRespuestaBackend({ exito: true, datos: data });
        if (alCompletarCierre) alCompletarCierre();
      } else {
        setRespuestaBackend({ exito: false, errores: data });
      }
    } catch (error) {
      console.error(error);
      setRespuestaBackend({ exito: false, errores: { detalle: 'Error de conexión con el servidor.' } });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.titulo}>Cierre de Año Fiscal</h2>
      <p style={styles.descripcion}>
        Consolida los saldos finales del período y proyecta el inventario para el siguiente ejercicio.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.grupoInput}>
          <label style={styles.label}>Año del Ejercicio:</label>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            min="2020"
            max="2030"
            required
            style={styles.input}
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          style={{
            ...styles.boton,
            backgroundColor: cargando ? '#888' : '#c82333',
            cursor: cargando ? 'not-allowed' : 'pointer'
          }}
        >
          {cargando ? 'Procesando...' : `Ejecutar Cierre ${ano}`}
        </button>
      </form>

      {/* Retroalimentación basada en la respuesta del Backend */}
      {respuestaBackend && (
        <div
          style={{
            ...styles.alerta,
            backgroundColor: respuestaBackend.exito ? '#d4edda' : '#f8d7da',
            borderColor: respuestaBackend.exito ? '#c3e6cb' : '#f5c6cb',
            color: respuestaBackend.exito ? '#155724' : '#721c24'
          }}
        >
          {respuestaBackend.exito ? (
            <div>
              <strong>✓ Procesado con éxito:</strong>
              <p style={{ margin: '5px 0 0 0' }}>
                {respuestaBackend.datos.mensaje || 'Cierre registrado correctamente.'}
              </p>
            </div>
          ) : (
            <div>
              <strong>✗ Error al procesar:</strong>
              <pre style={styles.jsonError}>
                {JSON.stringify(respuestaBackend.errores, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    maxWidth: '500px',
    margin: '20px 0',
    color: '#333'
  },
  titulo: { marginTop: 0, fontSize: '20px' },
  descripcion: { fontSize: '14px', color: '#666', marginBottom: '20px' },
  form: { display: 'flex', gap: '12px', alignItems: 'flex-end' },
  grupoInput: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label: { fontSize: '13px', fontWeight: 'bold' },
  input: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' },
  boton: { padding: '9px 16px', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' },
  alerta: { marginTop: '15px', padding: '12px', borderRadius: '4px', border: '1px solid', fontSize: '14px' },
  jsonError: { margin: '5px 0 0 0', fontSize: '12px', whiteSpace: 'pre-wrap' }
};