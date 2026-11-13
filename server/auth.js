/**
 * auth.js — Autenticación de administradores
 *  - Login usuario/contraseña + CAPTCHA (hCaptcha verificado en el servidor)
 *  - Login con Google y GitHub (OAuth 2.0, solo cuentas vinculadas a un admin)
 *  - Varios administradores, con validación de nombre real
 *  - Sesión en cookie HttpOnly firmada
 */
const crypto  = require('crypto');
const express = require('express');
const sec     = require('./security');
const cred    = require('./credenciales');   // lee credenciales/.env ANTES de usar process.env
const { getAdmins, setAdmins, getSessionSecret } = require('./db');

const COOKIE_SESION = 'gg_sid';
const COOKIE_OAUTH  = 'gg_oauth';
const SESION_SEG    = 8 * 60 * 60; // 8 horas

// ── Validación de nombre real ────────────────────────────────────────────────
// No se puede comprobar contra un registro civil; se bloquean personajes,
// seres fantásticos, apodos y entradas que claramente no son nombres reales.
const PROHIBIDOS = [
  'goku','vegeta','naruto','sasuke','luffy','batman','superman','spiderman','spider','hulk','thor',
  'ironman','joker','robin','mario','luigi','pikachu','sonic','zelda','link','yoda','vader','darth',
  'skywalker','potter','harry','hermione','voldemort','gandalf','frodo','aragorn','legolas','shrek',
  'barbie','elsa','anna','mickey','minnie','donald','goofy','pluto','simba','thanos','loki','neo',
  'dragon','dragón','mago','hechicero','bruja','hada','duende','elfo','orco','troll','ogro','vampiro',
  'zombie','demonio','angel','ángel','dios','diosa','rey','reina','princesa','principe','príncipe',
  'ninja','samurai','robot','alien','admin','administrador','usuario','test','prueba','anonimo','anónimo',
  'fulano','mengano','zutano','nadie','nombre','apellido','asdf','qwerty'
];

