/**
 * models/store.js — Estado del turnero (contador, historial, configuración).
 *
 * El estado vive en memoria (rápido) y se guarda en DOS lugares:
 *   1) server/data/store.json  → copia local, con escritura segura (temporal + renombrar) y respaldo .bak
 *   2) Postgres (Supabase)     → copia PERMANENTE, si existe DATABASE_URL:
 *        contador       una fila con el número actual; NO se depura nunca (la numeración sigue al otro día)
 *        turnos         historial; se depura solo, pasados RETENER_TURNOS_DIAS (7) días
 *        configuracion  una fila con los ajustes
 *
 * En Render el disco se BORRA al reiniciar; por eso, con Postgres, al arrancar se recupera todo de ahí.
 */
const fs   = require('fs');
const path = require('path');
const db   = require('../config/postgres');

const STORE_PATH = process.env.STORE_PATH            // pruebas / ruta personalizada
  || (process.env.RAILWAY_ENVIRONMENT
    ? '/tmp/store.json'                              // plataformas con disco temporal
    : path.join(__dirname, '..', 'data', 'store.json'));
const BAK_PATH = STORE_PATH + '.bak';
const RETENER_DIAS = parseInt(process.env.RETENER_TURNOS_DIAS) || 7;

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

// ── Archivo local ────────────────────────────────────────────────────────────
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
    if (fs.existsSync(STORE_PATH)) {   // dañado: se guarda aparte para poder revisarlo
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

// ── Postgres (Supabase) ──────────────────────────────────────────────────────
let enDb = false, pendiente = false, escribiendo = null, subidoHasta = 0, fallando = false;

/** Lee de Postgres. Devuelve null si Postgres todavía no tiene datos del turnero. */
async function leerDeDb() {
  const c = await db.consulta('SELECT valor FROM contador WHERE id = 1');
  const k = await db.consulta('SELECT datos FROM configuracion WHERE id = 1');
  if (!c.rows.length && !k.rows.length) return null;
  const t = await db.consulta(
    `SELECT id, turno, caja, llamado_texto, (extract(epoch from llamado_en) * 1000)::double precision AS ts
       FROM turnos WHERE llamado_en > now() - make_interval(days => $1) ORDER BY id DESC LIMIT 2000`, [RETENER_DIAS]);
  const cfg = k.rows[0] ? (typeof k.rows[0].datos === 'string' ? JSON.parse(k.rows[0].datos) : k.rows[0].datos) : {};
  return {
    contador: c.rows.length ? Number(c.rows[0].valor) : null,
    cfg,
    historial: t.rows.reverse().map(r => ({ id: Number(r.id), turno: r.turno, caja: r.caja, llamado_en: r.llamado_texto || '', ts: Number(r.ts) }))
  };
}

/** Aplica lo leído de Postgres a la memoria. En una reconexión, el contador nunca retrocede. */
function aplicar(d, { reconexion = false } = {}) {
  const { sessionSecret, ...resto } = d.cfg;
  const contadorMem = datos.config.contador;
  datos.config = { ...datos.config, ...resto };
  datos.config.contador = d.contador === null ? contadorMem
    : (reconexion ? Math.max(d.contador, contadorMem) : d.contador);
  if (sessionSecret) datos.sessionSecret = sessionSecret;
  if (reconexion) {                                   // se conservan los turnos llamados mientras no había conexión
    const porId = new Map(d.historial.map(r => [r.id, r]));
    for (const r of datos.historial) if (!porId.has(r.id)) porId.set(r.id, r);
    datos.historial = [...porId.values()].sort((a, b) => a.id - b.id);
  } else {
    datos.historial = d.historial;
  }
  subidoHasta = d.historial.reduce((m, r) => Math.max(m, r.id), 0);
  escribir(datos);
}

async function subir() {
  const { contador, ...resto } = datos.config;
  await db.consulta(
    `INSERT INTO contador (id, valor) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()`, [contador]);
  await db.consulta(
    `INSERT INTO configuracion (id, datos) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, actualizado_en = now()`,
    [JSON.stringify({ ...resto, sessionSecret: datos.sessionSecret })]);
  for (const r of datos.historial.filter(x => x.id > subidoHasta && x.ts)) {
    await db.consulta(
      `INSERT INTO turnos (id, turno, caja, llamado_en, llamado_texto) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5)
       ON CONFLICT (id) DO NOTHING`, [r.id, r.turno, r.caja, r.ts, r.llamado_en]);
    subidoHasta = Math.max(subidoHasta, r.id);
  }
}

/** Sube el estado a Postgres. Las escrituras seguidas se agrupan; si falla, reintenta cada 3 s (sin acumular). */
function subirADb() {
  if (!enDb) return Promise.resolve();
  pendiente = true;
  if (escribiendo) return escribiendo;
  escribiendo = (async () => {
    while (pendiente) {
      pendiente = false;
      try {
        await subir();
        if (fallando) { fallando = false; console.log('✅ Base de datos de nuevo disponible: turnos al día.'); }
      } catch (e) {
        if (!fallando) { fallando = true; console.error('⚠️  No se pudo guardar en la base de datos (se reintenta):', e.code || e.message); }
        pendiente = true;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    escribiendo = null;
  })();
  return escribiendo;
}

/** Quita de la memoria los turnos de más de RETENER_DIAS días. Devuelve true si cambió algo. */
function depurarMemoria() {
  const limite = Date.now() - RETENER_DIAS * 86_400_000;
  const vivos = datos.historial.filter(r => r.ts && r.ts >= limite);
  if (vivos.length === datos.historial.length) return false;
  datos.historial.splice(0, datos.historial.length, ...vivos);
  return true;
}

/** Depuración: turnos de más de 7 días (memoria y Postgres). El CONTADOR no se toca. */
async function depurar() {
  try {
    if (depurarMemoria()) escribir(datos);
    if (enDb) {
      const r = await db.consulta('DELETE FROM turnos WHERE llamado_en < now() - make_interval(days => $1)', [RETENER_DIAS]);
      if (r.rowCount) console.log(`🧹 Depuración: ${r.rowCount} turnos de más de ${RETENER_DIAS} días eliminados.`);
    }
  } catch (e) { console.error('⚠️  Depuración de turnos:', e.code || e.message); }
}

async function intentarConectar(reconexion) {
  await db.conectar();
  const d = await leerDeDb();
  if (d) aplicar(d, { reconexion }); else subidoHasta = 0;
  if (!d || reconexion) await subir();                // Postgres vacío (primera vez) o vuelta de un corte: se sube lo que hay
  enDb = true;                                        // solo se marca como conectado cuando TODO salió bien
  console.log(d
    ? `🗄️  Turnos recuperados de la base de datos: siguiente número ${datos.config.contador}, ${datos.historial.length} en historial.`
    : '🗄️  Turnos guardados por primera vez en la base de datos.');
}

/** Al arrancar: recupera el estado de Postgres (si está configurado). No lanza error nunca. */
async function iniciar() {
  let resultado = 'archivo';
  if (db.configurado()) {
    // La base de datos puede tardar en responder justo al arrancar: se intenta 4 veces antes de usar solo el archivo
    for (let intento = 1; intento <= 4 && !enDb; intento++) {
      try { await intentarConectar(false); resultado = 'postgres'; }
      catch (e) {
        console.error(`⚠️  Base de datos no disponible (intento ${intento}/4): ${e.code || e.message}`);
        await db.cerrar();
        if (intento < 4) await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!enDb) {
      console.error('⚠️  Se usa solo el archivo local. Se seguirá intentando conectar con la base de datos cada 30 s.');
      // Mientras no haya conexión NO se pierde nada: cuando vuelva, el contador no retrocede y los turnos se suben
      const t = setInterval(async () => {
        try { await intentarConectar(true); clearInterval(t); } catch { await db.cerrar(); }
      }, 30_000);
      t.unref();
    }
  }
  await depurar();
  setInterval(depurar, 3_600_000).unref();            // cada hora
  return resultado;
}

/** Guarda el estado actual: en disco al instante y en Postgres (si está conectado) enseguida. */
function guardar() { escribir(datos); subirADb(); }

/** Espera a que terminen las escrituras pendientes en la base de datos (se usa al apagar). */
async function vaciar(maxMs = 5000) {
  if (!escribiendo) return;
  await Promise.race([escribiendo, new Promise(r => setTimeout(r, maxMs))]);
}

const dondeGuarda = () => (enDb ? 'postgres' : 'archivo');

module.exports = { datos, guardar, iniciar, vaciar, depurar, dondeGuarda, STORE_PATH, RETENER_DIAS };
