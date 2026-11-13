/**
 * controllers/auth.controller.js — Acceso de administradores.
 *  - Login usuario/contraseña + CAPTCHA (verificado en el servidor)
 *  - Login con Google y GitHub (solo cuentas vinculadas a un administrador)
 *  - Sesión en cookie HttpOnly firmada
 */
const crypto  = require('crypto');
const sesion  = require('../utils/sesion');
const captcha = require('../services/captcha.service');
const oauth   = require('../services/oauth.service');
const adminModel = require('../models/administrador.model');
const { getSessionSecret } = require('../models/configuracion.model');
const { adminDeCookie, iniciarSesion, cerrarSesion } = require('../middlewares/autenticacion');

const COOKIE_OAUTH = 'gg_oauth';
const aLogin = msg => '/admin?error=' + encodeURIComponent(msg);

/** GET /api/auth/config — qué opciones de acceso están disponibles. */
function configuracion(_req, res) {
  res.json({
    hcaptchaSitekey: captcha.SITEKEY,
    hcaptchaPrueba:  captcha.MODO_PRUEBA,
    google: oauth.configurado(oauth.PROVEEDORES.google),
    github: oauth.configurado(oauth.PROVEEDORES.github)
  });
}

/** GET /api/auth/me — administrador de la sesión actual. */
function yo(req, res) {
  const a = adminDeCookie(req.headers.cookie);
  if (!a) return res.status(401).json({ ok: false });
  res.json({ ok: true, admin: adminModel.publico(a) });
}

/** POST /api/auth/login */
async function login(req, res) {
  const { usuario, clave, captcha: token, consentimiento } = req.body || {};
  if (consentimiento !== true) {
    return res.status(400).json({ ok: false, error: 'Debes autorizar el tratamiento de tus datos personales.' });
  }
  if (!(await captcha.verificar(token, req.ip))) {
    return res.status(400).json({ ok: false, error: 'CAPTCHA inválido o vencido. Inténtalo de nuevo.' });
  }
  const a = adminModel.buscarPorUsuario(usuario);
  // Se ejecuta scrypt aunque el usuario no exista, para no revelar cuentas por tiempo
  const ok = sesion.checkPassword(clave, a ? a.hash : 'x:00');
  if (!a || !ok) {
    res.locals.fallo();
    return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
  }
  res.locals.exito();
  iniciarSesion(req, res, a, 'clave');
  res.json({ ok: true, admin: adminModel.publico(a) });
}

/** POST /api/auth/logout */
function logout(req, res) {
  cerrarSesion(req, res);
  res.json({ ok: true });
}

/** GET /api/auth/oauth/:prov — paso 1: redirige a Google / GitHub. */
function oauthInicio(req, res) {
  const nombre = req.params.prov;
  const p = oauth.PROVEEDORES[nombre];
  if (!oauth.configurado(p)) return res.redirect(aLogin('Proveedor no configurado'));
  if (req.query.consent !== '1') return res.redirect(aLogin('Debes autorizar el tratamiento de datos personales'));

  const state = crypto.randomBytes(24).toString('hex');
  sesion.setCookie(req, res, COOKIE_OAUTH, sesion.firmar({ t: 'oauth', state }, getSessionSecret(), 600), { maxAgeSec: 600 });
  const url = new URL(p.auth);
  url.search = new URLSearchParams({
    client_id: p.id, redirect_uri: oauth.urlCallback(req, nombre),
    response_type: 'code', scope: p.scope, state, ...(nombre === 'google' ? { prompt: 'select_account' } : {})
  }).toString();
  res.redirect(url.toString());
}

/** GET /api/auth/oauth/:prov/callback — paso 2. */
async function oauthCallback(req, res) {
  const nombre = req.params.prov, p = oauth.PROVEEDORES[nombre];
  try {
    if (!p || !p.id) return res.redirect(aLogin('Proveedor no configurado'));
    const c = sesion.verificar(sesion.parseCookies(req.headers.cookie)[COOKIE_OAUTH], getSessionSecret());
    if (!c || c.state !== req.query.state || !req.query.code) return res.redirect(aLogin('Solicitud de acceso inválida'));
    sesion.clearCookie(req, res, COOKIE_OAUTH);

    const token = await oauth.canjearCodigo(req, nombre, req.query.code);
    if (!token) return res.redirect(aLogin('No se pudo validar la cuenta'));
    const admin = oauth.buscarAdmin(nombre, await oauth.perfil(nombre, token));
    if (!admin) return res.redirect(aLogin('Esta cuenta no está autorizada como administrador'));
    iniciarSesion(req, res, admin, nombre);
    res.redirect('/admin');
  } catch (e) {
    console.error('Error OAuth:', e.message);
    res.redirect(aLogin('Error al iniciar sesión con ' + nombre));
  }
}

module.exports = { configuracion, yo, login, logout, oauthInicio, oauthCallback };
