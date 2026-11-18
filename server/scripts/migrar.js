/**
 * scripts/migrar.js — Pasa los datos que hay en este equipo (server/data/store.json) a Supabase.
 *
 *   Uso:   npm run migrar --prefix server            (lee DATABASE_URL de credenciales/.env)
 *          npm run migrar --prefix server -- --forzar (sobrescribe el contador y la configuración que ya haya en Supabase)
 *
 * Qué pasa a Supabase:
 *   · contador (el número actual) y configuración (nombre, volumen, cajas…)
 *   · turnos de los últimos 7 días (los más viejos se depuran de todos modos)
 *   · administradores (los que ya existan NO se pisan)
 * Es seguro repetirlo: no duplica nada.
 */
require('../config/credenciales');
const fs = require('fs');
const db = require('../config/postgres');
const { STORE_PATH, RETENER_DIAS } = require('../models/store');

const forzar = process.argv.includes('--forzar');

(async () => {
  if (!db.configurado()) { console.error('❌ Falta DATABASE_URL en credenciales/.env (Supabase → Connect → Transaction pooler).'); process.exit(1); }
  if (!fs.existsSync(STORE_PATH)) { console.error(`❌ No hay datos locales en ${STORE_PATH}.`); process.exit(1); }
  const local = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  await db.conectar();
  console.log('✅ Conectado a la base de datos y tablas listas.');

  const hay = await db.consulta('SELECT valor FROM contador WHERE id = 1');
  const { contador, ...cfg } = local.config;
  if (!hay.rows.length || forzar) {
    await db.consulta(`INSERT INTO contador (id, valor) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()`, [contador]);
    await db.consulta(`INSERT INTO configuracion (id, datos) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, actualizado_en = now()`,
      [JSON.stringify({ ...cfg, sessionSecret: local.sessionSecret })]);
    console.log(`   · contador: ${contador}   · configuración: ${Object.keys(cfg).length} ajustes`);
  } else {
    console.log(`   · Supabase ya tiene contador (${hay.rows[0].valor}); no se toca. (Usa --forzar para sobrescribirlo.)`);
  }

  const limite = Date.now() - RETENER_DIAS * 86_400_000;
  const recientes = (local.historial || []).filter(r => r.ts && r.ts >= limite);
  for (const r of recientes) {
    await db.consulta(`INSERT INTO turnos (id, turno, caja, llamado_en, llamado_texto) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.turno, r.caja, r.ts, r.llamado_en]);
  }
  console.log(`   · turnos: ${recientes.length} de los últimos ${RETENER_DIAS} días (${(local.historial || []).length - recientes.length} más viejos no se pasan)`);

  let nuevos = 0;
  for (const a of local.admins || []) {
    const r = await db.consulta(
      `INSERT INTO administradores (usuario, nombre, clave_hash, rol, saludo, avatar, principal, email, github, debe_cambiar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
      [a.usuario, a.nombre, a.hash, a.rol || 'Administrador', a.saludo || 'Tu acceso al panel está listo.', a.avatar || '🧑‍💼',
       !!a.principal, (a.emails && a.emails[0]) || '', a.github || '', !!a.debeCambiar]);
    nuevos += r.rowCount;
  }
  console.log(`   · administradores: ${nuevos} nuevos (${(local.admins || []).length - nuevos} ya existían)`);

  console.log('\nEn Supabase quedó:');
  for (const [tabla, sql] of [['contador', 'SELECT valor::text AS v FROM contador'], ['turnos', 'SELECT count(*)::text AS v FROM turnos'],
                              ['administradores', `SELECT string_agg(usuario, ', ') AS v FROM administradores`]]) {
    const r = await db.consulta(sql);
    console.log(`   ${tabla.padEnd(16)} ${r.rows[0]?.v ?? '(vacío)'}`);
  }
  await db.cerrar();
})().catch(e => { console.error('❌ Falló la migración:', e.code || e.message); process.exit(1); });
