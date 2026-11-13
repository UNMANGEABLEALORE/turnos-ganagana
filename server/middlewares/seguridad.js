/**
 * middlewares/seguridad.js — Cabeceras de seguridad, redirección a HTTPS y límite de intentos.
 */
const { esSeguro } = require('../utils/sesion');

// ── Cabeceras de seguridad (CSP, HSTS, etc.) ─────────────────────────────────
function cabeceras(req, res, next) {
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://js.hcaptcha.com https://*.hcaptcha.com",
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
  const trasProxy = !!req.headers['x-forwarded-proto'];
  if (process.env.NODE_ENV === 'production' && trasProxy && !esSeguro(req)) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
}

// ── Límite de intentos por IP ────────────────────────────────────────────────
const intentos = new Map(); // ip → { n, reinicia, hasta }

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

module.exports = { cabeceras, forzarHttps, limitador };
