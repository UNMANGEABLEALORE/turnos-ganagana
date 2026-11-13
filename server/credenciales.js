/**
 * credenciales.js — Único punto del código que lee secretos.
 *
 * Todo lo sensible vive en la carpeta /credenciales (excluida de Git):
 *   credenciales/.env                 → claves de hCaptcha, Google, GitHub, URL pública, etc.
 *   credenciales/administradores.json → administradores iniciales y sus contraseñas
 *   credenciales/sesion.secret        → clave para firmar las sesiones (se genera sola)
 *
 * En producción (Render) no hay carpeta: se usan variables de entorno del panel de Render.
 * Las variables de entorno SIEMPRE tienen prioridad sobre el archivo.
 */
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DIR = process.env.CREDENCIALES_DIR || path.join(__dirname, '..', 'credenciales');

function cargarEnv() {
  const archivo = path.join(DIR, '.env');
  if (!fs.existsSync(archivo)) return 0;
  let n = 0;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || linea.trim().startsWith('#')) continue;
    const valor = m[2].replace(/^["']|["']$/g, '');
    if (valor && process.env[m[1]] === undefined) { process.env[m[1]] = valor; n++; }
  }
  return n;
}

function asegurarDir() {
  try { fs.mkdirSync(DIR, { recursive: true }); return true; } catch { return false; }
}

/** Administradores iniciales definidos en credenciales/administradores.json (o null si no existe). */
function leerAdministradores() {
  const archivo = path.join(DIR, 'administradores.json');
  if (!fs.existsSync(archivo)) return null;
  try {
    const lista = JSON.parse(fs.readFileSync(archivo, 'utf8').replace(/^\uFEFF/, ''));
    return Array.isArray(lista) ? lista : null;
  } catch (e) {
    console.error('⚠️  credenciales/administradores.json no es un JSON válido:', e.message);
    return null;
  }
}

function guardarAdministradores(lista) {
  if (!asegurarDir()) return null;
  const archivo = path.join(DIR, 'administradores.json');
  try { fs.writeFileSync(archivo, JSON.stringify(lista, null, 2), { mode: 0o600 }); return archivo; }
  catch { return null; }
}

/** Clave para firmar sesiones: variable de entorno, o archivo credenciales/sesion.secret (se crea solo). */
function claveSesion() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const archivo = path.join(DIR, 'sesion.secret');
  try {
    if (fs.existsSync(archivo)) return fs.readFileSync(archivo, 'utf8').trim();
    if (asegurarDir()) {
      const s = crypto.randomBytes(48).toString('hex');
      fs.writeFileSync(archivo, s, { mode: 0o600 });
      return s;
    }
  } catch { /* sin disco: se usa la clave del almacén */ }
  return null;
}

/** Contraseña aleatoria que cumple la política (8+, letras y números). */
function claveAleatoria() { return 'Gg-' + crypto.randomBytes(7).toString('hex') + '7'; }

cargarEnv();

module.exports = { DIR, cargarEnv, leerAdministradores, guardarAdministradores, claveSesion, claveAleatoria };
