/**
 * utils/sesion.js — Cookies, sesiones firmadas (HMAC-SHA256) y contraseñas (scrypt).
 * Funciones puras: no conocen Express ni la base de datos.
 */
const crypto = require('crypto');

// ── HTTPS (directo o detrás de un proxy como Render) ─────────────────────────
function esSeguro(req) {
  return !!req.secure || req.headers['x-forwarded-proto'] === 'https';
}

// ── Cookies ──────────────────────────────────────────────────────────────────
function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setCookie(req, res, name, value, { maxAgeSec = 0, sameSite = 'Lax' } = {}) {
  const partes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/', 'HttpOnly', `SameSite=${sameSite}`
  ];
  if (maxAgeSec) partes.push(`Max-Age=${maxAgeSec}`);
  if (esSeguro(req)) partes.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const lista = prev ? [].concat(prev) : [];
  lista.push(partes.join('; '));
  res.setHeader('Set-Cookie', lista);
}

function clearCookie(req, res, name) {
  setCookie(req, res, name, '', { maxAgeSec: 0 });
  const lista = [].concat(res.getHeader('Set-Cookie'));
  lista[lista.length - 1] += '; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
  res.setHeader('Set-Cookie', lista);
}

// ── Sesiones firmadas ────────────────────────────────────────────────────────
const b64 = b => Buffer.from(b).toString('base64url');

function firmar(payload, secret, ttlSec) {
  const cuerpo = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlSec * 1000 }));
  const sig = crypto.createHmac('sha256', secret).update(cuerpo).digest('base64url');
  return `${cuerpo}.${sig}`;
}

function verificar(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [cuerpo, sig] = token.split('.');
  const esperado = crypto.createHmac('sha256', secret).update(cuerpo).digest('base64url');
  const a = Buffer.from(sig || ''), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

// ── Contraseñas (scrypt + sal) ───────────────────────────────────────────────
function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(pwd, salt, 64).toString('hex');
  return `${salt}:${h}`;
}

function checkPassword(pwd, guardado) {
  if (!guardado || !guardado.includes(':')) return false;
  const [salt, h] = guardado.split(':');
  const calc = crypto.scryptSync(String(pwd), salt, 64);
  const orig = Buffer.from(h, 'hex');
  return calc.length === orig.length && crypto.timingSafeEqual(calc, orig);
}

module.exports = { esSeguro, parseCookies, setCookie, clearCookie, firmar, verificar, hashPassword, checkPassword };
