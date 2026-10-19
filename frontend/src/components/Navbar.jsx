import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="navbar" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ color: 'var(--text-nav, #ffffff)', margin: 0, fontSize: '20px' }}>
        Corpoelec - Gestión de Almacén
      </h1>
      <div>
        <Link 
          to="/" 
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          style={{ marginRight: '20px' }}
        >
          Inicio
        </Link>
        <Link 
          to="/inventario" 
          className={`nav-link ${location.pathname === '/inventario' ? 'active' : ''}`}
          style={{ marginRight: '20px' }}
        >
          Inventario
        </Link>
        <Link 
          to="/personal" 
          className={`nav-link ${location.pathname === '/personal' ? 'active' : ''}`}
          style={{ marginRight: '20px' }}
        >
          Personal
        </Link>
      </div>
    </nav>
  );
}