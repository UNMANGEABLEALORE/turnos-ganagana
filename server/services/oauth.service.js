/** services/oauth.service.js — Inicio de sesión con Google y GitHub (OAuth 2.0). */
const { esSeguro } = require('../utils/sesion');
const adminModel = require('../models/administrador.model');

const PROVEEDORES = {
  google: {
    id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET,
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile'
  },
  github: {
    id: process.env.GITHUB_CLIENT_ID, secret: process.env.GITHUB_CLIENT_SECRET,
    auth: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email'
  }
};

const configurado = p => !!(p && p.id && p.secret);

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = esSeguro(req) ? 'https' : 'http';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

const urlCallback = (req, nombre) => `${baseUrl(req)}/api/auth/oauth/${nombre}/callback`;

/** Cambia el "code" por un token y devuelve el token de acceso (o null). */
async function canjearCodigo(req, nombre, code) {
  const p = PROVEEDORES[nombre];
  const tr = await fetch(p.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: p.id, client_secret: p.secret, code: String(code),
      redirect_uri: urlCallback(req, nombre), grant_type: 'authorization_code'
    })
  });
  const t = await tr.json();
  return t.access_token || null;
}

/** Lee del proveedor SOLO el correo verificado (y usuario de GitHub). */
async function perfil(nombre, token) {
  const H = { Authorization: `Bearer ${token}`, 'User-Agent': 'ganagana-turnos', Accept: 'application/json' };
  if (nombre === 'google') {
    const u = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: H })).json();
    return { email: u.email_verified ? String(u.email || '').toLowerCase() : '', login: '' };
  }
  const u  = await (await fetch('https://api.github.com/user', { headers: H })).json();
  const em = await (await fetch('https://api.github.com/user/emails', { headers: H })).json();
  const verificados = Array.isArray(em) ? em.filter(e => e.verified).map(e => e.email.toLowerCase()) : [];
  return { emails: verificados, login: String(u.login || '').toLowerCase(), email: verificados[0] || '' };
}

/** Solo entra quien ya está vinculado a un administrador. */
function buscarAdmin(nombre, p) {
  return adminModel.listar().find(a => {
    const correos = (a.emails || []).map(e => e.toLowerCase());
    if (nombre === 'google') return p.email && correos.includes(p.email);
    return (p.login && a.github && a.github.toLowerCase() === p.login) ||
           (p.emails || []).some(e => correos.includes(e));
  });
}

module.exports = { PROVEEDORES, configurado, urlCallback, canjearCodigo, perfil, buscarAdmin };
