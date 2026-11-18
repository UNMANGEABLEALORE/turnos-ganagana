/**
 * operacion.js — Pruebas de la operación diaria en Render.   Uso:  node server/tests/operacion.js
 *   A) Reinicio automático del contador a A00 cada mañana (hora de Colombia).
 *   B) Reinicio de Render con el disco BORRADO: turnos, contador, administradores y sesiones deben sobrevivir (MySQL).
 *      Usa el MySQL local de XAMPP con una base de datos de prueba que se crea y se borra; no toca tus datos.
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

let ioc;
try { ioc = require('socket.io-client'); }
catch { ioc = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'socket.io-client')); }

const PORT = 3996, BASE = `http://localhost:${PORT}`, CAP = '10000000-aaaa-bbbb-cccc-000000000001';
const TMP = path.join(os.tmpdir(), `gg-op-${Date.now()}`);
const CRED = path.join(TMP, 'cred'), STORE = path.join(TMP, 'data', 'store.json');
const MYSQL_CLI = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const DB_PRUEBA = `turnos_prueba_${Date.now()}`;
const MYSQL_PUERTO = process.env.MYSQL_PRUEBA_PUERTO || '3306';   // otro puerto = MySQL de prueba aparte
const cli = (...args) => ['-h', '127.0.0.1', '-P', MYSQL_PUERTO, '-u', 'root', ...args];
const dormir = ms => new Promise(r => setTimeout(r, ms));

let ok = 0, fail = 0, omitidas = 0; const fallos = [];
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
           MYSQL_HOST: '', MYSQL_USER: '', MYSQL_DATABASE: '', ...envExtra },
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
    seccion('B) Reinicio de Render con el disco borrado (datos en MySQL)');
    let hayMysql = false;
    try { execFileSync(MYSQL_CLI, cli('-e', `CREATE DATABASE ${DB_PRUEBA} CHARACTER SET utf8mb4`), { stdio: 'ignore' }); hayMysql = true; }
    catch { console.log('  (omitido: no hay MySQL local de XAMPP encendido)'); omitidas++; }

    if (hayMysql) {
      const envMysql = { MYSQL_HOST: '127.0.0.1', MYSQL_PORT: MYSQL_PUERTO, MYSQL_USER: 'root', MYSQL_PASSWORD: '', MYSQL_DATABASE: DB_PRUEBA, RENDER: '1' };
      escribirStore({ contador: 0, ultimo_reinicio: hoyColombia() });
      srv = arrancar(envMysql); await esperar();
      check('arranca usando MySQL para los turnos', (await (await fetch(`${BASE}/api/salud`)).json()).turnos === 'mysql', srv.log.slice(-300));

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
      await dormir(800);   // deja terminar la escritura en MySQL

      // Render reinicia: proceso muerto de golpe + disco nuevo (sin store.json ni copias)
      await parar(srv);
      fs.rmSync(path.dirname(STORE), { recursive: true, force: true });
      check('(simulación) el disco quedó vacío como en un reinicio de Render', !fs.existsSync(STORE));
      srv = arrancar(envMysql); await esperar();

      const e2 = await estado();
      check('tras el reinicio el contador SIGUE en A03 (no vuelve a A00 a mitad del día)', e2.contador === 3, `contador=${e2.contador}`);
      check('el historial de turnos se conserva', e2.ultimos.length === 3);
      const lg3 = await login('andres.rod', 'Clave2026');
      check('el administrador creado desde el panel sigue existiendo y entra', lg3.status === 200);
      const sigue = await fetch(`${BASE}/api/historial`, { headers: { cookie: cookie2 } });
      check('la sesión abierta antes del reinicio sigue válida (no hay que volver a entrar)', sigue.status === 200, `HTTP ${sigue.status}`);
      const filas = execFileSync(MYSQL_CLI, cli('-N', '-e', `SELECT COUNT(*) FROM ${DB_PRUEBA}.almacen; SELECT COUNT(*) FROM ${DB_PRUEBA}.administradores`), { encoding: 'utf8' }).trim().split(/\s+/);
      check('en MySQL existen las tablas almacen (turnos) y administradores', filas[0] === '1' && Number(filas[1]) >= 2, filas.join(','));

      // MySQL cae a mitad del día: el turnero NO se detiene
      await parar(srv);
      srv = arrancar({ ...envMysql, MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3398' });   // puerto donde no hay nada
      const vivo = await esperar();
      check('si la base de datos no responde, el turnero arranca igual (usa el archivo)', vivo && (await (await fetch(`${BASE}/api/salud`)).json()).turnos === 'archivo');
      await parar(srv);
    }
  } finally {
    await parar(srv);
    try { execFileSync(MYSQL_CLI, cli('-e', `DROP DATABASE IF EXISTS ${DB_PRUEBA}`), { stdio: 'ignore' }); } catch {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(` Operación diaria: ${ok} correctas, ${fail} fallidas${omitidas ? `, ${omitidas} sección omitida` : ''}`);
  if (fail) console.log(' Fallaron:\n  - ' + fallos.join('\n  - '));
  console.log(`══════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('Error en las pruebas:', e); process.exit(1); });
