import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ActaDeIngreso from './ActaDeIngreso';
import ModalCartaRD from './CartaRD';
import ModalDevolucion from './Devolucion';

// Importaciones desde la carpeta local assets
import imgIso from '../assets/circulo.jpg';
import imgMppee from '../assets/Gemini_Generated_Image_m9d5w7m9d5w7m9d5.jpg';
import imgConciencia from '../assets/Gemini_Generated_Image_yu5r4ryu5r4ryu5r.jpg';
import imgCorpoelec from '../assets/Gemini_Generated_Image_za0dopza0dopza0d.jpg';

export default function Inicio() {
  const navigate = useNavigate();

  // Arreglo de imágenes para el carrusel
  const imagenesCarrusel = [imgCorpoelec, imgMppee, imgConciencia, imgIso];
  const [indiceImagen, setIndiceImagen] = useState(0);

  // Rotación automática cada 4 segundos
  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndiceImagen((prev) => (prev + 1) % imagenesCarrusel.length);
    }, 4000);
    return () => clearInterval(intervalo);
  }, [imagenesCarrusel.length]);

  // Estado para el tema de color
  const [tema, setTema] = useState(() => {
    return localStorage.getItem('tema_almacen') || 'default';
  });

  // Estados para controlar los menús desplegables
  const [menuIngreso, setMenuIngreso] = useState(false);
  const [menuRetiro, setMenuRetiro] = useState(false);

  // Estados para controlar los modales
  const [modalActaOpen, setModalActaOpen] = useState(false);
  const [modalCartaRDOpen, setModalCartaRDOpen] = useState(false);
  const [modalDevolucionOpen, setModalDevolucionOpen] = useState(false);

  // Referencias para cerrar desplegables al hacer clic fuera
  const refIngreso = useRef(null);
  const refRetiro = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('tema_almacen', tema);
  }, [tema]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (refIngreso.current && !refIngreso.current.contains(event.target)) {
        setMenuIngreso(false);
      }
      if (refRetiro.current && !refRetiro.current.contains(event.target)) {
        setMenuRetiro(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="home-container">
      <div className="welcome-card">

        {/* SELECTOR DINÁMICO DE TEMA */}
        <div className="theme-selector">
          <label htmlFor="theme-select">🎨 Tema de Color:</label>
          <select 
            id="theme-select" 
            className="theme-select-input" 
            value={tema} 
            onChange={(e) => setTema(e.target.value)}
          >
            <option value="default">Blanco, Azul Celeste y Negro</option>
            <option value="verde-naranja">Blanco, Verde Manzana y Naranja</option>
            <option value="oscuro">Modo Oscuro</option>
            <option value="purpura-turquesa">Púrpura y Turquesa</option>
          </select>
        </div>

{/* CARRUSEL INSTITUCIONAL - ESTILO BANNER PANORÁMICO */}
<div 
  className="carousel-container" 
  style={{
    position: 'relative',
    width: '100%',
    height: '220px',
    borderRadius: '12px',
    marginBottom: '25px',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    padding: '12px 20px',
    boxSizing: 'border-box'
  }}
>
  <img 
    src={imagenesCarrusel[indiceImagen]} 
    alt="Banner Institucional Corpoelec" 
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'contain', // Ajusta el logo completo dentro del banner panorámico
      transition: 'all 0.5s ease-in-out'
    }}
  />

  {/* Puntos / Indicadores del carrusel */}
  <div style={{
    position: 'absolute',
    bottom: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    padding: '4px 12px',
    borderRadius: '12px',
    backdropFilter: 'blur(4px)'
  }}>
    {imagenesCarrusel.map((_, idx) => (
      <span
        key={idx}
        onClick={() => setIndiceImagen(idx)}
        style={{
          width: idx === indiceImagen ? '22px' : '8px',
          height: '8px',
          borderRadius: '4px',
          backgroundColor: idx === indiceImagen ? '#1F4E78' : '#cbd5e1',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
      />
    ))}
  </div>
</div>

        {/* ENCABEZADO */}
        <div className="welcome-header">
          <h1>Bienvenido al Sistema de Almacén</h1>
          <p>Plataforma para el control integral de inventario, actas de ingreso y movimientos KARDEX.</p>
        </div>

        {/* CONTENEDOR DE BOTONES Y DESPLEGABLES */}
        <div className="actions-grid">
          <button 
            type="button" 
            className="action-btn btn-dark-blue"
            onClick={() => navigate('/inventario')}
          >
            📦 Ver Inventario Completo
          </button>

          <button 
            type="button" 
            className="action-btn btn-light-blue"
            onClick={() => navigate('/personal')}
          >
            👥 Ver Personal Autorizado
          </button>

          <div className="dropdown-container" ref={refIngreso}>
            <button 
              type="button" 
              className="action-btn btn-green"
              onClick={() => {
                setMenuIngreso(!menuIngreso);
                setMenuRetiro(false);
              }}
            >
              📥 Ingreso de Materiales <span className="arrow">▾</span>
            </button>

            {menuIngreso && (
              <div className="dropdown-card-menu">
                <button 
                  type="button" 
                  className="dropdown-card-item"
                  onClick={() => {
                    setMenuIngreso(false);
                    setModalActaOpen(true);
                  }}
                >
                  📝 Acta de Ingreso
                </button>
                <button 
                  type="button" 
                  className="dropdown-card-item"
                  onClick={() => {
                    setMenuIngreso(false);
                    setModalDevolucionOpen(true);
                  }}
                >
                  ↩️ Devolución
                </button>
              </div>
            )}
          </div>

          <div className="dropdown-container" ref={refRetiro}>
            <button 
              type="button" 
              className="action-btn btn-orange"
              onClick={() => {
                setMenuRetiro(!menuRetiro);
                setMenuIngreso(false);
              }}
            >
              🔄 Retiro y Devolución <span className="arrow">▾</span>
            </button>

            {menuRetiro && (
              <div className="dropdown-card-menu">
                <button 
                  type="button" 
                  className="dropdown-card-item"
                  onClick={() => {
                    setMenuRetiro(false);
                    setModalCartaRDOpen(true);
                  }}
                >
                  📋 Retiro y Devolución (RD)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALES */}
      <ActaDeIngreso
        isOpen={modalActaOpen}
        onClose={() => setModalActaOpen(false)}
        alGuardarExito={() => navigate('/inventario')}
      />

      <ModalCartaRD
        isOpen={modalCartaRDOpen}
        onClose={() => setModalCartaRDOpen(false)}
        alGuardarExito={() => navigate('/inventario')}
      />

      <ModalDevolucion
        isOpen={modalDevolucionOpen}
        onClose={() => setModalDevolucionOpen(false)}
        alGuardarExito={() => navigate('/inventario')}
      />
    </div>
  );
}