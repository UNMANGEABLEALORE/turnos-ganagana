/**
 * pruebas.js — Pruebas automáticas (sin frameworks).   Uso:  node server/pruebas.js
 * Levanta el servidor en un puerto y archivo de datos TEMPORALES (no toca store.json).
 */
const { spawn } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const vm   = require('vm');

let ioc;
try { ioc = require('socket.io-client'); }
catch { ioc = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'socket.io-client')); }

const { formatTurno } = require('../utils/turno');
const ts = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'typescript'));
/** Compila un .ts del cliente y lo ejecuta aislado (así se prueba el código REAL del frontend). */
function cargarTS(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', rel), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} };
  vm.runInNewContext(out, { exports: m.exports, module: m, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  return m.exports;
}
const PORT  = 3999;
const BASE  = `http://localhost:${PORT}`;
const STORE = path.join(os.tmpdir(), `gg-prueba-${Date.now()}.json`);
const CRED  = path.join(os.tmpdir(), `gg-cred-${Date.now()}`);   // carpeta de credenciales temporal
const CLAVE_PRUEBA = 'ClavePrueba9x';
const CAPTCHA_PRUEBA = '10000000-aaaa-bbbb-cccc-000000000001';

let ok = 0, fail = 0;
const fallos = [];
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✔ ${nombre}`); }
  else { fail++; fallos.push(nombre); console.log(`  ✘ ${nombre} ${extra}`); }
}
const dormir = ms => new Promise(r => setTimeout(r, ms));
const seccion = t => console.log(`\n▶ ${t}`);

function conectar() {
  return new Promise((res, rej) => {
    const s = ioc(BASE, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.on('connect', () => res(s));
    s.on('connect_error', rej);
  });
}
const emitir = (s, ev, data) => new Promise(res => {
  const t = setTimeout(() => res({ ok: false, error: 'TIMEOUT sin respuesta' }), 3000);
  s.emit(ev, data, r => { clearTimeout(t); res(r); });
});
const ident = (s, caja, clientId) => emitir(s, 'identificar', { tipo: 'caja', caja, clientId });
const llamar = (s, caja) => emitir(s, 'llamar_turno', { caja });

async function main() {
  // ── 1. Formato de turnos ───────────────────────────────────────────────────
  seccion('Formato de turnos (letra + 2 dígitos)');
  const casos = [[0,'A00'],[5,'A05'],[22,'A22'],[99,'A99'],[100,'B00'],[199,'B99'],[200,'C00'],
                 [2500,'Z00'],[2599,'Z99'],[2600,'A00'],[2699,'A99'],[2700,'B00']];
  casos.forEach(([n, e]) => check(`servidor: ${n} → ${e}`, formatTurno(n) === e, `(dio ${formatTurno(n)})`));
  // Secuencia completa: cada letra tiene exactamente 100 turnos 00..99
  let secOk = true;
  for (let n = 0; n < 2600; n++) {
    const esperado = String.fromCharCode(65 + Math.floor(n / 100)) + String(n % 100).padStart(2, '0');
    if (formatTurno(n) !== esperado) { secOk = false; break; }
  }
  check('secuencia A00…Z99 completa (2600 turnos) sin saltos', secOk);
  check('valores inválidos → ---', ['---'].every(x => formatTurno(-1) === x && formatTurno('abc') === x && formatTurno(null) === x));

  // El mismo formato en el servidor y en el cliente React (TypeScript)
  const clienteFmt = cargarTS('models/formato.ts');
  let iguales = true;
  for (let n = 0; n <= 2700; n++) {
    const a = formatTurno(n), b = clienteFmt.formatTurno(n), c = a;
    if (a !== b || a !== c) { iguales = false; console.log('   difiere en', n, a, b, c); break; }
  }
  check('servidor y cliente React (TypeScript) dan el MISMO resultado (0–2700)', iguales);

  // ── 2. Voz ─────────────────────────────────────────────────────────────────
  seccion('Texto de la voz (clara, lenta y con apoyo para personas con dificultad auditiva)');
  const voz = cargarTS('controllers/voz.ts');

  const p22 = voz.partesVoz(22, 2);
  check('A22 caja 2 → letra con nombre y palabra de apoyo', p22[0] === 'Atención. Turno, letra a, de Ana.', p22[0]);
  check('A22 → número completo en palabras y dígito por dígito', p22[1] === 'Número veintidós. dos, dos.', p22[1]);
  check('A22 → caja dicha con palabra ("número dos")', p22[2] === 'Diríjase a la caja número dos.', p22[2]);
  check('A00 → "cero cero" / "cero, cero"', voz.partesVoz(0, 1)[1] === 'Número cero cero. cero, cero.', voz.partesVoz(0, 1)[1]);
  check('B05 → "be, de Bogotá" y "cero cinco"', voz.partesVoz(105, 3)[0].includes('letra be, de Bogotá') && voz.partesVoz(105, 3)[1].includes('cero cinco'));
  check('V (uve) y B (be) se distinguen por su palabra de apoyo', voz.partesVoz(2100, 1)[0].includes('Valentina') && voz.partesVoz(100, 1)[0].includes('Bogotá'));
  check('C31 → "treinta y uno"', voz.partesVoz(231, 4)[1].includes('treinta y uno'));
  check('Z99 → "zeta" y "noventa y nueve"', voz.partesVoz(2599, 1)[0].includes('zeta') && voz.partesVoz(2599, 1)[1].includes('noventa y nueve'));
  let vozOk = true;
  for (let n = 0; n < 2700; n++) for (const c of [1, 2, 3, 4]) {
    const tx = voz.textoVoz(n, c);
    if (!tx || /undefined|NaN/.test(tx)) vozOk = false;
  }
  check('toda combinación turno × caja produce frase válida (sin undefined/NaN)', vozOk);
  const vc = cargarTS('models/validaciones.ts');

  seccion('Validaciones lógicas del frontend (TypeScript)');
  check('caja 1–4 válidas, 0/5/"x" inválidas', [1,2,3,4].every(c => vc.validarCaja(c) === null) && vc.validarCaja(0) && vc.validarCaja(5) && vc.validarCaja('x'));
  check('volumen fuera de 0–1 se rechaza', vc.validarVolumen(1.5) !== null && vc.validarVolumen(-0.1) !== null && vc.validarVolumen(0.5) === null);
  check('contraseña débil/corta se rechaza', vc.validarClave('abc') !== null && vc.validarClave('soloLetrasAqui') !== null && vc.validarClave('Segura123') === null);
  check('usuario inválido se rechaza', vc.validarUsuario('a b') !== null && vc.validarUsuario('laura.mz') === null);
  check('correo inválido se rechaza', vc.validarCorreo('x@y') !== null && vc.validarCorreo('a@b.co') === null);
  check('nombres falsos/fantásticos se rechazan', ['Goku Son', 'Batman Wayne', 'Hada Madrina', 'aaa bbb', 'Juan', 'J0se Perez'].every(n => vc.validarNombreReal(n) !== null));
  check('nombres reales se aceptan', ['Juan David Porras', 'María González', 'Laura Martínez'].every(n => vc.validarNombreReal(n) === null));

  // ── 3. Servidor ────────────────────────────────────────────────────────────
  // Pre-cargar contador en 2598 para probar el cambio Z99 → A00 sin hacer 2600 llamadas
  fs.writeFileSync(STORE, JSON.stringify({
    config: { contador: 2598, establecimiento: 'Prueba', volumen: 1, silencio: false,
              cajas_estado: { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' } },
    historial: []
  }));
  // Credenciales de prueba en una carpeta temporal (igual que en uso real: fuera del código)
  fs.mkdirSync(CRED, { recursive: true });
  fs.writeFileSync(path.join(CRED, 'administradores.json'), JSON.stringify([
    { usuario: 'Ganaadmin', clave: CLAVE_PRUEBA, nombre: 'Laura Martínez', rol: 'Administradora de prueba', principal: true }
  ]));
  const srv = spawn(process.execPath, [process.env.SERVER_ENTRY || path.join(__dirname, '..', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), STORE_PATH: STORE, GRACIA_MS: '1500', NODE_ENV: 'test', CREDENCIALES_DIR: CRED },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 40; i++) { try { await fetch(`${BASE}/api/estado`); break; } catch { await dormir(250); } }
  const vivo = async () => { try { return (await fetch(`${BASE}/api/estado`)).ok; } catch { return false; } };

  try {
    seccion('Cambio de letra en el servidor (Z98 → Z99 → A00)');
    const c1 = await conectar();
    check('caja 1 se identifica', (await ident(c1, 1, 'equipo-A')).ok === true);
    const t1 = await llamar(c1, 1); await dormir(450);
    const t2 = await llamar(c1, 1); await dormir(450);
    const t3 = await llamar(c1, 1); await dormir(450);
    check('turno 2598 → Z98', t1.ok && formatTurno(t1.turno) === 'Z98', JSON.stringify(t1));
    check('turno 2599 → Z99', t2.ok && formatTurno(t2.turno) === 'Z99');
    check('turno 2600 → A00 (vuelve a empezar)', t3.ok && formatTurno(t3.turno) === 'A00');

    seccion('Rutas y vistas');
    const dsp = await fetch(`${BASE}/display`, { redirect: 'manual' });
    check('/display (acceso antiguo) redirige a /pantalla', dsp.status === 301 && dsp.headers.get('location') === '/pantalla');
    const raizHtml = await fetch(`${BASE}/pantalla`);
    check('/pantalla entrega la aplicación React', raizHtml.status === 200 && (await raizHtml.text()).includes('id="root"'));
    check('rutas de administración sin sesión → 401', (await fetch(`${BASE}/api/historial`)).status === 401 && (await fetch(`${BASE}/api/presencia`)).status === 401);
    const hdr = (await fetch(`${BASE}/api/estado`)).headers;
    check('cabeceras de seguridad presentes (CSP, nosniff, X-Frame-Options)', !!hdr.get('content-security-policy') && hdr.get('x-content-type-options') === 'nosniff' && !!hdr.get('x-frame-options'));

    seccion('Credenciales fuera del código');
    const malo = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'Ganaadmin', clave: 'Gana123', captcha: CAPTCHA_PRUEBA, consentimiento: true }) });
    check('la antigua contraseña por defecto ya NO funciona', malo.status === 401);
    const bueno = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'Ganaadmin', clave: CLAVE_PRUEBA, captcha: CAPTCHA_PRUEBA, consentimiento: true }) });
    check('el administrador definido en credenciales/administradores.json sí entra', bueno.status === 200);
    const sa = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'JUAN-PORRAS', clave: 'Seapto123', captcha: CAPTCHA_PRUEBA, consentimiento: true }) });
    const saJ = await sa.json();
    check('el super administrador JUAN-PORRAS existe siempre y entra', sa.status === 200 && saJ.admin.principal === true && saJ.admin.rol === 'Super Administrador', JSON.stringify(saJ));
    const saMal = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'JUAN-PORRAS', clave: 'otra-clave', captcha: CAPTCHA_PRUEBA, consentimiento: true }) });
    check('JUAN-PORRAS con contraseña incorrecta → 401', saMal.status === 401);
    const cookieA = (bueno.headers.get('set-cookie') || '').split(';')[0];
    const cj = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie: cookieA } })).json();
    check('la sesión usa el nombre real del archivo (bienvenida personalizada)', cj.admin && cj.admin.nombre === 'Laura Martínez', JSON.stringify(cj));
    check('existe el archivo de clave de sesión en la carpeta de credenciales', fs.existsSync(path.join(CRED, 'sesion.secret')));
    const store = fs.readFileSync(STORE, 'utf8');
    check('la contraseña NO está en texto plano en el almacén de datos', !store.includes(CLAVE_PRUEBA));

    seccion('Validación lógica en el servidor (configuración)');
    const post = (body) => fetch(`${BASE}/api/config`, { method: 'POST', headers: { cookie: cookieA, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    check('volumen 5 → 400', (await post({ volumen: 5 })).status === 400);
    check('volumen "alto" → 400', (await post({ volumen: 'alto' })).status === 400);
    check('establecimiento con <script> → 400', (await post({ establecimiento: '<script>' })).status === 400);
    check('silencio "si" → 400', (await post({ silencio: 'si' })).status === 400);
    check('configuración válida → 200', (await post({ establecimiento: 'GanaGana Centro', volumen: 0.9, silencio: false })).status === 200);

    seccion('Exclusividad de caja (una sola persona por caja)');
    const c2 = await conectar();
    const r2 = await ident(c2, 1, 'equipo-B');
    check('otra cajera NO puede entrar a la caja 1 ocupada', r2.ok === false && /ya está siendo usada/.test(r2.error), JSON.stringify(r2));
    const r2b = await llamar(c2, 1);
    check('esa otra persona tampoco puede llamar turnos en caja 1', r2b.ok === false, JSON.stringify(r2b));
    const c3 = await conectar();
    check('una conexión sin identificarse no puede llamar turnos', (await llamar(c3, 2)).ok === false);
    check('la dueña de caja 1 NO puede llamar turnos en caja 2', (await llamar(c1, 2)).ok === false);
    const c4 = await conectar();
    check('otra cajera SÍ puede entrar a la caja 2 (libre)', (await ident(c4, 2, 'equipo-C')).ok === true);
    check('caja 2 llama turno correctamente', (await llamar(c4, 2)).ok === true);

    seccion('Recarga de página / reconexión de la misma cajera');
    let desplazada = false; c1.on('caja_desplazada', () => desplazada = true);
    const c1b = await conectar();
    check('mismo equipo (recarga) recupera su caja', (await ident(c1b, 1, 'equipo-A')).ok === true);
    await dormir(200);
    check('la sesión vieja recibe aviso "caja_desplazada"', desplazada);
    await dormir(450);
    check('la sesión vieja ya no puede llamar turnos', (await llamar(c1, 1)).ok === false);
    check('la sesión nueva sí puede', (await llamar(c1b, 1)).ok === true);

    seccion('Reserva tras desconexión (evita que "cuelen" a la caja)');
    c1b.close(); await dormir(300);
    const r5 = await ident(c2, 1, 'equipo-B');
    check('otra persona queda en espera unos segundos tras la desconexión', r5.ok === false && /se acaba de liberar/.test(r5.error), JSON.stringify(r5));
    await dormir(1700);
    check('pasado el tiempo de reserva, la caja queda libre para otra persona', (await ident(c2, 1, 'equipo-B')).ok === true);

    seccion('Liberación por el administrador (autenticación)');
    const sin = await fetch(`${BASE}/api/caja/1/liberar`, { method: 'POST' });
    check('liberar sin sesión de admin → 401', sin.status === 401);
    const lg = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'Ganaadmin', clave: CLAVE_PRUEBA, captcha: CAPTCHA_PRUEBA, consentimiento: true })
    });
    if (lg.status === 200) {
      const cookie = lg.headers.get('set-cookie').split(';')[0];
      let expulsada = false; c2.on('caja_desplazada', () => expulsada = true);
      const lib = await fetch(`${BASE}/api/caja/1/liberar`, { method: 'POST', headers: { cookie } });
      check('admin libera la caja → 200', lib.status === 200);
      await dormir(200);
      check('la persona que la usaba recibe el aviso de expulsión', expulsada);
      const c5 = await conectar();
      check('después de liberar, otra persona puede entrar', (await ident(c5, 1, 'equipo-D')).ok === true);
      c5.close();
    } else {
      check('login de admin para la prueba (requiere internet para hCaptcha)', false, `status ${lg.status}`);
    }

    seccion('Entradas inválidas / maliciosas (el servidor no debe caerse)');
    const x = await conectar();
    check('identificar sin datos → error controlado', (await emitir(x, 'identificar', undefined)).ok === false);
    check('identificar con caja 9 → error', (await ident(x, 9, 'z')).ok === false);
    check('identificar sin clientId → error', (await ident(x, 3, '')).ok === false);
    check('identificar tipo raro → error', (await emitir(x, 'identificar', { tipo: 'root' })).ok === false);
    check('identificar admin sin sesión → error', (await emitir(x, 'identificar', { tipo: 'admin' })).ok === false);
    check('llamar_turno sin payload → error', (await emitir(x, 'llamar_turno', null)).ok === false);
    check('llamar_turno caja "abc" → error', (await emitir(x, 'llamar_turno', { caja: 'abc' })).ok === false);
    x.emit('identificar'); x.emit('llamar_turno'); x.emit('heartbeat', { raro: 1 });   // sin callback
    await dormir(300);
    check('el servidor sigue vivo tras los datos inválidos', await vivo());
    x.close();

    seccion('Caja desactivada y llamados rápidos');
    const lg2 = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'Ganaadmin', clave: CLAVE_PRUEBA, captcha: CAPTCHA_PRUEBA, consentimiento: true })
    });
    if (lg2.status === 200) {
      const cookie = lg2.headers.get('set-cookie').split(';')[0];
      await fetch(`${BASE}/api/caja/2/estado`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'inactiva' }) });
      await dormir(450);
      const rr = await llamar(c4, 2);
      check('caja desactivada por el admin no puede llamar', rr.ok === false && /desactivada/.test(rr.error), JSON.stringify(rr));
      await fetch(`${BASE}/api/caja/2/estado`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'activa' }) });
    }
    await dormir(450);
    const [a, b] = await Promise.all([llamar(c4, 2), llamar(c4, 2)]);
    check('dos llamados simultáneos del mismo equipo: solo uno pasa (anti-rebote)', [a, b].filter(r => r.ok).length === 1, JSON.stringify([a, b]));

    seccion('Numeración consecutiva sin repetidos con 2 cajas llamando a la vez');
    await dormir(500);
    const nums = [];
    for (let i = 0; i < 5; i++) {
      const [ra, rb] = await Promise.all([llamar(c1, 1).then(r => r.ok ? r : llamar(c2, 1)), llamar(c4, 2)]);
      [ra, rb].forEach(r => r.ok && nums.push(r.turno));
      await dormir(450);
    }
    check('ningún turno repetido', new Set(nums).size === nums.length, JSON.stringify(nums));
    const ord = [...nums].sort((p, q) => p - q);
    check('turnos consecutivos', ord.every((v, i) => i === 0 || v === ord[i - 1] + 1), JSON.stringify(ord));

    [c1, c2, c3, c4].forEach(s => s.close());
    check('el servidor sigue vivo al final', await vivo());
    check('sin excepciones no controladas en el log del servidor', !/Uncaught|TypeError|ReferenceError|UnhandledPromise/.test(log), log.slice(-400));
  } finally {
    srv.kill();
    try { fs.unlinkSync(STORE); } catch {}
    try { fs.rmSync(CRED, { recursive: true, force: true }); } catch {}
  }

  seccion('Estructura MVC');
  const base = path.join(__dirname, '..');
  const cli  = path.join(__dirname, '..', '..', 'client', 'src');
  const carpetas = ['models', 'controllers', 'routes', 'middlewares', 'services', 'utils', 'config'].map(d => path.join(base, d))
    .concat(['models', 'controllers', 'views'].map(d => path.join(cli, d)));
  check('servidor: models, controllers, routes, middlewares, services, utils y config existen', carpetas.slice(0, 7).every(d => fs.existsSync(d)));
  check('cliente: models, controllers y views existen', carpetas.slice(7).every(d => fs.existsSync(d)));
  const sobrantes = ['index.js.nuevo', '_index_old.js', 'auth.js', 'db.js', 'security.js', 'credenciales.js', 'turno.js', 'pruebas.js'].filter(f => fs.existsSync(path.join(base, f)));
  check('no quedan archivos sueltos de la estructura antigua en server/', sobrantes.length === 0, sobrantes.join(', '));
  const viejosCli = ['pages', 'hooks', 'utils', 'styles', 'components', 'types.ts', 'socket.ts', 'main.tsx.nuevo'].filter(f => fs.existsSync(path.join(cli, f)));
  check('no quedan carpetas antiguas en client/src', viejosCli.length === 0, viejosCli.join(', '));
  check('la pantalla HTML duplicada (display/) ya no existe', !fs.existsSync(path.join(__dirname, '..', '..', 'display')));
  const ctrl = fs.readdirSync(path.join(base, 'controllers')).filter(f => f.endsWith('.js'));
  const accesoDatos = ctrl.filter(f => /store\.datos|require\('\.\.\/models\/store'\)/.test(fs.readFileSync(path.join(base, 'controllers', f), 'utf8')));
  check('los controladores no tocan el almacén directamente (solo por los modelos)', accesoDatos.length === 0, accesoDatos.join(', '));

  seccion('Revisión estática: sin credenciales en el código');
  const raiz = path.join(__dirname, '..', '..');
  const archivos = [];
  (function recorrer(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git', 'credenciales', 'data'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.(js|jsx|ts|tsx|html|json|yaml)$/.test(e.name) && !/pruebas\.js$|package-lock|store\.json/.test(e.name)) archivos.push(p);
    }
  })(raiz);
  const conClaves = archivos.filter(p => /Gana123|Turno2024|Gana456/.test(fs.readFileSync(p, 'utf8')));
  check('ninguna contraseña antigua escrita en el código', conClaves.length === 0, conClaves.join(', '));
  const gi = fs.readFileSync(path.join(raiz, '.gitignore'), 'utf8');
  check('.gitignore excluye credenciales/.env y administradores.json', gi.includes('credenciales/.env') && gi.includes('credenciales/administradores.json') && gi.includes('credenciales/sesion.secret'));
  check('existen las plantillas ejemplo.env y ejemplo.administradores.json', fs.existsSync(path.join(raiz, 'credenciales', 'ejemplo.env')) && fs.existsSync(path.join(raiz, 'credenciales', 'ejemplo.administradores.json')));
  const claveGen = require('../config/credenciales').claveAleatoria();
  check('las contraseñas aleatorias generadas cumplen la política', vc.validarClave(claveGen) === null && claveGen.length >= 16);

  console.log(`\n══════════════════════════════════════`);
  console.log(` Resultado: ${ok} correctas, ${fail} fallidas`);
  if (fail) console.log(' Fallaron:\n  - ' + fallos.join('\n  - '));
  console.log(`══════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('Error en las pruebas:', e); process.exit(1); });
