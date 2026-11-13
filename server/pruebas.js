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
catch { ioc = require(path.join(__dirname, '..', 'client', 'node_modules', 'socket.io-client')); }

const { formatTurno } = require('./turno');
const PORT  = 3999;
const BASE  = `http://localhost:${PORT}`;
const STORE = path.join(os.tmpdir(), `gg-prueba-${Date.now()}.json`);

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

  // El mismo formato en cliente React y en la pantalla HTML estática
  const cliente = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'utils', 'formato.js'), 'utf8')
    .replace('export function', 'function');
  const ctxC = vm.createContext({}); vm.runInContext(cliente, ctxC);
  const html = fs.readFileSync(path.join(__dirname, '..', 'display', 'index.html'), 'utf8');
  const fmtHtml = html.match(/function fmt\(n\) \{[\s\S]*?\n\}/)[0];
  const ctxH = vm.createContext({}); vm.runInContext(fmtHtml, ctxH);
  let iguales = true;
  for (let n = 0; n <= 2700; n++) {
    const a = formatTurno(n), b = ctxC.formatTurno(n), c = ctxH.fmt(n);
    if (a !== b || a !== c) { iguales = false; console.log('   difiere en', n, a, b, c); break; }
  }
  check('servidor, cliente React y display HTML dan el MISMO resultado (0–2700)', iguales);

  // ── 2. Voz ─────────────────────────────────────────────────────────────────
  seccion('Texto de la voz');
  const vozSrc = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'utils', 'voz.js'), 'utf8');
  const parte = vozSrc.slice(vozSrc.indexOf('const NOMBRE_LETRA'), vozSrc.indexOf('let vozElegida'))
    .replace(/export function/g, 'function');
  const ctxV = vm.createContext({}); vm.runInContext(parte, ctxV);
  const htmlVoz = html.slice(html.indexOf('const NOMBRE_LETRA'), html.indexOf('let vozES'));
  const ctxVH = vm.createContext({}); vm.runInContext(htmlVoz, ctxVH);

  check('A22 caja 2 → "Turno a, veintidós. Diríjase a la caja número 2."',
    ctxV.textoVoz(22, 2) === 'Turno a, veintidós. Diríjase a la caja número 2.', ctxV.textoVoz(22, 2));
  check('A00 caja 1 → "cero cero"', ctxV.textoVoz(0, 1) === 'Turno a, cero cero. Diríjase a la caja número 1.');
  check('B05 caja 3 → "be, cero cinco"', ctxV.textoVoz(105, 3) === 'Turno be, cero cinco. Diríjase a la caja número 3.');
  check('C31 → "ce, treinta y uno"', ctxV.textoVoz(231, 4).includes('ce, treinta y uno'));
  check('Z99 → "zeta, noventa y nueve"', ctxV.textoVoz(2599, 1).includes('zeta, noventa y nueve'));
  let vozOk = true, mismas = true;
  for (let n = 0; n < 2700; n++) for (const c of [1,2,3,4]) {
    const t = ctxV.textoVoz(n, c);
    if (!t || /undefined|NaN/.test(t)) vozOk = false;
    if (t !== ctxVH.textoVoz(n, c)) mismas = false;
  }
  check('toda combinación turno × caja produce frase válida (sin undefined/NaN)', vozOk);
  check('voz del cliente React y de la pantalla HTML dicen exactamente lo mismo', mismas);

  // ── 3. Servidor ────────────────────────────────────────────────────────────
  // Pre-cargar contador en 2598 para probar el cambio Z99 → A00 sin hacer 2600 llamadas
  fs.writeFileSync(STORE, JSON.stringify({
    config: { contador: 2598, establecimiento: 'Prueba', volumen: 1, silencio: false,
              cajas_estado: { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' } },
    historial: []
  }));
  const srv = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), STORE_PATH: STORE, GRACIA_MS: '1500', NODE_ENV: 'test' },
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
      body: JSON.stringify({ usuario: 'Ganaadmin', clave: 'Gana123', captcha: '10000000-aaaa-bbbb-cccc-000000000001', consentimiento: true })
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
      body: JSON.stringify({ usuario: 'Ganaadmin', clave: 'Gana123', captcha: '10000000-aaaa-bbbb-cccc-000000000001', consentimiento: true })
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
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(` Resultado: ${ok} correctas, ${fail} fallidas`);
  if (fail) console.log(' Fallaron:\n  - ' + fallos.join('\n  - '));
  console.log(`══════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('Error en las pruebas:', e); process.exit(1); });
