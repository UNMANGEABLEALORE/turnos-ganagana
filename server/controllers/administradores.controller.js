/** controllers/administradores.controller.js — Gestión de administradores y "Mi cuenta". */
const sesion = require('../utils/sesion');
const v      = require('../utils/validaciones');
const adminModel = require('../models/administrador.model');

const { publico } = adminModel;
const error = (res, status, msg) => res.status(status).json({ ok: false, error: msg });

/** GET /api/auth/admins — el principal ve a todos; los demás solo a sí mismos. */
function listar(req, res) {
  res.json(req.admin.principal ? adminModel.listar().map(publico) : [publico(req.admin)]);
}

/** POST /api/auth/admins — solo el principal. */
function crear(req, res) {
  if (!req.admin.principal) return error(res, 403, 'Solo el administrador principal puede crear administradores.');
  const { usuario, clave, nombre, rol, email, github } = req.body || {};
  const correo = String(email || '').trim().toLowerCase();

  const problema = v.validarNombreReal(nombre) || v.validarUsuario(usuario) || v.validarClave(clave) || v.validarCorreo(correo);
  if (problema) return error(res, 400, problema);

  const lista = adminModel.listar();
  if (lista.some(a => a.usuario.toLowerCase() === usuario.toLowerCase())) return error(res, 409, 'Ese usuario ya existe.');

  const nuevo = {
    id: Math.max(...lista.map(a => a.id)) + 1, usuario, nombre: v.formatearNombre(nombre),
    rol: String(rol || 'Administrador').slice(0, 40), saludo: 'Tu acceso al panel está listo.',
    avatar: '🧑‍💼', hash: sesion.hashPassword(clave), principal: false,
    emails: correo ? [correo] : [], github: String(github || '').trim().slice(0, 39), debeCambiar: false
  };
  lista.push(nuevo);
  adminModel.guardarLista(lista);
  res.json({ ok: true, admin: publico(nuevo) });
}

/** DELETE /api/auth/admins/:id — solo el principal; no se puede borrar a un principal. */
function eliminar(req, res) {
  if (!req.admin.principal) return error(res, 403, 'Sin permiso.');
  const id = parseInt(req.params.id);
  const lista = adminModel.listar();
  const obj = lista.find(a => a.id === id);
  if (!obj || obj.principal) return error(res, 400, 'No se puede eliminar ese administrador.');
  adminModel.guardarLista(lista.filter(a => a.id !== id));
  res.json({ ok: true });
}

/** POST /api/auth/me/clave — cambia la contraseña del propio administrador. */
function cambiarClave(req, res) {
  const { actual, nueva } = req.body || {};
  if (!sesion.checkPassword(actual, req.admin.hash)) return error(res, 401, 'Contraseña actual incorrecta.');
  const problema = v.validarClave(nueva, 'La nueva contraseña');
  if (problema) return error(res, 400, problema);
  const lista = adminModel.listar();
  const a = lista.find(x => x.id === req.admin.id);
  a.hash = sesion.hashPassword(nueva);
  a.debeCambiar = false;
  adminModel.guardarLista(lista);
  res.json({ ok: true });
}

/** POST /api/auth/me/vinculos — vincula el correo de Google y el usuario de GitHub. */
function vincular(req, res) {
  const correo = String(req.body?.email || '').trim().toLowerCase();
  const github = String(req.body?.github || '').trim();
  const problema = v.validarCorreo(correo) || v.validarGithub(github);
  if (problema) return error(res, 400, problema);
  const lista = adminModel.listar();
  const a = lista.find(x => x.id === req.admin.id);
  a.emails = correo ? [correo] : [];
  a.github = github;
  adminModel.guardarLista(lista);
  res.json({ ok: true, admin: publico(a) });
}

module.exports = { listar, crear, eliminar, cambiarClave, vincular };
