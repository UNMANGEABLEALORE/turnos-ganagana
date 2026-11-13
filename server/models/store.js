/**
 * models/store.js — Persistencia en un archivo JSON (server/data/store.json), sin dependencias nativas.
 * Node.js es single-threaded → las escrituras síncronas son atómicas.
 *
 * Forma del archivo:
 *   config    → contador, establecimiento, volumen, silencio, estado de cada caja
 *   historial → turnos llamados
 *   admins    → administradores (contraseña cifrada con scrypt)
 */
const fs   = require('fs');
const path = require('path');

const STORE_PATH = process.env.STORE_PATH            // pruebas / ruta personalizada
  || (process.env.RAILWAY_ENVIRONMENT
    ? '/tmp/store.json'                              // plataformas con disco temporal
    : path.join(__dirname, '..', 'data', 'store.json'));

function valorInicial() {
  return {
    config: {
      contador:        0,
      establecimiento: 'GanaGana',
      volumen:         1,
      silencio:        false,
      cajas_estado:    { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' }   // 'activa' | 'inactiva'
    },
    historial: []
  };
}

function escribir(datos) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(datos, null, 2), 'utf8');
}

function cargar() {
  if (!fs.existsSync(STORE_PATH)) {
    const v = valorInicial();
    escribir(v);
    return v;
  }
  try {
    const s = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!s.config.cajas_estado) {                    // migración de versiones antiguas
      s.config.cajas_estado = { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' };
      escribir(s);
    }
    return s;
  } catch {
    const v = valorInicial();
    escribir(v);
    return v;
  }
}

const datos = cargar();

/** Guarda en disco el estado actual de `datos`. */
function guardar() { escribir(datos); }

module.exports = { datos, guardar, STORE_PATH };
