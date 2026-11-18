/** controllers/administradores.controller.js — Gestión de administradores y "Mi cuenta". */
const sesion = require('../utils/sesion');
const v      = require('../utils/validaciones');
const adminModel = require('../models/administrador.model');
const actividad  = require('../models/actividad.model');

const { publico } = adminModel;
const error = (res, status, msg) => res.status(status).json({ ok: false, error: msg });

/** Errores de la base de datos → mensaje claro (sin detalles internos). */
function errorGuardado(res, e) {
  if (e.code === 'DUPLICADO') return error(res, 409, 'Ese usuario ya existe.');
  console.error('Error guardando administrador:', e.code || e.message);
  return error(res, 503, 'No se pudo guardar: la base de datos no respondió. Inténtalo de nuevo en unos segundos.');
}

/** GET /api/auth/admins — el principal ve a todos; los demás solo a sí mismos. */
function listar(req, res) {
  res.json(req.admin.principal ? adminModel.listar().map(publico) : [publico(req.admin)]);
}

/** POST /api/auth/admins — solo el principal. Responde solo cuando el guardado está confirmado. */
async function crear(req, res) {
  if (!req.admin.principal) return error(res, 403, 'Solo el administrador principal puede crear administradores.');
  const { usuario, clave, nombre, rol, email, github } = req.body || {};
  const correo = String(email || '').trim().toLowerCase();

  const problema = v.validarNombreReal(nombre) || v.validarUsuario(usuario) || v.validarClave(clave) ||
                   v.validarCorreo(correo) || v.validarGithub(String(github || '').trim());
  if (problema) return error(res, 400, problema);

  try {
    const nuevo = await adminModel.crear({
      usuario, nombre: v.formatearNombre(nombre),
      rol: String(rol || 'Administrador').trim().slice(0, 40) || 'Administrador',
      saludo: 'Tu acceso al panel está listo.', avatar: '🧑‍💼',
      hash: sesion.hashPassword(clave), principal: false,
      emails: correo ? [correo] : [], github: String(github || '').trim().slice(0, 39), debeCambiar: false
    });
    await actividad.registrar(req.admin, 'Creó un administrador', `${nuevo.nombre} (usuario ${nuevo.usuario}, ${nuevo.rol})`, req.ip);
    res.json({ ok: true, admin: publico(nuevo), guardadoEn: adminModel.dondeSeGuarda() });
  } catch (e) { errorGuardado(res, e); }
}

/** DELETE /api/auth/admins/:id — solo el principal; no se puede borrar a un principal. */
async function eliminar(req, res) {
  if (!req.admin.principal) return error(res, 403, 'Sin permiso.');
  const id = parseInt(req.params.id);
  const obj = adminModel.buscarPorId(id);
  if (!obj || obj.principal) return error(res, 400, 'No se puede eliminar ese administrador.');
  try {
    if (!(await adminModel.eliminar(id))) return error(res, 400, 'No se puede eliminar ese administrador.');
    await actividad.registrar(req.admin, 'Eliminó un administrador', `${obj.nombre} (usuario ${obj.usuario})`, req.ip);
    res.json({ ok: true, guardadoEn: adminModel.dondeSeGuarda() });
  } catch (e) { errorGuardado(res, e); }
}

/** POST /api/auth/me/clave — cambia la contraseña del propio administrador. */
async function cambiarClave(req, res) {
  const { actual, nueva } = req.body || {};
  if (!sesion.checkPassword(actual, req.admin.hash)) return error(res, 401, 'Contraseña actual incorrecta.');
  const problema = v.validarClave(nueva, 'La nueva contraseña');
  if (problema) return error(res, 400, problema);
  try {
    await adminModel.actualizar(req.admin.id, { hash: sesion.hashPassword(nueva), debeCambiar: false });
    await actividad.registrar(req.admin, 'Cambió su contraseña', '', req.ip);
    res.json({ ok: true, guardadoEn: adminModel.dondeSeGuarda() });
  } catch (e) { errorGuardado(res, e); }
}

/** POST /api/auth/me/vinculos — vincula el correo de Google y el usuario de GitHub. */
async function vincular(req, res) {
  const correo = String(req.body?.email || '').trim().toLowerCase();
  const github = String(req.body?.github || '').trim();
  const problema = v.validarCorreo(correo) || v.validarGithub(github);
  if (problema) return error(res, 400, problema);
  try {
    const a = await adminModel.actualizar(req.admin.id, { emails: correo ? [correo] : [], github });
    await actividad.registrar(req.admin, 'Vinculó cuentas', `Google: ${correo || '—'} · GitHub: ${github || '—'}`, req.ip);
    res.json({ ok: true, admin: publico(a), guardadoEn: adminModel.dondeSeGuarda() });
  } catch (e) { errorGuardado(res, e); }
}

module.exports = { listar, crear, eliminar, cambiarClave, vincular };
