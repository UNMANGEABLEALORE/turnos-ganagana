/**
 * middlewares/autenticacion.js — Sesión del administrador (cookie HttpOnly firmada).
 */
const sesion = require('../utils/sesion');
const { getSessionSecret } = require('../models/configuracion.model');
const adminModel = require('../models/administrador.model');

const COOKIE_SESION = 'gg_sid';
const SESION_SEG    = 8 * 60 * 60;   // 8 horas

/** Devuelve el administrador de una cabecera Cookie, o null si no hay sesión válida. */
function adminDeCookie(cookieHeader) {
  const tok  = sesion.parseCookies(cookieHeader)[COOKIE_SESION];
  const data = sesion.verificar(tok, getSessionSecret());
  if (!data || data.t !== 'sesion') return null;
  return adminModel.buscarPorId(data.id);
}

function iniciarSesion(req, res, admin, via) {
  const tok = sesion.firmar({ t: 'sesion', id: admin.id, via }, getSessionSecret(), SESION_SEG);
  sesion.setCookie(req, res, COOKIE_SESION, tok, { maxAgeSec: SESION_SEG });
}

function cerrarSesion(req, res) { sesion.clearCookie(req, res, COOKIE_SESION); }

/** Middleware: exige un administrador con sesión; si no, responde 401. */
function requireAdmin(req, res, next) {
  const a = adminDeCookie(req.headers.cookie);
  if (!a) return res.status(401).json({ ok: false, error: 'Sesión no válida' });
  req.admin = a;
  next();
}

module.exports = { adminDeCookie, iniciarSesion, cerrarSesion, requireAdmin };
