/**
 * operacion.js — Pruebas de la operación diaria en Render.   Uso:  node server/tests/operacion.js
 *   A) Reinicio automático del contador a A00 cada mañana (hora de Colombia).
 *   B) Reinicio de Render con el disco BORRADO: turnos, contador, administradores y sesiones deben sobrevivir (base de datos).
 *   C) Número que continúa al otro día + depuración de turnos de más de 7 días (el contador nunca se depura).
 *      B y C usan Postgres de laboratorio (PGlite, dentro de Node): no hace falta instalar nada ni se toca Supabase.
 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

let ioc;
try { ioc = require('socket.io-client'); }
catch { ioc = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'socket.io-client')); }

const PORT = 3996, BASE = `http://localhost:${PORT}`, CAP = '10000000-aaaa-bbbb-cccc-000000000001';
const TMP = path.join(os.tmpdir(), `gg-op-${Date.now()}`);
const CRED = path.join(TMP, 'cred'), STORE = path.join(TMP, 'data', 'store.json');
const DB_DIR = path.join(TMP, 'pg');                  // base de datos de prueba (Postgres de laboratorio)
const DB_URL = 'pglite:' + DB_DIR;
const dormir = ms => new Promise(r => setTimeout(r, ms));

let ok = 0, fail = 0; const fallos = [];
const check = (n, c, e = '') => { if (c) { ok++; console.log(`  ✔ ${n}`); } else { fail++; fallos.push(n); console.log(`  ✘ ${n} ${e}`); } };
const seccion = t => console.log(`\n▶ ${t}`);

const hoyColombia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const horaColombia = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

function escribirStore(config) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify({
    config: { contador: 50, establecimiento: 'Prueba', volumen: 1, silencio: false, cajas_estado: { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' }, ...config },
    historial: []
  }));
}

function arrancar(envExtra = {}) {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), STORE_PATH: STORE, CREDENCIALES_DIR: CRED, GRACIA_MS: '500',
           DATABASE_URL: '', ...envExtra },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  p.log = ''; p.stdout.on('data', d => p.log += d); p.stderr.on('data', d => p.log += d);
  return p;
}
async function esperar() { for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/salud`)).ok) return true; } catch {} await dormir(250); } return false; }
async function parar(p) { if (!p || p.exitCode !== null) return; await new Promise(r => { p.on('exit', r); p.kill('SIGKILL'); setTimeout(r, 3000); }); await dormir(300); }
const estado = async () => (await fetch(`${BASE}/api/estado`)).json();
const login = (u, c) => fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: u, clave: c, captcha: CAP, consentimiento: true }) });

async function main() {
  fs.mkdirSync(CRED, { recursive: true });
  fs.writeFileSync(path.join(CRED, 'administradores.json'), JSON.stringify([
    { usuario: 'Ganaadmin', clave: 'ClavePrueba9x', nombre: 'Laura Martínez', rol: 'Administradora', principal: true }
  ]));
  let srv = null;

  try {
    // ───────────────────────────────────────────────────────────────────────
    seccion('A) Reinicio automático del contador cada mañana');
    escribirStore({ ultimo_reinicio: '2000-01-01', hora_reinicio: '00:00', reinicio_diario: true });
    srv = arrancar(); await esperar();
    let e = await estado();
    check('día nuevo y hora pasada → el contador vuelve a A00 al arrancar', e.contador === 0, `contador=${e.contador}`);
    check('queda registrada la fecha de hoy (hora de Colombia)', JSON.parse(fs.readFileSync(STORE, 'utf8')).config.ultimo_reinicio === hoyColombia());
    await parar(srv);

    escribirStore({ ultimo_reinicio: '2000-01-01', hora_reinicio: '00:00' });   // sin configurar nada
    srv = arrancar(); await esperar();
    check('POR DEFECTO el contador NO se reinicia al día siguiente (la numeración sigue: los turnos son de papel)', (await estado()).contador === 50);
    check('el panel lo muestra apagado por defecto', (await (await fetch(`${BASE}/api/config`)).json()).reinicioDiario === false);
    await parar(srv);

    escribirStore({ ultimo_reinicio: '2000-01-01', hora_reinicio: '00:00', reinicio_diario: false });
    srv = arrancar(); await esperar();
    check('con el reinicio diario DESACTIVADO no se toca el contador', (await estado()).contador === 50);
    await parar(srv);

    escribirStore({});   // datos de antes de esta función: sin fecha de último reinicio
    srv = arrancar(); await esperar();
    check('primera vez con la función: NO borra el contador de quien ya está trabajando', (await estado()).contador === 50);
    await parar(srv);

    if (horaColombia() !== '23:59') {
      escribirStore({ ultimo_reinicio: '2000-01-01', hora_reinicio: '23:59', reinicio_diario: true });
      srv = arrancar(); await esperar();
      check('antes de la hora configurada no se reinicia', (await estado()).contador === 50);
      await parar(srv);
    }

    escribirStore({ ultimo_reinicio: hoyColombia(), hora_reinicio: '00:00', reinicio_diario: true });
    srv = arrancar(); await esperar();
    check('si ya se reinició hoy, un reinicio del servidor a mediodía NO vuelve a A00', (await estado()).contador === 50);

    const lg = await login('Ganaadmin', 'ClavePrueba9x');
    const cookie = (lg.headers.get('set-cookie') || '').split(';')[0];
    const post = b => fetch(`${BASE}/api/config`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    check('hora de reinicio inválida (25:00) → 400', (await post({ horaReinicio: '25:00' })).status === 400);
    check('reinicio diario con valor raro ("si") → 400', (await post({ reinicioDiario: 'si' })).status === 400);
    const okCfg = await post({ reinicioDiario: true, horaReinicio: '05:45' });
    const cfg = await (await fetch(`${BASE}/api/config`)).json();
    check('cambiar la hora desde el panel se guarda (05:45)', okCfg.status === 200 && cfg.horaReinicio === '05:45' && cfg.reinicioDiario === true);
    check('/api/sistema sin sesión → 401', (await fetch(`${BASE}/api/sistema`)).status === 401);
    const sis = await (await fetch(`${BASE}/api/sistema`, { headers: { cookie } })).json();
    check('/api/sistema con sesión muestra hora de Colombia y reinicio diario', /^\d\d:\d\d$/.test(sis.horaColombia) && sis.horaReinicio === '05:45');
    const salud = await (await fetch(`${BASE}/api/salud`)).json();
    check('/api/salud responde (la usa Render para vigilar el servicio)', salud.ok === true);
    await parar(srv);

    // ───────────────────────────────────────────────────────────────────────
    seccion('B) Reinicio de Render con el disco borrado (datos en la base de datos)');
    const { PGlite } = require('@electric-sql/pglite');
    const envDb = { DATABASE_URL: DB_URL, RENDER: '1' };
    escribirStore({ contador: 0, ultimo_reinicio: hoyColombia() });
    srv = arrancar(envDb); await esperar();
    check('arranca usando la base de datos para turnos y contador', (await (await fetch(`${BASE}/api/salud`)).json()).turnos === 'postgres', srv.log.slice(-300));

    const s = ioc(BASE, { transports: ['websocket'], forceNew: true, reconnection: false });
    await new Promise(r => s.on('connect', r));
    await new Promise(r => s.emit('identificar', { tipo: 'caja', caja: 1, clientId: 'eq-op' }, r));
    for (let i = 0; i < 3; i++) { await dormir(450); await new Promise(r => s.emit('llamar_turno', { caja: 1 }, r)); }
    s.close();
    const lg2 = await login('Ganaadmin', 'ClavePrueba9x');
    const cookie2 = (lg2.headers.get('set-cookie') || '').split(';')[0];
    const nuevo = await fetch(`${BASE}/api/auth/admins`, { method: 'POST', headers: { cookie: cookie2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Andrés Rodríguez', usuario: 'andres.rod', clave: 'Clave2026', rol: 'Supervisor' }) });
    check('se llaman 3 turnos y se crea un administrador (control)', (await estado()).contador === 3 && nuevo.status === 200);
    await dormir(800);   // deja terminar la escritura en la base de datos

    // Render reinicia: proceso muerto de golpe + disco nuevo (sin store.json ni copias)
    await parar(srv);
    fs.rmSync(path.dirname(STORE), { recursive: true, force: true });
    check('(simulación) el disco quedó vacío como en un reinicio de Render', !fs.existsSync(STORE));
    srv = arrancar(envDb); await esperar();

    const e2 = await estado();
    check('tras el reinicio el contador SIGUE en A03 (no vuelve a A00 a mitad del día)', e2.contador === 3, `contador=${e2.contador}`);
    check('el historial de turnos se conserva', e2.ultimos.length === 3);
    check('el administrador creado desde el panel sigue existiendo y entra', (await login('andres.rod', 'Clave2026')).status === 200);
    const sigue = await fetch(`${BASE}/api/historial`, { headers: { cookie: cookie2 } });
    check('la sesión abierta antes del reinicio sigue válida (no hay que volver a entrar)', sigue.status === 200, `HTTP ${sigue.status}`);
    await parar(srv);

    // ───────────────────────────────────────────────────────────────────────
    seccion('C) Número que continúa al otro día y depuración de 7 días');
    const pg = new PGlite(DB_DIR); await pg.waitReady;
    const tablas = (await pg.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map(r => r.tablename);
    check('existen las tablas administradores, contador, turnos, configuracion y actividad',
      ['administradores', 'contador', 'turnos', 'configuracion', 'actividad'].every(x => tablas.includes(x)), tablas.join(','));
    const rls = (await pg.query("SELECT bool_and(relrowsecurity) AS ok FROM pg_class WHERE relname IN ('administradores','contador','turnos','configuracion','actividad')")).rows[0].ok;
    check('todas tienen seguridad por filas (RLS): la API pública de Supabase no puede leerlas', rls === true);
    check('la clave del administrador está cifrada en la tabla (nunca en texto plano)',
      (await pg.query("SELECT count(*)::int AS n FROM administradores WHERE clave_hash LIKE '%Clave2026%'")).rows[0].n === 0);

    // Turnos viejos (10 días) y una fila del contador que debe sobrevivir
    await pg.query("INSERT INTO turnos (id, turno, caja, llamado_en, llamado_texto) VALUES (9001, 5, 1, now() - interval '10 days', 'viejo'), (9002, 6, 2, now() - interval '8 days', 'viejo')");
    await pg.query("INSERT INTO turnos (id, turno, caja, llamado_en, llamado_texto) VALUES (9003, 7, 3, now() - interval '2 days', 'reciente')");
    const antes = (await pg.query('SELECT valor FROM contador WHERE id = 1')).rows[0].valor;
    await pg.close();

    // "Al otro día": el servidor arranca de nuevo (en un día nuevo, con el reinicio diario apagado por defecto)
    fs.rmSync(path.dirname(STORE), { recursive: true, force: true });
    srv = arrancar(envDb); await esperar();
    check('al otro día la numeración CONTINÚA (no vuelve a A00)', (await estado()).contador === antes && antes === 3, `contador=${(await estado()).contador}`);
    await dormir(500);
    await parar(srv);
    const pg2 = new PGlite(DB_DIR); await pg2.waitReady;
    const ids = (await pg2.query('SELECT id FROM turnos ORDER BY id')).rows.map(r => Number(r.id));
    check('los turnos de más de 7 días se depuraron solos', !ids.includes(9001) && !ids.includes(9002), ids.join(','));
    check('los turnos recientes se conservan', ids.includes(9003) && ids.length >= 4, ids.join(','));
    check('el contador NO se depura: sigue guardado', (await pg2.query('SELECT valor FROM contador WHERE id = 1')).rows[0].valor === 3);
    await pg2.close();

    // La base de datos no responde: el turnero arranca igual y NO pierde el número al volver
    srv = arrancar({ DATABASE_URL: 'postgresql://nadie:nada@127.0.0.1:1/nada', RENDER: '1' });
    check('si la base de datos no responde, el turnero arranca igual (usa el archivo)', await esperar() && (await (await fetch(`${BASE}/api/salud`)).json()).turnos === 'archivo');
    await parar(srv);
  } finally {
    await parar(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(` Operación diaria: ${ok} correctas, ${fail} fallidas`);
  if (fail) console.log(' Fallaron:\n  - ' + fallos.join('\n  - '));
  console.log(`══════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('Error en las pruebas:', e); process.exit(1); });
