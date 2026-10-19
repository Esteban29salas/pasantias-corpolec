// frontend/src/services/api.js
const BASE_URL = 'http://127.0.0.1:8000/api';

export async function obtenerMateriales() {
  const respuesta = await fetch(`${BASE_URL}/materiales/`);
  if (!respuesta.ok) throw new Error('Error al obtener los materiales');
  return await respuesta.json();
}