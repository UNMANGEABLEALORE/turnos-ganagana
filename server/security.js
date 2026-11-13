/**
 * security.js — Cabeceras de seguridad, cookies, sesiones firmadas,
 * hash de contraseñas (scrypt) y límite de intentos. Sin dependencias extra.
 */
const crypto = require('crypto');

// ── Detección de HTTPS (directo o detrás de proxy como Render) ───────────────
function esSeguro(req) {
  return !!req.secure || req.headers['x-forwarded-proto'] === 'https';
}

// ── Cabeceras de seguridad ───────────────────────────────────────────────────
function cabeceras(req, res, next) {
  const esDisplay = req.path.startsWith('/display');
  const csp = [
    "default-src 'self'",
    // /display (HTML estático) usa script inline; el resto de la app NO.
    esDisplay
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' https://js.hcaptcha.com https://*.hcaptcha.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.hcaptcha.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' ws: wss: https://*.hcaptcha.com https://hcaptcha.com",
    "frame-src https://*.hcaptcha.com https://hcaptcha.com",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.removeHeader('X-Powered-By');
  if (esSeguro(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// Redirige HTTP → HTTPS cuando hay proxy (producción)
function forzarHttps(req, res, next) {
  const tras_proxy = !!req.headers['x-forwarded-proto'];
  if (process.env.NODE_ENV === 'production' && tras_proxy && !esSeguro(req)) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
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

// ── Sesiones firmadas (HMAC-SHA256) ──────────────────────────────────────────
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

// ── Límite de intentos por IP ────────────────────────────────────────────────
const intentos = new Map(); // ip → { n, hasta }
function limitador({ max = 5, ventanaMs = 60_000, bloqueoMs = 5 * 60_000 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const ahora = Date.now();
    const r = intentos.get(ip);
    if (r && r.hasta > ahora) {
      const seg = Math.ceil((r.hasta - ahora) / 1000);
      return res.status(429).json({ ok: false, error: `Demasiados intentos. Espera ${seg}s.`, espera: seg });
    }
    res.locals.fallo = () => {
      const cur = intentos.get(ip);
      if (!cur || cur.reinicia < ahora) intentos.set(ip, { n: 1, reinicia: ahora + ventanaMs, hasta: 0 });
      else {
        cur.n += 1;
        if (cur.n >= max) { cur.hasta = ahora + bloqueoMs; cur.n = 0; }
      }
    };
    res.locals.exito = () => intentos.delete(ip);
    next();
  };
}

module.exports = {
  esSeguro, cabeceras, forzarHttps, parseCookies, setCookie, clearCookie,
  firmar, verificar, hashPassword, checkPassword, limitador
};
