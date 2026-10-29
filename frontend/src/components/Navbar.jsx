import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const location = useLocation();

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
        <Link 
          to="/personal" 
          className={`nav-link ${location.pathname === '/personal' ? 'active' : ''}`}
          style={{ color: '#ffffff', textDecoration: 'none', fontWeight: location.pathname === '/personal' ? '600' : '400' }}
        >
          Personal
        </Link>
        <Link 
          to="/cierre-anual" 
          className={`nav-link ${location.pathname === '/cierre-anual' ? 'active' : ''}`}
          style={{ 
            background: "#059669", 
            color: "#fff", 
            padding: "6px 12px", 
            borderRadius: "4px", 
            textDecoration: "none",
            fontWeight: "bold"
          }}
        >
          📊 Cierre Anual e Historial
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