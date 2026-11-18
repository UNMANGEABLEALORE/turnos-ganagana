/**
 * models/administrador.model.js — Administradores del sistema.
 *
 * Dónde se guardan:
 *   · Postgres / Supabase (tabla `administradores`) si existe DATABASE_URL  ← modo principal
 *   · server/data/store.json si no hay MySQL (por ejemplo en Render sin base de datos)
 * En ambos casos se mantiene una copia en memoria para responder rápido; cada cambio se escribe
 * PRIMERO en la base de datos y solo si se guardó bien se actualiza la memoria.
 *
 * Contraseñas: SIEMPRE cifradas con scrypt (columna clave_hash). Nunca se guarda la clave en texto plano.
 *
 * Los administradores iniciales NUNCA están en el código. Se leen de:
 *   1) credenciales/administradores.json  (local)
 *   2) variables ADMIN_PRINCIPAL_* (Render)
 *   3) si no hay nada, se crea el principal con una contraseña aleatoria y se guarda en credenciales/
 */
const store = require('./store');
const db    = require('../config/postgres');
const cred  = require('../config/credenciales');
const { hashPassword } = require('../utils/sesion');
const { validarNombreReal, formatearNombre } = require('../utils/validaciones');

const AVATARES = ['👨‍💼', '👩‍💼', '🧑‍💼'];

// Super administrador fijo (decisión del dueño, para poder entrar también en Render sin configurar variables).
// Se guarda SOLO el hash cifrado (scrypt), no la contraseña.
const SUPER_ADMIN = {
  usuario: 'JUAN-PORRAS', nombre: 'Juan David Porras', rol: 'Super Administrador',
  saludo: 'Tienes el control total del sistema de turnos.', avatar: '👨‍💼', principal: true,
  hash: '66afd5eb7e277ba2c60a51ba71959c7b:f8ca8938f1eaa943aa8279ea4a09c9fbf084a28e6fce1b0d8264beb3d3c2e05018ebfcd2b883d8c14dce89b079d72b0f1a62cbdaf680cb66e2a8e0e4cf305f91'
};

let cache = null;          // lista en memoria
let modo  = 'archivo';     // 'postgres' | 'archivo'

// ── Semilla (primer arranque) ────────────────────────────────────────────────
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

function conSuperAdmin(lista) {
  if (!lista.some(x => x.usuario.toLowerCase() === SUPER_ADMIN.usuario.toLowerCase())) {
    lista.push({ ...SUPER_ADMIN, id: Math.max(0, ...lista.map(x => x.id)) + 1, emails: [], github: '', debeCambiar: true });
    return true;
  }
  return false;
}

// ── Postgres: conversión fila ↔ objeto ───────────────────────────────────────
const deFila = r => ({
  id: r.id, usuario: r.usuario, nombre: r.nombre, hash: r.clave_hash, rol: r.rol, saludo: r.saludo,
  avatar: r.avatar, principal: !!r.principal, emails: r.email ? [r.email] : [], github: r.github || '',
  debeCambiar: !!r.debe_cambiar
});

/** Inserta un administrador (consulta parametrizada) y devuelve su id. */
async function insertarFila(a, conId = false) {
  const cols = ['usuario', 'nombre', 'clave_hash', 'rol', 'saludo', 'avatar', 'principal', 'email', 'github', 'debe_cambiar'];
  const vals = [a.usuario, a.nombre, a.hash, a.rol, a.saludo, a.avatar, !!a.principal,
                (a.emails && a.emails[0]) || '', a.github || '', !!a.debeCambiar];
  if (conId) { cols.unshift('id'); vals.unshift(a.id); }
  const r = await db.consulta(
    `INSERT INTO administradores (${cols.join(', ')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING id`, vals);
  return r.rows[0].id;
}

async function leerTodos() {
  const r = await db.consulta('SELECT * FROM administradores ORDER BY id');
  return r.rows.map(deFila);
}

/** Después de insertar con id explícito (migración) la secuencia debe seguir desde el mayor. */
const ajustarSecuencia = () => db.consulta(
  `SELECT setval(pg_get_serial_sequence('administradores', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM administradores), 1))`);

