import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChartColumn, ClipboardList, Clock } from 'lucide-react';

const API = 'http://localhost:8000/api';

export default function Navbar({ user, onLogout }) {
  const location = useLocation();
  const esAdmin = user?.rol === 'admin';
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (!user?.id) return undefined;

    let activo = true;

    const cargarPendientes = async () => {
      try {
        const res = await fetch(`${API}/liberaciones/resumen/`);
        if (!res.ok) return;
        const data = await res.json();
        if (activo) setPendientes(Number(data.pendientes) || 0);
      } catch {
        // Se reintentará en el siguiente ciclo de actualización.
      }
    };

    cargarPendientes();
    const intervalo = setInterval(cargarPendientes, 15000);

    const actualizar = () => cargarPendientes();
    window.addEventListener('liberaciones-actualizadas', actualizar);
    window.addEventListener('focus', actualizar);

    return () => {
      activo = false;
      clearInterval(intervalo);
      window.removeEventListener('liberaciones-actualizadas', actualizar);
      window.removeEventListener('focus', actualizar);
    };
  }, [user?.id, user?.rol]);

  const badgePendientes = (color) => (
    <span
      style={{
        background: color,
        color: '#fff',
        borderRadius: '10px',
        padding: '1px 8px',
        fontSize: '11px',
        fontWeight: '700',
        marginLeft: '4px',
      }}
    >
      {pendientes}
    </span>
  );

  return (
    <nav className="navbar" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(90deg, #002D72 0%, #004A98 100%)' }}>
      <h1 style={{ color: '#ffffff', margin: 0, fontSize: '20px' }}>
        Corpoelec - Gestión de Almacén
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link 
          to="/" 
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          style={{ color: '#ffffff', textDecoration: 'none', fontWeight: location.pathname === '/' ? '600' : '400' }}
        >
          Inicio
        </Link>
        <Link 
          to="/inventario" 
          className={`nav-link ${location.pathname === '/inventario' ? 'active' : ''}`}
          style={{ color: '#ffffff', textDecoration: 'none', fontWeight: location.pathname === '/inventario' ? '600' : '400' }}
        >
          Inventario
        </Link>
        {esAdmin && (
          <Link 
            to="/personal" 
            className={`nav-link ${location.pathname === '/personal' ? 'active' : ''}`}
            style={{ color: '#ffffff', textDecoration: 'none', fontWeight: location.pathname === '/personal' ? '600' : '400' }}
          >
            Personal
          </Link>
        )}
        {esAdmin ? (
          <Link
            to="/liberaciones"
            className={`nav-link ${location.pathname === '/liberaciones' ? 'active' : ''}`}
            style={{
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: location.pathname === '/liberaciones' ? '600' : '400',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ClipboardList size={16} /> Liberaciones
            {pendientes > 0 && badgePendientes('#dc2626')}
          </Link>
        ) : (
          <span
            style={{
              color: '#ffffff',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '6px 10px',
              borderRadius: '6px',
            }}
            title="Solicitudes de material de obra pendientes de aprobación"
          >
            <Clock size={15} /> Peticiones pendientes:
            {badgePendientes(pendientes > 0 ? '#f59e0b' : '#059669')}
          </span>
        )}
        <Link 
          to="/cierre-anual" 
          className={`nav-link ${location.pathname === '/cierre-anual' ? 'active' : ''}`}
          style={{ 
            background: "#059669", 
            color: "#fff", 
            padding: "6px 12px", 
            borderRadius: "4px", 
            textDecoration: "none",
            fontWeight: "bold",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <ChartColumn size={16} /> Cierre Anual e Historial
        </Link>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: '20px', paddingLeft: '20px', borderLeft: '1px solid rgba(255,255,255,0.3)' }}>
            <span style={{ color: '#ffffff', fontSize: '13px' }}>
              {user.nombreCompleto || user.cedula} {user.rol === 'admin' && <span style={{ background: '#059669', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', marginLeft: '5px' }}>ADMIN</span>}
            </span>
            <button 
              onClick={onLogout}
              style={{ 
                background: 'rgba(255,255,255,0.2)', 
                color: '#ffffff', 
                border: '1px solid rgba(255,255,255,0.3)', 
                padding: '6px 12px', 
                borderRadius: '6px', 
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}