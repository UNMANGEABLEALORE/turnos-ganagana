/**
 * models/store.js — Persistencia en un archivo JSON (server/data/store.json), sin dependencias nativas.
 * Node.js es single-threaded → las escrituras síncronas son atómicas entre peticiones.
 *
 * Protección contra apagones y archivos dañados:
 *   · Cada guardado se escribe en un archivo temporal y se renombra (nunca queda a medias).
 *   · Se mantiene una copia de respaldo (store.json.bak) idéntica al último guardado correcto.
 *   · Si store.json está dañado, se aparta como store.corrupto-<fecha>.json y se recupera el respaldo.
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
const BAK_PATH = STORE_PATH + '.bak';

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

/** Escribe `texto` en `destino` de forma atómica (temporal + renombrar). */
function escribirAtomico(destino, texto) {
  const tmp = destino + '.tmp';
  fs.writeFileSync(tmp, texto, 'utf8');
  try { fs.renameSync(tmp, destino); }
  catch { fs.writeFileSync(destino, texto, 'utf8'); try { fs.unlinkSync(tmp); } catch { /* nada */ } }
}

function escribir(datos) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const texto = JSON.stringify(datos, null, 2);
  escribirAtomico(STORE_PATH, texto);
  try { escribirAtomico(BAK_PATH, texto); } catch { /* el respaldo es un extra */ }
}

/** Lee y valida un archivo de datos. Devuelve null si no existe o está dañado. */
function leerValido(ruta) {
  try {
    if (!fs.existsSync(ruta)) return null;
    const s = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (!s || typeof s !== 'object' || !s.config || typeof s.config.contador !== 'number' || !Array.isArray(s.historial)) return null;
    return s;
  } catch { return null; }
}

function cargar() {
  let s = leerValido(STORE_PATH);
  if (!s) {
    const existia = fs.existsSync(STORE_PATH);
    if (existia) {   // dañado: se guarda aparte para poder revisarlo
      const apartado = STORE_PATH.replace(/\.json$/, '') + `.corrupto-${Date.now()}.json`;
      try { fs.renameSync(STORE_PATH, apartado); console.error(`⚠️  store.json dañado: se guardó en ${path.basename(apartado)}`); } catch { /* nada */ }
    }
    s = leerValido(BAK_PATH);
    if (s) console.error('♻️  Datos recuperados desde la copia de respaldo (store.json.bak).');
    else s = valorInicial();
    escribir(s);
  }
  if (!s.config.cajas_estado) {                      // migración de versiones antiguas
    s.config.cajas_estado = { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' };
    escribir(s);
  }
  return s;
}

const datos = cargar();

/** Guarda en disco el estado actual de `datos`. */
function guardar() { escribir(datos); }

module.exports = { datos, guardar, STORE_PATH };
