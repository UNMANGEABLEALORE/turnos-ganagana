/**
 * config/postgres.js — Conexión a Postgres (Supabase).
 *
 * Se activa SOLO si existe DATABASE_URL (en credenciales/.env o en Environment de Render).
 * Si no está, el sistema sigue funcionando con el archivo JSON (server/data/store.json).
 *
 * Tablas:
 *   administradores  usuarios del panel (contraseña cifrada)
 *   contador         UNA fila con el número actual de turno. NUNCA se depura: así la numeración sigue al otro día.
 *   turnos           historial de turnos llamados. Se depura solo pasados 7 días.
 *   configuracion    UNA fila con los ajustes (nombre, volumen, cajas, etc.)
 *   actividad        reporte de lo que hace cada administrador
 *
 * Seguridad: todas las consultas son PARAMETRIZADAS ($1, $2…): la inyección SQL no es posible.
 * Todas las tablas tienen RLS activado y SIN políticas: la API pública de Supabase (clave "anon") no puede
 * leer ni escribir nada. Solo este servidor, que entra con el usuario "postgres", tiene acceso.
 */
let pool = null;
let cliente = null;      // 'pg' | 'pglite'

const configurado = () => !!process.env.DATABASE_URL;

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS administradores (
     id             SERIAL PRIMARY KEY,
     usuario        VARCHAR(24)  NOT NULL,
     nombre         VARCHAR(60)  NOT NULL,
     clave_hash     VARCHAR(200) NOT NULL,
     rol            VARCHAR(40)  NOT NULL DEFAULT 'Administrador',
     saludo         VARCHAR(120) NOT NULL DEFAULT 'Tu acceso al panel está listo.',
     avatar         VARCHAR(16)  NOT NULL DEFAULT '🧑‍💼',
     principal      BOOLEAN      NOT NULL DEFAULT false,
     email          VARCHAR(120) NOT NULL DEFAULT '',
     github         VARCHAR(39)  NOT NULL DEFAULT '',
     debe_cambiar   BOOLEAN      NOT NULL DEFAULT false,
     creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
     actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_usuario ON administradores (lower(usuario))`,
  `CREATE TABLE IF NOT EXISTS contador (
     id             SMALLINT PRIMARY KEY CHECK (id = 1),
     valor          INTEGER     NOT NULL DEFAULT 0,
     actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS turnos (
     id            BIGINT PRIMARY KEY,
     turno         INTEGER     NOT NULL,
     caja          INTEGER     NOT NULL,
     llamado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
     llamado_texto TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_turnos_llamado ON turnos (llamado_en)`,
  `CREATE TABLE IF NOT EXISTS configuracion (
     id             SMALLINT PRIMARY KEY CHECK (id = 1),
     datos          JSONB       NOT NULL,
     actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS actividad (
     id         BIGSERIAL PRIMARY KEY,
     cuando     TIMESTAMPTZ  NOT NULL DEFAULT now(),
     admin_id   INTEGER,
     usuario    VARCHAR(24),
     nombre     VARCHAR(60),
     accion     VARCHAR(60)  NOT NULL,
     detalle    TEXT         NOT NULL DEFAULT '',
     ip         VARCHAR(64)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_actividad_cuando ON actividad (cuando DESC)`,
  // Seguridad por filas: sin políticas = la API pública de Supabase no puede tocar estas tablas
  `ALTER TABLE administradores ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE contador        ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE turnos          ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE configuracion   ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE actividad       ENABLE ROW LEVEL SECURITY`
];

/** Ejecuta una consulta parametrizada. Devuelve { rows, rowCount }. */
async function consulta(texto, params = []) {
  if (!pool) throw new Error('La base de datos no está conectada.');
  const r = await pool.query(texto, params);
  return { rows: r.rows, rowCount: r.rowCount ?? r.affectedRows ?? 0 };
}

/** Abre la conexión y crea las tablas que falten. Devuelve true, o false si no hay DATABASE_URL. */
async function conectar() {
  if (!configurado()) return false;
  if (pool) return true;
  const url = process.env.DATABASE_URL;
  if (/\[YOUR|PON_AQUI|\[TU-CLAVE|<password>/i.test(url)) {
    throw new Error('DATABASE_URL todavía tiene la contraseña de ejemplo: reemplázala por la contraseña real de tu base de datos.');
  }

  if (url.startsWith('pglite:')) {
    // Solo para PRUEBAS: Postgres de laboratorio dentro de Node (no hace falta instalar nada)
    const { PGlite } = require('@electric-sql/pglite');
    pool = new PGlite(url.slice('pglite:'.length) || undefined);
    await pool.waitReady;
    cliente = 'pglite';
  } else {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const ssl = local || process.env.DATABASE_SSL === 'false' ? false
      : process.env.DATABASE_SSL_CA
        ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n') }   // verificado con el certificado de Supabase
        : { rejectUnauthorized: false };                                                         // cifrado (sin verificar el certificado)
    pool = new Pool({ connectionString: url, ssl, max: 5, connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000 });
    // Sin este manejador, un corte de red en una conexión inactiva tumbaría el servidor entero
    pool.on('error', e => console.error('⚠️  Conexión con la base de datos:', e.code || e.message));
    cliente = 'pg';
  }

  for (const sql of ESQUEMA) await pool.query(sql);
  return true;
}

const conectado = () => !!pool;
const obtenerCliente = () => cliente;

async function cerrar() {
  if (!pool) return;
  const p = pool; pool = null;
  await (cliente === 'pglite' ? p.close() : p.end()).catch(() => {});
}

module.exports = { configurado, conectar, conectado, consulta, cerrar, obtenerCliente, ESQUEMA };