function validarNombreReal(nombre) {
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (n.length < 5 || n.length > 60) return 'El nombre debe tener entre 5 y 60 caracteres.';
  const palabras = n.split(' ');
  if (palabras.length < 2 || palabras.length > 5) return 'Escribe nombre y apellido (2 a 5 palabras).';
  for (const p of palabras) {
    if (!/^\p{L}+(?:['’-]\p{L}+)*$/u.test(p)) return 'El nombre solo puede tener letras (sin números ni símbolos).';
    if (p.length < 2 || p.length > 20) return 'Cada nombre o apellido debe tener entre 2 y 20 letras.';
    if (/(.)\1{2,}/iu.test(p)) return 'El nombre contiene letras repetidas que no parecen reales.';
    if (!/[aeiouáéíóúüy]/iu.test(p)) return 'Una de las palabras no parece un nombre real.';
    if (PROHIBIDOS.includes(p.toLowerCase())) return `"${p}" no se acepta: usa tu nombre real (no personajes ni seres fantásticos).`;
  }
  return null;
}

function formatearNombre(n) {
  return n.trim().replace(/\s+/g, ' ').split(' ')
    .map(p => p.charAt(0).toLocaleUpperCase('es') + p.slice(1).toLocaleLowerCase('es')).join(' ');
}

// ── Almacén de administradores ───────────────────────────────────────────────
// Los administradores iniciales NUNCA están en el código. Se leen de:
//   1) credenciales/administradores.json  (local)
//   2) variables ADMIN_PRINCIPAL_* (Render)
//   3) si no hay nada, se crea el principal con una contraseña aleatoria y se guarda en credenciales/
const AVATARES = ['👨‍💼', '👩‍💼', '🧑‍💼'];

function semilla() {
  let entradas = cred.leerAdministradores();

  if (!entradas || entradas.length === 0) {
    const deEntorno = !!process.env.ADMIN_PRINCIPAL_PASSWORD;
    const clave = process.env.ADMIN_PRINCIPAL_PASSWORD || cred.claveAleatoria();
    entradas = [{
      usuario: process.env.ADMIN_PRINCIPAL_USER || 'Ganaadmin',
      clave,
      nombre: process.env.ADMIN_PRINCIPAL_NAME || 'Juan David Porras',
      rol: 'Administrador Principal',
      saludo: 'Todo el sistema de turnos está listo para la jornada.',
      email: process.env.ADMIN_PRINCIPAL_EMAIL || '',
      github: process.env.ADMIN_PRINCIPAL_GITHUB || '',
      principal: true
    }];
    if (!deEntorno) {
      const ruta = cred.guardarAdministradores(entradas);
      console.log(`\n🔐 Se creó el administrador principal con una contraseña aleatoria.`);
      console.log(ruta ? `   Ábrela en: ${ruta}` : '   No se pudo guardar el archivo.');
      // En Render no hay forma de abrir el archivo: se muestra una sola vez en el registro
      if (process.env.RENDER || !ruta) console.log(`   Usuario: ${entradas[0].usuario}  ·  Contraseña inicial: ${clave}\n   (define ADMIN_PRINCIPAL_PASSWORD en Render para fijarla)`);
    }
  }

  return entradas.map((e, i) => {
    const err = validarNombreReal(e.nombre);
    if (err) console.warn(`⚠️  Administrador "${e.usuario}": ${err}`);
    return {
      id: i + 1, usuario: String(e.usuario), nombre: formatearNombre(String(e.nombre || e.usuario)),
      rol: e.rol || 'Administrador', saludo: e.saludo || 'Tu acceso al panel está listo.',
      avatar: e.avatar || AVATARES[i % AVATARES.length],
      hash: sec.hashPassword(String(e.clave)), principal: !!e.principal || i === 0,
      emails: e.email ? [String(e.email).toLowerCase()] : [], github: e.github || '',
      debeCambiar: !!e.debeCambiar
    };
  });
}

// Super administrador fijo (decisión del dueño, para poder entrar también en Render sin configurar variables).
// Se guarda SOLO el hash cifrado (scrypt), no la contraseña. Nota: el repositorio es público, por eso se
// recomienda cambiar la contraseña desde "Mi cuenta" por una más larga.
const SUPER_ADMIN = {
  usuario: 'JUAN-PORRAS', nombre: 'Juan David Porras', rol: 'Super Administrador',
  saludo: 'Tienes el control total del sistema de turnos.', avatar: '👨‍💼', principal: true,
  hash: '66afd5eb7e277ba2c60a51ba71959c7b:f8ca8938f1eaa943aa8279ea4a09c9fbf084a28e6fce1b0d8264beb3d3c2e05018ebfcd2b883d8c14dce89b079d72b0f1a62cbdaf680cb66e2a8e0e4cf305f91'
};

function admins() {
  let a = getAdmins();
  if (!a) { a = semilla(); setAdmins(a); }
  // Garantiza que el super administrador exista siempre (también tras reinicios de Render)
  if (!a.some(x => x.usuario.toLowerCase() === SUPER_ADMIN.usuario.toLowerCase())) {
    a.push({
      ...SUPER_ADMIN, id: Math.max(0, ...a.map(x => x.id)) + 1,
      emails: [], github: '', debeCambiar: true
    });
    setAdmins(a);
  }
  return a;
}

const publico = a => ({
  id: a.id, usuario: a.usuario, nombre: a.nombre, rol: a.rol, avatar: a.avatar,
  saludo: a.saludo, principal: !!a.principal, emails: a.emails || [],
  github: a.github || '', debeCambiar: !!a.debeCambiar
});

// ── Sesión ───────────────────────────────────────────────────────────────────
function adminDeCookie(cookieHeader) {
  const tok = sec.parseCookies(cookieHeader)[COOKIE_SESION];
  const data = sec.verificar(tok, getSessionSecret());
  if (!data || data.t !== 'sesion') return null;
  return admins().find(a => a.id === data.id) || null;
}

function iniciarSesion(req, res, admin, via) {
  const tok = sec.firmar({ t: 'sesion', id: admin.id, via }, getSessionSecret(), SESION_SEG);
  sec.setCookie(req, res, COOKIE_SESION, tok, { maxAgeSec: SESION_SEG });
}

function requireAdmin(req, res, next) {
  const a = adminDeCookie(req.headers.cookie);
  if (!a) return res.status(401).json({ ok: false, error: 'Sesión no válida' });
  req.admin = a;
  next();
}

// ── CAPTCHA (hCaptcha) ───────────────────────────────────────────────────────
// Sin claves en .env se usan las claves de PRUEBA oficiales de hCaptcha (siempre aprueban).
const HC_SITEKEY = process.env.HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001';
const HC_SECRET  = process.env.HCAPTCHA_SECRET  || '0x0000000000000000000000000000000000000000';

async function verificarCaptcha(token, ip) {
  if (!token) return false;
  try {
    const r = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: HC_SECRET, response: token, sitekey: HC_SITEKEY, remoteip: ip || '' })
    });
    const j = await r.json();
    return j.success === true;
  } catch (e) {
    console.error('Error verificando CAPTCHA:', e.message);
    return false;
  }
}

// ── OAuth ────────────────────────────────────────────────────────────────────
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

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = sec.esSeguro(req) ? 'https' : 'http';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

