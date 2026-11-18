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

// ── Copia permanente en MySQL ────────────────────────────────────────────────
// En Render (plan gratis) el disco se BORRA en cada reinicio. Si hay MySQL configurado, todo el estado
// (contador, historial, configuración) se guarda también en la tabla `almacen` y se recupera al arrancar.
// Las escrituras se agrupan: si llegan varias seguidas, solo se envía la última (nunca se acumulan).
const db = require('../config/mysql');
let enMysql = false, pendiente = false, escribiendo = null;

const TABLA = `CREATE TABLE IF NOT EXISTS almacen (
  id INT NOT NULL PRIMARY KEY, datos LONGTEXT NOT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** Reemplaza el contenido de `datos` SIN cambiar el objeto (los demás módulos guardan la referencia). */
function reemplazar(nuevos) {
  for (const k of Object.keys(datos)) delete datos[k];
  Object.assign(datos, nuevos);
}

/** Al arrancar: si hay MySQL, recupera de ahí el último estado (o sube el actual la primera vez). */
async function iniciar() {
  if (!db.configurado()) return 'archivo';
  try {
    const pool = await db.conectar();
    await pool.query(TABLA);
    const [filas] = await pool.query('SELECT datos FROM almacen WHERE id = 1');
    const guardado = filas.length ? leerTexto(filas[0].datos) : null;
    if (guardado) {
      reemplazar(guardado);
      escribir(datos);                                  // copia local al día
      console.log(`🗄️  Turnos recuperados de MySQL: contador ${datos.config.contador}, ${datos.historial.length} en historial.`);
    } else {
      await pool.execute('REPLACE INTO almacen (id, datos) VALUES (1, ?)', [JSON.stringify(datos)]);
      console.log('🗄️  Turnos guardados por primera vez en MySQL (tabla "almacen").');
    }
    enMysql = true;
    return 'mysql';
  } catch (e) {
    console.error(`⚠️  No se pudo usar MySQL para los turnos (${e.code || e.message}). Se usa solo el archivo.`);
    return 'archivo';
  }
}

function leerTexto(texto) {
  try {
    const s = JSON.parse(texto);
    return s && s.config && typeof s.config.contador === 'number' && Array.isArray(s.historial) ? s : null;
  } catch { return null; }
}

function subirAMysql() {
  if (!enMysql) return Promise.resolve();
  pendiente = true;
  if (escribiendo) return escribiendo;
  escribiendo = (async () => {
    while (pendiente) {
      pendiente = false;
      try {
        await db.obtener().execute('REPLACE INTO almacen (id, datos) VALUES (1, ?)', [JSON.stringify(datos)]);
      } catch (e) {
        console.error('⚠️  No se pudo guardar en MySQL (se reintenta):', e.code || e.message);
        pendiente = true;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    escribiendo = null;
  })();
  return escribiendo;
}

/** Guarda el estado actual: en disco al instante y en MySQL (si está configurado) enseguida. */
function guardar() { escribir(datos); subirAMysql(); }

/** Espera a que terminen las escrituras pendientes en MySQL (se usa al apagar). */
async function vaciar(maxMs = 5000) {
  if (!escribiendo) return;
  await Promise.race([escribiendo, new Promise(r => setTimeout(r, maxMs))]);
}

const dondeGuarda = () => (enMysql ? 'mysql' : 'archivo');

module.exports = { datos, guardar, iniciar, vaciar, dondeGuarda, STORE_PATH };
