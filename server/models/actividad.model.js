/**
 * models/actividad.model.js — Reporte de lo que hace cada administrador (ingresos, cambios, reinicios…).
 *
 * Se guarda en la tabla `actividad` de Supabase. Si la base de datos no está disponible se guarda en el
 * archivo local, así que registrar una acción NUNCA falla ni frena lo que el administrador estaba haciendo.
 * Se conservan 90 días.
 */
const db    = require('../config/postgres');
const store = require('./store');

const RETENER_DIAS = 90;
const MAX_MEMORIA  = 1000;

const enMemoria = () => (store.datos.actividad ||= []);

/** Fila de la base de datos o de la memoria → objeto uniforme para el panel. */
const normalizar = r => ({
  id: Number(r.id), cuando: new Date(r.cuando).toISOString(), adminId: r.admin_id ?? r.adminId ?? null,
  usuario: r.usuario || '(sistema)', nombre: r.nombre || '', accion: r.accion, detalle: r.detalle || '', ip: r.ip || ''
});

/**
 * Anota una acción. `admin` es { id, usuario, nombre } (o null si fue el sistema).
 * Nunca lanza error.
 */
async function registrar(admin, accion, detalle = '', ip = '') {
  const fila = {
    cuando: new Date().toISOString(), admin_id: admin?.id ?? null, usuario: admin?.usuario ?? null, nombre: admin?.nombre ?? null,
    accion: String(accion).slice(0, 60), detalle: String(detalle).slice(0, 500), ip: String(ip || '').slice(0, 64)
  };
  try {
    if (db.conectado()) {
      await db.consulta(
        'INSERT INTO actividad (cuando, admin_id, usuario, nombre, accion, detalle, ip) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [fila.cuando, fila.admin_id, fila.usuario, fila.nombre, fila.accion, fila.detalle, fila.ip]);
      return;
    }
  } catch (e) { console.error('⚠️  Actividad (base de datos):', e.code || e.message); }
  const lista = enMemoria();
  lista.push({ ...fila, id: (lista.length ? lista[lista.length - 1].id : 0) + 1 });
  if (lista.length > MAX_MEMORIA) lista.splice(0, lista.length - MAX_MEMORIA);
  try { store.guardar(); } catch { /* nada */ }
}

/** Últimas acciones, de la más nueva a la más vieja. `adminId` limita a un administrador. */
async function listar({ limite = 200, adminId = null } = {}) {
  const n = Math.min(Math.max(parseInt(limite) || 200, 1), 1000);
  try {
    if (db.conectado()) {
      const r = adminId
        ? await db.consulta('SELECT * FROM actividad WHERE admin_id = $2 ORDER BY cuando DESC, id DESC LIMIT $1', [n, adminId])
        : await db.consulta('SELECT * FROM actividad ORDER BY cuando DESC, id DESC LIMIT $1', [n]);
      return r.rows.map(normalizar);
    }
  } catch (e) { console.error('⚠️  Actividad (lectura):', e.code || e.message); }
  return enMemoria().filter(f => !adminId || f.admin_id === adminId).slice(-n).reverse().map(normalizar);
}

/** Resumen por administrador de los últimos 30 días. */
async function resumen({ adminId = null } = {}) {
  try {
    if (db.conectado()) {
      const r = await db.consulta(
        `SELECT usuario, max(nombre) AS nombre, count(*)::int AS acciones, max(cuando) AS ultima
           FROM actividad WHERE cuando > now() - interval '30 days' ${adminId ? 'AND admin_id = $1' : ''}
          GROUP BY usuario ORDER BY acciones DESC`, adminId ? [adminId] : []);
      return r.rows.map(x => ({ usuario: x.usuario || '(sistema)', nombre: x.nombre || '', acciones: x.acciones, ultima: new Date(x.ultima).toISOString() }));
    }
  } catch (e) { console.error('⚠️  Actividad (resumen):', e.code || e.message); }
  const limite = Date.now() - 30 * 86_400_000, por = new Map();
  for (const f of enMemoria()) {
    if (new Date(f.cuando).getTime() < limite || (adminId && f.admin_id !== adminId)) continue;
    const u = f.usuario || '(sistema)', x = por.get(u) || { usuario: u, nombre: f.nombre || '', acciones: 0, ultima: f.cuando };
    x.acciones += 1; if (f.cuando > x.ultima) x.ultima = f.cuando; por.set(u, x);
  }
  return [...por.values()].sort((a, b) => b.acciones - a.acciones);
}

/** Borra lo de más de 90 días. */
async function depurar() {
  try {
    const limite = Date.now() - RETENER_DIAS * 86_400_000;
    const lista = enMemoria(), vivos = lista.filter(f => new Date(f.cuando).getTime() >= limite);
    if (vivos.length !== lista.length) { lista.splice(0, lista.length, ...vivos); store.guardar(); }
    if (db.conectado()) await db.consulta('DELETE FROM actividad WHERE cuando < now() - make_interval(days => $1)', [RETENER_DIAS]);
  } catch (e) { console.error('⚠️  Depuración de actividad:', e.code || e.message); }
}

module.exports = { registrar, listar, resumen, depurar, RETENER_DIAS };