async function perfilOAuth(nombre, token) {
  const H = { Authorization: `Bearer ${token}`, 'User-Agent': 'ganagana-turnos', Accept: 'application/json' };
  if (nombre === 'google') {
    const u = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: H })).json();
    return { email: u.email_verified ? String(u.email || '').toLowerCase() : '', login: '' };
  }
  const u = await (await fetch('https://api.github.com/user', { headers: H })).json();
  const em = await (await fetch('https://api.github.com/user/emails', { headers: H })).json();
  const verificados = Array.isArray(em) ? em.filter(e => e.verified).map(e => e.email.toLowerCase()) : [];
  return { emails: verificados, login: String(u.login || '').toLowerCase(), email: verificados[0] || '' };
}

function buscarAdminOAuth(nombre, perfil) {
  return admins().find(a => {
    const correos = (a.emails || []).map(e => e.toLowerCase());
    if (nombre === 'google') return perfil.email && correos.includes(perfil.email);
    return (perfil.login && a.github && a.github.toLowerCase() === perfil.login) ||
           (perfil.emails || []).some(e => correos.includes(e));
  });
}

// ── Rutas ────────────────────────────────────────────────────────────────────
const router = express.Router();
const limite = sec.limitador({ max: 5, ventanaMs: 60_000, bloqueoMs: 60_000 });

router.get('/config', (_req, res) => res.json({
  hcaptchaSitekey: HC_SITEKEY,
  hcaptchaPrueba: !process.env.HCAPTCHA_SITEKEY,
  google: !!(PROVEEDORES.google.id && PROVEEDORES.google.secret),
  github: !!(PROVEEDORES.github.id && PROVEEDORES.github.secret)
}));

router.get('/me', (req, res) => {
  const a = adminDeCookie(req.headers.cookie);
  if (!a) return res.status(401).json({ ok: false });
  res.json({ ok: true, admin: publico(a) });
});

router.post('/login', limite, async (req, res) => {
  const { usuario, clave, captcha, consentimiento } = req.body || {};
  if (consentimiento !== true) {
    return res.status(400).json({ ok: false, error: 'Debes autorizar el tratamiento de tus datos personales.' });
  }
  if (!(await verificarCaptcha(captcha, req.ip))) {
    return res.status(400).json({ ok: false, error: 'CAPTCHA inválido o vencido. Inténtalo de nuevo.' });
  }
  const a = admins().find(x => x.usuario.toLowerCase() === String(usuario || '').toLowerCase());
  // Se ejecuta scrypt aunque el usuario no exista, para no revelar cuentas por tiempo
  const ok = sec.checkPassword(clave, a ? a.hash : 'x:00');
  if (!a || !ok) {
    res.locals.fallo();
    return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
  }
  res.locals.exito();
  iniciarSesion(req, res, a, 'clave');
  res.json({ ok: true, admin: publico(a) });
});

router.post('/logout', (req, res) => {
  sec.clearCookie(req, res, COOKIE_SESION);
  res.json({ ok: true });
});

// Paso 1 OAuth: redirige a Google / GitHub
router.get('/oauth/:prov', (req, res) => {
  const p = PROVEEDORES[req.params.prov];
  if (!p || !p.id || !p.secret) return res.redirect('/admin?error=' + encodeURIComponent('Proveedor no configurado'));
  if (req.query.consent !== '1') {
    return res.redirect('/admin?error=' + encodeURIComponent('Debes autorizar el tratamiento de datos personales'));
  }
  const state = crypto.randomBytes(24).toString('hex');
  sec.setCookie(req, res, COOKIE_OAUTH, sec.firmar({ t: 'oauth', state }, getSessionSecret(), 600), { maxAgeSec: 600 });
  const url = new URL(p.auth);
  url.search = new URLSearchParams({
    client_id: p.id, redirect_uri: `${baseUrl(req)}/api/auth/oauth/${req.params.prov}/callback`,
    response_type: 'code', scope: p.scope, state, ...(req.params.prov === 'google' ? { prompt: 'select_account' } : {})
  }).toString();
  res.redirect(url.toString());
});

