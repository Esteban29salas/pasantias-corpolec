// En src/components/KardexView.jsx
import { useState, useEffect } from 'react';

export default function KardexView({ materialId }) {
  const [kardexData, setKardexData] = useState(null);

  useEffect(() => {
    if (materialId) {
      fetch(`http://127.0.0.1:8000/api/materiales/${materialId}/kardex/`)
        .then(res => res.json())
        .then(data => setKardexData(data))
        .catch(err => console.error(err));
    }
  }, [materialId]);

  if (!kardexData) return <div>Cargando historial de Kardex...</div>;

  return (
    <div className="card p-4">
      {/* Encabezado Ficha Kardex */}
      <div className="flex justify-between items-center text-blue-400 font-bold mb-4" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>DPTO MTTO Y ATC AVER CENTRO SERVICIO LA FRIA</h2>
          <div className="mb-2 mt-2">
            <p style={{ margin: '5px 0', color: 'var(--text-secondary)' }}>
              <strong>CÓDIGO SAP:</strong> {kardexData.codigo} | <strong>DESCRIPCIÓN:</strong> {kardexData.nombre || kardexData.descripcion || 'SIN DESCRIPCIÓN'}
            </p>
          </div>
        </div>
        <div>
          <span className="text-xl" style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--table-header-bg)' }}>
            {kardexData.pag_formateado || 'PAG-000'}
          </span>
        </div>
      </div>

      {/* Tabla del Historial Kardex */}
      <div className="table-wrapper" style={{ marginTop: '20px' }}>
        <table className="custom-table w-full text-sm text-left">
          <thead>
            <tr>
              <th rowSpan="2">NÚMERO DOCUMENTO</th>
              <th rowSpan="2">FECHA</th>
              <th colSpan="2" style={{ textAlign: 'center' }}>ENTRADA</th>
              <th colSpan="2" style={{ textAlign: 'center' }}>SALIDAS</th>
              <th colSpan="2" style={{ textAlign: 'center' }}>EXISTENCIAS</th>
              <th rowSpan="2">OBSERVACIONES</th>
            </tr>
            <tr>
              <th>M</th>
              <th>O</th>
              <th>M</th>
              <th>O</th>
              <th>M</th>
              <th>O</th>
            </tr>
          </thead>
          <tbody>
            {kardexData.historial_kardex && kardexData.historial_kardex.length > 0 ? (
              kardexData.historial_kardex.map((mov, idx) => (
                <tr key={mov.id || idx}>
                  <td><strong>{mov.numero_documento}</strong></td>
                  <td>{mov.fecha}</td>
                  
                  {/* Entrada M / O */}
                  <td>{mov.destino === 'M' && mov.cantidad_entrada > 0 ? mov.cantidad_entrada : ''}</td>
                  <td>{mov.destino === 'O' && mov.cantidad_entrada > 0 ? mov.cantidad_entrada : ''}</td>
                  
                  {/* Salida M / O */}
                  <td>{mov.destino === 'M' && mov.cantidad_salida > 0 ? mov.cantidad_salida : ''}</td>
                  <td>{mov.destino === 'O' && mov.cantidad_salida > 0 ? mov.cantidad_salida : ''}</td>
                  
                  {/* Existencias M / O */}
                  <td><strong>{mov.destino === 'M' ? mov.existencias : ''}</strong></td>
                  <td><strong>{mov.destino === 'O' ? mov.existencias : ''}</strong></td>
                  
                  <td>{mov.observaciones || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center py-4" style={{ textAlign: 'center' }}>
                  No hay movimientos registrados para este material
                </td>
              </tr>
            )}
          </tbody>
        </table> 
      </div>
    </div>
  );
}