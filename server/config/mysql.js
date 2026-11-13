/**
 * config/mysql.js — Conexión a MySQL / MariaDB (XAMPP).
 *
 * Se activa SOLO si existen las variables MYSQL_* (en credenciales/.env o en el panel de Render).
 * Si no están, el sistema sigue funcionando con el archivo JSON (server/data/store.json).
 *
 * Seguridad: todas las consultas son PARAMETRIZADAS (signos ?), así que la inyección SQL no es posible.
 */
// mysql2 se carga SOLO si MySQL está configurado: si la librería faltara (por ejemplo en Render),
// el servidor sigue funcionando con el archivo JSON en vez de caerse.
let pool = null;

const configurado = () => !!(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS administradores (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario       VARCHAR(24)   NOT NULL,
  nombre        VARCHAR(60)   NOT NULL,
  clave_hash    VARCHAR(200)  NOT NULL COMMENT 'Contraseña cifrada con scrypt (sal:hash). Nunca en texto plano.',
  rol           VARCHAR(40)   NOT NULL DEFAULT 'Administrador',
  saludo        VARCHAR(120)  NOT NULL DEFAULT 'Tu acceso al panel está listo.',
  avatar        VARCHAR(16)   NOT NULL DEFAULT '🧑‍💼',
  principal     TINYINT(1)    NOT NULL DEFAULT 0,
  email         VARCHAR(120)  NOT NULL DEFAULT '',
  github        VARCHAR(39)   NOT NULL DEFAULT '',
  debe_cambiar  TINYINT(1)    NOT NULL DEFAULT 0,
  creado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** Abre la conexión y crea la tabla si no existe. Devuelve el pool o null si MySQL no está configurado. */
async function conectar() {
  if (!configurado()) return null;
  if (pool) return pool;
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 8000,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined   // para MySQL en la nube
  });
  await pool.query(ESQUEMA);
  return pool;
}

const obtener = () => pool;

async function cerrar() { if (pool) { await pool.end().catch(() => {}); pool = null; } }

module.exports = { configurado, conectar, obtener, cerrar, ESQUEMA };