// Paso 2 OAuth: callback
router.get('/oauth/:prov/callback', async (req, res) => {
  const nombre = req.params.prov, p = PROVEEDORES[nombre];
  const fallo = msg => res.redirect('/admin?error=' + encodeURIComponent(msg));
  try {
    if (!p || !p.id) return fallo('Proveedor no configurado');
    const c = sec.verificar(sec.parseCookies(req.headers.cookie)[COOKIE_OAUTH], getSessionSecret());
    if (!c || c.state !== req.query.state || !req.query.code) return fallo('Solicitud de acceso inválida');
    sec.clearCookie(req, res, COOKIE_OAUTH);

    const tr = await fetch(p.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: p.id, client_secret: p.secret, code: String(req.query.code),
        redirect_uri: `${baseUrl(req)}/api/auth/oauth/${nombre}/callback`, grant_type: 'authorization_code'
      })
    });
    const t = await tr.json();
    if (!t.access_token) return fallo('No se pudo validar la cuenta');
    const perfil = await perfilOAuth(nombre, t.access_token);
    const admin = buscarAdminOAuth(nombre, perfil);
    if (!admin) return fallo('Esta cuenta no está autorizada como administrador');
    iniciarSesion(req, res, admin, nombre);
    res.redirect('/admin');
  } catch (e) {
    console.error('Error OAuth:', e.message);
    fallo('Error al iniciar sesión con ' + nombre);
  }
});

// ── Gestión de administradores ───────────────────────────────────────────────
router.get('/admins', requireAdmin, (req, res) => {
  res.json(req.admin.principal ? admins().map(publico) : [publico(req.admin)]);
});

router.post('/admins', requireAdmin, (req, res) => {
  if (!req.admin.principal) return res.status(403).json({ ok: false, error: 'Solo el administrador principal puede crear administradores.' });
  const { usuario, clave, nombre, rol, email, github } = req.body || {};
  const errNombre = validarNombreReal(nombre);
  if (errNombre) return res.status(400).json({ ok: false, error: errNombre });
  if (!/^[A-Za-z0-9._-]{4,24}$/.test(usuario || '')) return res.status(400).json({ ok: false, error: 'Usuario: 4 a 24 caracteres (letras, números, . _ -).' });
  if (typeof clave !== 'string' || clave.length < 8 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener 8+ caracteres con letras y números.' });
  }
  const lista = admins();
  if (lista.some(a => a.usuario.toLowerCase() === usuario.toLowerCase())) return res.status(409).json({ ok: false, error: 'Ese usuario ya existe.' });
  const correo = String(email || '').trim().toLowerCase();
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return res.status(400).json({ ok: false, error: 'Correo inválido.' });
  const nuevo = {
    id: Math.max(...lista.map(a => a.id)) + 1, usuario, nombre: formatearNombre(nombre),
    rol: String(rol || 'Administrador').slice(0, 40), saludo: 'Tu acceso al panel está listo.',
    avatar: '🧑‍💼', hash: sec.hashPassword(clave), principal: false,
    emails: correo ? [correo] : [], github: String(github || '').trim().slice(0, 39), debeCambiar: false
  };
  lista.push(nuevo); setAdmins(lista);
  res.json({ ok: true, admin: publico(nuevo) });
});

router.delete('/admins/:id', requireAdmin, (req, res) => {
  if (!req.admin.principal) return res.status(403).json({ ok: false, error: 'Sin permiso.' });
  const id = parseInt(req.params.id);
  const lista = admins();
  const obj = lista.find(a => a.id === id);
  if (!obj || obj.principal) return res.status(400).json({ ok: false, error: 'No se puede eliminar ese administrador.' });
  setAdmins(lista.filter(a => a.id !== id));
  res.json({ ok: true });
});

// Cambiar contraseña y vincular Google/GitHub del propio admin
router.post('/me/clave', requireAdmin, (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!sec.checkPassword(actual, req.admin.hash)) return res.status(401).json({ ok: false, error: 'Contraseña actual incorrecta.' });
  if (typeof nueva !== 'string' || nueva.length < 8 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener 8+ caracteres con letras y números.' });
  }
  const lista = admins();
  const a = lista.find(x => x.id === req.admin.id);
  a.hash = sec.hashPassword(nueva); a.debeCambiar = false;
  setAdmins(lista);
  res.json({ ok: true });
});

router.post('/me/vinculos', requireAdmin, (req, res) => {
  const correo = String(req.body?.email || '').trim().toLowerCase();
  const github = String(req.body?.github || '').trim();
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return res.status(400).json({ ok: false, error: 'Correo inválido.' });
  if (github && !/^[A-Za-z0-9-]{1,39}$/.test(github)) return res.status(400).json({ ok: false, error: 'Usuario de GitHub inválido.' });
  const lista = admins();
  const a = lista.find(x => x.id === req.admin.id);
  a.emails = correo ? [correo] : []; a.github = github;
  setAdmins(lista);
  res.json({ ok: true, admin: publico(a) });
});

// Crea los administradores iniciales al arrancar (y genera credenciales/administradores.json si hace falta)
admins();

module.exports = { router, requireAdmin, adminDeCookie, validarNombreReal };
