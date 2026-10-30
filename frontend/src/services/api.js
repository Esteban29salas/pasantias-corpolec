// frontend/src/services/api.js
export const API_URL = 'https://pasantias-corpolec.onrender.com/api/';

export const TOKEN_KEY = 'corpoelec_token';
export const USER_KEY = 'corpoelec_user';

export function obtenerToken() {
  return localStorage.getItem(TOKEN_KEY);
}

let fetchAutenticadoInstalado = false;

export function instalarFetchAutenticado() {
  if (fetchAutenticadoInstalado || typeof window === 'undefined') return;

  fetchAutenticadoInstalado = true;
  const fetchOriginal = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const token = obtenerToken();
    const esRutaPublica =
      url.includes('/api/usuarios/login/') || url.includes('/api/usuarios/register/');

    if (!token || !url.includes('/api/') || esRutaPublica) {
      return fetchOriginal(input, init);
    }

    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined)
    );

    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetchOriginal(input, { ...init, headers });
  };
}

export async function obtenerMateriales() {
  const respuesta = await fetch(`${API_URL}/materiales/`);
  if (!respuesta.ok) throw new Error('Error al obtener los materiales');
  return await respuesta.json();
}