// ── Arranque ─────────────────────────────────────────────────────────────────
/** Se llama una vez al iniciar el servidor. Nunca lanza error: si MySQL falla, se usa el archivo JSON. */
async function iniciar() {
  if (db.configurado()) {
    try {
      await db.conectar();
      let lista = await leerTodos();
      if (lista.length === 0) {
        // Primera vez con la base de datos: se migran los administradores que ya existían en el archivo JSON
        const previos = store.datos.admins && store.datos.admins.length ? store.datos.admins : semilla();
        conSuperAdmin(previos);
        for (const a of previos) await insertarFila(a, true);
        await ajustarSecuencia();
        console.log(`🗄️  ${previos.length} administradores migrados a la tabla "administradores".`);
        lista = await leerTodos();
      } else if (conSuperAdmin(lista)) {
        await insertarFila(lista[lista.length - 1]);
        lista = await leerTodos();
      }
      cache = lista;
      modo = 'postgres';
      console.log(`🗄️  Administradores en la base de datos: ${lista.length}`);
      return;
    } catch (e) {
      console.error(`⚠️  No se pudo usar la base de datos para los administradores (${e.code || e.message}). Se usará el archivo JSON.`);
      await db.cerrar();
    }
  }
  modo = 'archivo';
  listar();
}

// ── Lectura (desde memoria, síncrona) ────────────────────────────────────────
function listar() {
  if (cache) return cache;
  // Modo archivo: la lista vive dentro de store.json
  let lista = store.datos.admins;
  if (!lista) { lista = semilla(); store.datos.admins = lista; store.guardar(); }
  if (conSuperAdmin(lista)) store.guardar();
  cache = lista;
  return cache;
}

const buscarPorId      = id => listar().find(a => a.id === id) || null;
const buscarPorUsuario = u  => listar().find(a => a.usuario.toLowerCase() === String(u || '').toLowerCase()) || null;
const dondeSeGuarda    = () => (modo === 'postgres' ? 'la base de datos Supabase' : 'el archivo de datos');

// ── Escritura (primero la base de datos; luego la memoria) ──────────────────
/** Crea un administrador. Lanza un error con code 'DUPLICADO' si el usuario ya existe. */
async function crear(datos) {
  const lista = listar();
  if (lista.some(a => a.usuario.toLowerCase() === datos.usuario.toLowerCase())) {
    const e = new Error('Ese usuario ya existe.'); e.code = 'DUPLICADO'; throw e;
  }
  const nuevo = { emails: [], github: '', debeCambiar: false, principal: false, ...datos };
  if (modo === 'postgres') {
    try { nuevo.id = await insertarFila(nuevo); }
    catch (e) { if (e.code === '23505') { const d = new Error('Ese usuario ya existe.'); d.code = 'DUPLICADO'; throw d; } throw e; }
    // Comprobación: se vuelve a leer de la base de datos lo que quedó guardado
    const r = await db.consulta('SELECT * FROM administradores WHERE id = $1', [nuevo.id]);
    if (!r.rows.length) throw new Error('La base de datos no confirmó el guardado.');
    const guardado = deFila(r.rows[0]);
    lista.push(guardado);
    return guardado;
  }
  nuevo.id = Math.max(0, ...lista.map(a => a.id)) + 1;
  lista.push(nuevo);
  store.guardar();
  return nuevo;
}

async function eliminar(id) {
  const lista = listar();
  if (modo === 'postgres') {
    const r = await db.consulta('DELETE FROM administradores WHERE id = $1 AND principal = false', [id]);
    if (!r.rowCount) return false;
  }
  const i = lista.findIndex(a => a.id === id);
  if (i < 0) return false;
  lista.splice(i, 1);
  if (modo !== 'postgres') store.guardar();
  return true;
}

/** Cambia la contraseña (hash) y/o los vínculos de Google/GitHub. */
async function actualizar(id, { hash, debeCambiar, emails, github } = {}) {
  const a = buscarPorId(id);
  if (!a) return null;
  const nuevo = {
    hash: hash ?? a.hash, debeCambiar: debeCambiar ?? a.debeCambiar,
    emails: emails ?? a.emails, github: github ?? a.github
  };
  if (modo === 'postgres') {
    await db.consulta(
      'UPDATE administradores SET clave_hash = $1, debe_cambiar = $2, email = $3, github = $4, actualizado_en = now() WHERE id = $5',
      [nuevo.hash, !!nuevo.debeCambiar, (nuevo.emails && nuevo.emails[0]) || '', nuevo.github || '', id]);
  }
  Object.assign(a, nuevo);
  if (modo !== 'postgres') store.guardar();
  return a;
}

/** Datos del administrador que pueden viajar al navegador (sin el hash de la contraseña). */
const publico = a => ({
  id: a.id, usuario: a.usuario, nombre: a.nombre, rol: a.rol, avatar: a.avatar,
  saludo: a.saludo, principal: !!a.principal, emails: a.emails || [],
  github: a.github || '', debeCambiar: !!a.debeCambiar
});

module.exports = { iniciar, listar, buscarPorId, buscarPorUsuario, crear, eliminar, actualizar, publico, dondeSeGuarda,
  modo: () => modo };
