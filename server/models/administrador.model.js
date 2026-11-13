/**
 * models/administrador.model.js — Administradores del sistema.
 *
 * Los administradores iniciales NUNCA están en el código. Se leen de:
 *   1) credenciales/administradores.json  (local)
 *   2) variables ADMIN_PRINCIPAL_* (Render)
 *   3) si no hay nada, se crea el principal con una contraseña aleatoria y se guarda en credenciales/
 */
const store = require('./store');
const cred  = require('../config/credenciales');
const { hashPassword } = require('../utils/sesion');
const { validarNombreReal, formatearNombre } = require('../utils/validaciones');

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
      hash: hashPassword(String(e.clave)), principal: !!e.principal || i === 0,
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

/** Lista de administradores (se crean al primer uso). */
function listar() {
  let lista = store.datos.admins;
  if (!lista) { lista = semilla(); guardarLista(lista); }
  // Garantiza que el super administrador exista siempre (también tras reinicios de Render)
  if (!lista.some(x => x.usuario.toLowerCase() === SUPER_ADMIN.usuario.toLowerCase())) {
    lista.push({
      ...SUPER_ADMIN, id: Math.max(0, ...lista.map(x => x.id)) + 1,
      emails: [], github: '', debeCambiar: true
    });
    guardarLista(lista);
  }
  return lista;
}

function guardarLista(lista) {
  store.datos.admins = lista;
  store.guardar();
}

const buscarPorId      = id => listar().find(a => a.id === id) || null;
const buscarPorUsuario = u  => listar().find(a => a.usuario.toLowerCase() === String(u || '').toLowerCase()) || null;

/** Datos del administrador que pueden viajar al navegador (sin el hash de la contraseña). */
const publico = a => ({
  id: a.id, usuario: a.usuario, nombre: a.nombre, rol: a.rol, avatar: a.avatar,
  saludo: a.saludo, principal: !!a.principal, emails: a.emails || [],
  github: a.github || '', debeCambiar: !!a.debeCambiar
});

module.exports = { listar, guardarLista, buscarPorId, buscarPorUsuario, publico };
