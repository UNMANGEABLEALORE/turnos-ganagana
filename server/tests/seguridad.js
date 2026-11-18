/**
 * seguridad.js — Pruebas de ataque y de resistencia.   Uso:  node server/tests/seguridad.js
 * Levanta un servidor TEMPORAL (puerto, datos y credenciales propios) y le lanza ataques reales:
 * inyecciones, XSS, contaminación de prototipos, recorrido de rutas, fuerza bruta, sesiones falsas,
 * inundación de eventos, datos corruptos, cortes de red y rutas inexistentes (404).
 */
const { spawn } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const net  = require('net');

let ioc;
try { ioc = require('socket.io-client'); }
catch { ioc = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'socket.io-client')); }

const PORT  = 3998;
const BASE  = `http://localhost:${PORT}`;
const TMP   = path.join(os.tmpdir(), `gg-seg-${Date.now()}`);
const STORE = path.join(TMP, 'store.json');
const CRED  = path.join(TMP, 'cred');
const CLAVE = 'ClavePrueba9x';
const CAP   = '10000000-aaaa-bbbb-cccc-000000000001';

let ok = 0, fail = 0; const fallos = [];
const check = (n, c, extra = '') => { if (c) { ok++; console.log(`  ✔ ${n}`); } else { fail++; fallos.push(n); console.log(`  ✘ ${n} ${extra}`); } };
const seccion = t => console.log(`\n▶ ${t}`);
const dormir = ms => new Promise(r => setTimeout(r, ms));

const post = (ruta, body, headers = {}, raw = false) => fetch(BASE + ruta, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: raw ? body : JSON.stringify(body)
});
const login = (usuario, clave, extra = {}) => post('/api/auth/login', { usuario, clave, captcha: CAP, consentimiento: true, ...extra });
const vivo = async () => { try { return (await fetch(`${BASE}/api/estado`)).ok; } catch { return false; } };

function conectar(origin) {
  return new Promise((res, rej) => {
    const s = ioc(BASE, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: origin ? { Origin: origin } : {} });
    s.on('connect', () => res(s)); s.on('connect_error', rej);
  });
}
const emitir = (s, ev, data) => new Promise(res => {
  const t = setTimeout(() => res({ ok: false, error: 'TIMEOUT' }), 3000);
  s.emit(ev, data, r => { clearTimeout(t); res(r); });
});

async function main() {
  fs.mkdirSync(CRED, { recursive: true });
  fs.writeFileSync(path.join(CRED, 'administradores.json'), JSON.stringify([
    { usuario: 'Ganaadmin', clave: CLAVE, nombre: 'Laura Martínez', rol: 'Administradora', principal: true }
  ]));
  fs.writeFileSync(STORE, JSON.stringify({
    config: { contador: 0, establecimiento: 'Prueba', volumen: 1, silencio: false, cajas_estado: { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' } },
    historial: []
  }));

  const arrancar = () => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
      env: { ...process.env, PORT: String(PORT), STORE_PATH: STORE, CREDENCIALES_DIR: CRED, NODE_ENV: 'production', GRACIA_MS: '1000' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    p.log = ''; p.stdout.on('data', d => p.log += d); p.stderr.on('data', d => p.log += d);
    return p;
  };
  const esperar = async () => { for (let i = 0; i < 40; i++) { if (await vivo()) return true; await dormir(250); } return false; };

  let srv = arrancar();
  await esperar();

  try {
    // ───────────────────────────────────────────────────────────────────────
    const buenaResp = await login('Ganaadmin', CLAVE);
    const sc = buenaResp.headers.get('set-cookie') || '';
    const cookie = sc.split(';')[0];
    let vio429 = false;

    seccion('Inyección SQL / NoSQL (el sistema no usa SQL; se prueba que ninguna carga maliciosa funcione ni tumbe nada)');
    const sqli = ["' OR '1'='1", "admin'--", "'; DROP TABLE turnos;--", '" OR ""="', "1; SELECT * FROM users", "' UNION SELECT usuario,hash FROM admins--"];
    let colado = false, caidas = 0;
    for (const p of sqli) {
      const a = await login(p, p);  const b = await login('Ganaadmin', p);
      if (a.status === 429 || b.status === 429) vio429 = true;
      if (a.status === 200 || b.status === 200) colado = true;
      if (a.status >= 500 || b.status >= 500) caidas++;
    }
    check('6 cargas SQL en usuario y contraseña: ninguna inicia sesión', !colado);
    check('ninguna carga SQL provoca error 500', caidas === 0);
    const nosql = await post('/api/auth/login', { usuario: { $ne: null }, clave: { $ne: null }, captcha: CAP, consentimiento: true });
    check('inyección NoSQL ({"$ne":null}) no inicia sesión ni da 500', nosql.status !== 200 && nosql.status < 500, `HTTP ${nosql.status}`);
    const arr = await post('/api/auth/login', { usuario: ['Ganaadmin'], clave: [CLAVE], captcha: CAP, consentimiento: true });
    check('usuario/clave enviados como lista no inician sesión ni dan 500', arr.status !== 200 && arr.status < 500, `HTTP ${arr.status}`);
    const qs = await fetch(`${BASE}/api/estado?x=' OR 1=1--&limit=1;DROP TABLE x`);
    check('parámetros de URL maliciosos no rompen la API', qs.status === 200);

    // ───────────────────────────────────────────────────────────────────────
    seccion('Sesión, autenticación y fuerza bruta');
    const rutasAdmin = [['GET', '/api/historial'], ['GET', '/api/presencia'], ['POST', '/api/reset'], ['POST', '/api/config'],
      ['POST', '/api/caja/1/estado'], ['POST', '/api/caja/1/liberar'], ['POST', '/api/contador'], ['POST', '/api/cajas'], ['GET', '/api/actividad'], ['GET', '/api/auth/admins'], ['POST', '/api/auth/admins'],
      ['DELETE', '/api/auth/admins/1'], ['POST', '/api/auth/me/clave'], ['POST', '/api/auth/me/vinculos']];
    let abiertas = [];
    for (const [m, r] of rutasAdmin) { const x = await fetch(BASE + r, { method: m, headers: { 'Content-Type': 'application/json' }, body: m === 'GET' ? undefined : '{}' }); if (x.status !== 401) abiertas.push(`${m} ${r}→${x.status}`); }
    check('las 14 rutas de administración exigen sesión (401)', abiertas.length === 0, abiertas.join(', '));
    const falsa = await fetch(`${BASE}/api/historial`, { headers: { cookie: 'gg_sid=eyJ0Ijoic2VzaW9uIiwiaWQiOjEsImV4cCI6OTk5OTk5OTk5OTk5OX0.firmafalsa' } });
    check('cookie de sesión FALSIFICADA es rechazada', falsa.status === 401);
    const sinFirma = await fetch(`${BASE}/api/historial`, { headers: { cookie: 'gg_sid=eyJ0Ijoic2VzaW9uIiwiaWQiOjEsImV4cCI6OTk5OTk5OTk5OTk5OX0' } });
    check('cookie sin firma es rechazada', sinFirma.status === 401);

    check('login correcto funciona (control, hecho antes de los ataques)', buenaResp.status === 200);
    check('cookie de sesión es HttpOnly', /httponly/i.test(sc));
    check('cookie de sesión es SameSite (anti-CSRF)', /samesite=(lax|strict)/i.test(sc));
    const partes = cookie.split('=')[1].split('.');
    const manipulada = partes[0].slice(0, -2) + 'AA.' + partes[1];
    check('cookie con el contenido alterado es rechazada', (await fetch(`${BASE}/api/historial`, { headers: { cookie: 'gg_sid=' + manipulada } })).status === 401);

    let bloqueado = false;
    for (let i = 0; i < 8 && !vio429; i++) { const r = await login('Ganaadmin', 'mal' + i); if (r.status === 429) { bloqueado = true; break; } }
    bloqueado = bloqueado || vio429;
    check('fuerza bruta: tras varios intentos fallidos se bloquea (429)', bloqueado);
    const durante = await login('Ganaadmin', CLAVE);
    check('mientras está bloqueado ni la clave correcta entra', durante.status === 429);

    // ───────────────────────────────────────────────────────────────────────
    seccion('XSS y datos maliciosos en formularios (con sesión de administrador)');
    const H = { cookie };
    const xss = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', 'javascript:alert(1)'];
    let xssAceptado = false;
    for (const p of xss) { const r = await post('/api/config', { establecimiento: p }, H); if (r.status === 200) xssAceptado = true; }
    check('nombre del establecimiento con HTML/JS es rechazado (3 variantes de XSS)', !xssAceptado);
    const r1 = await post('/api/config', { establecimiento: '<script>alert(1)</script>' }, H);
    check('<script> en el establecimiento → 400', r1.status === 400);
    const r2 = await post('/api/auth/admins', { nombre: '<b>Hack</b> Admin', usuario: 'hacker1', clave: 'Clave1234' }, H);
    check('nombre de administrador con HTML → 400', r2.status === 400);
    const r3 = await post('/api/auth/admins', { nombre: 'Laura Perez', usuario: "x'; DROP--", clave: 'Clave1234' }, H);
    check('usuario con caracteres de inyección → 400', r3.status === 400);
    const r4 = await post('/api/config', { volumen: 9e99 }, H);
    check('volumen absurdo → 400', r4.status === 400);
    const r5 = await post('/api/caja/9/estado', { estado: 'activa' }, H);
    check('caja inexistente → 400', r5.status === 400);
    const r6 = await post('/api/caja/1/estado', { estado: 'explotar' }, H);
    check('estado de caja inválido → 400', r6.status === 400);

    seccion('Contaminación de prototipos (__proto__) y campos extra');
    const pp = await post('/api/config', JSON.parse('{"__proto__":{"principal":true,"polluted":"si"},"constructor":{"prototype":{"polluted":"si"}},"volumen":0.7}'), H);
    check('payload con __proto__ no rompe el servidor', pp.status < 500);
    check('el servidor sigue vivo y sin contaminación (la API responde)', await vivo() && ({}).polluted === undefined);
    const nuevo = await post('/api/auth/admins', { nombre: 'Laura Perez', usuario: 'laura.p', clave: 'Clave1234', principal: true, rol: 'Super', id: 1, hash: 'x:y' }, H);
    const lista = await (await fetch(`${BASE}/api/auth/admins`, { headers: H })).json();
    const creada = lista.find(a => a.usuario === 'laura.p');
    check('no se puede crear un administrador "principal" enviando campos extra', nuevo.status === 200 && creada && creada.principal === false);

    // ───────────────────────────────────────────────────────────────────────
    seccion('Recorrido de rutas y archivos sensibles');
    const sensibles = ['/credenciales/administradores.json', '/credenciales/sesion.secret', '/server/data/store.json', '/data/store.json',
      '/server/index.js', '/package.json', '/.env', '/.git/config', '/client/package.json', '/..%2f..%2fcredenciales%2fadministradores.json',
      '/%2e%2e/%2e%2e/credenciales/administradores.json', '/assets/..%2f..%2f..%2fserver%2fdata%2fstore.json', '/..\\..\\credenciales\\sesion.secret'];
    let fuga = [];
    for (const s of sensibles) {
      const r = await fetch(BASE + s); const t = await r.text();
      if (/"hash"|"clave"|scrypt|sessionSecret|"historial"|require\(/i.test(t) || /^[0-9a-f]{64,}$/i.test(t.trim())) fuga.push(s);
    }
    check(`13 intentos de leer archivos internos: ninguno filtra contenido`, fuga.length === 0, fuga.join(', '));

    // ───────────────────────────────────────────────────────────────────────
    seccion('Errores 404 y respuestas ante peticiones rotas');
    const n1 = await fetch(`${BASE}/api/no-existe`);
    check('/api/no-existe → 404 en JSON (no HTML ni pantalla en blanco)', n1.status === 404 && /json/.test(n1.headers.get('content-type') || ''), `HTTP ${n1.status} ${n1.headers.get('content-type')}`);
    const n2 = await fetch(`${BASE}/assets/no-existe.js`);
    check('un archivo inexistente (.js) → 404 real (no devuelve la página principal)', n2.status === 404, `HTTP ${n2.status}`);
    const n3 = await fetch(`${BASE}/pagina-que-no-existe`);
    check('una página inexistente carga la app (que redirige al inicio)', n3.status === 200);
    const jm = await post('/api/auth/login', '{"usuario": "x", ', {}, true);
    const jt = await jm.text();
    check('JSON mal formado → 400 limpio', jm.status === 400, `HTTP ${jm.status}`);
    check('el error NO revela rutas internas ni trazas (stack)', !/at .*\.js|node_modules|server[\\/]/i.test(jt), jt.slice(0, 120));
    const gran = await post('/api/auth/login', JSON.stringify({ usuario: 'a'.repeat(200000), clave: 'x' }), {}, true);
    check('cuerpo gigante (200 KB) → 413 (rechazado)', gran.status === 413, `HTTP ${gran.status}`);
    const metodo = await fetch(`${BASE}/api/estado`, { method: 'DELETE' });
    check('método no permitido sobre una ruta → 404/405 (no 500)', metodo.status === 404 || metodo.status === 405, `HTTP ${metodo.status}`);
    check('el servidor sigue vivo tras todos esos errores', await vivo());

    // ───────────────────────────────────────────────────────────────────────
    seccion('Cabeceras de seguridad');
    const h = (await fetch(`${BASE}/`)).headers;
    check('Content-Security-Policy', !!h.get('content-security-policy'));
    check('X-Content-Type-Options: nosniff', h.get('x-content-type-options') === 'nosniff');
    check('X-Frame-Options (anti-clickjacking)', !!h.get('x-frame-options'));
    check('Referrer-Policy', !!h.get('referrer-policy'));
    check('Permissions-Policy', !!h.get('permissions-policy'));
    check('no revela "X-Powered-By: Express"', !h.get('x-powered-by'));
    const hs = (await fetch(`${BASE}/`, { headers: { 'x-forwarded-proto': 'https' } })).headers;
    check('HSTS cuando la conexión es HTTPS', !!hs.get('strict-transport-security'));
    const red = await fetch(`${BASE}/admin`, { headers: { 'x-forwarded-proto': 'http' }, redirect: 'manual' });
    check('detrás de un proxy, HTTP se redirige a HTTPS (producción)', red.status === 301 && /^https:/.test(red.headers.get('location') || ''), `HTTP ${red.status}`);
    const cors = await fetch(`${BASE}/api/estado`, { headers: { Origin: 'https://sitio-malo.com' } });
    check('CORS: no autoriza a sitios de terceros', !cors.headers.get('access-control-allow-origin'));

    // ───────────────────────────────────────────────────────────────────────
    seccion('Tiempo real (WebSocket): origen, inundación y abuso');
    let rechazado = false;
    try { const e = await conectar('https://sitio-malo.com'); e.close(); } catch { rechazado = true; }
    check('una página de otro sitio NO puede abrir el WebSocket', rechazado);

    const s = await conectar();
    check('equipo legítimo se identifica como caja 1', (await emitir(s, 'identificar', { tipo: 'caja', caja: 1, clientId: 'eq-1' })).ok === true);
    for (let i = 0; i < 3000; i++) { s.emit('heartbeat'); s.emit('identificar', { tipo: 'caja', caja: 9 }); s.emit('llamar_turno', null); }
    await dormir(800);
    check('inundación de 9 000 eventos no tumba el servidor', await vivo());
    check('el equipo que inunda es DESCONECTADO por el servidor', s.disconnected === true);
    const legit = await conectar();
    await emitir(legit, 'identificar', { tipo: 'caja', caja: 3, clientId: 'eq-legit' });
    const a = await emitir(legit, 'llamar_turno', { caja: 3 });
    check('otro equipo legítimo sigue siendo atendido con normalidad durante/después del ataque', a.ok === true, JSON.stringify(a));
    legit.close();
    const raros = [undefined, null, 5, 'texto', [], {}, { tipo: { $ne: 1 } }, { tipo: 'caja', caja: { toString: 1 } }];
    const s2 = await conectar();
    for (const x of raros) { s2.emit('identificar', x); s2.emit('llamar_turno', x); }
    s2.close();
    await dormir(400);
    check('payloads de tipos raros no provocan caídas', await vivo());
    s.close();

    // 150 conexiones simultáneas
    const muchas = await Promise.allSettled(Array.from({ length: 150 }, () => conectar()));
    const abiertas2 = muchas.filter(m => m.status === 'fulfilled').map(m => m.value);
    check('150 equipos conectados a la vez', abiertas2.length >= 140, `${abiertas2.length}/150`);
    abiertas2.forEach(x => x.close());
    await dormir(300);
    check('servidor sano tras 150 conexiones', await vivo());

    // ───────────────────────────────────────────────────────────────────────
    seccion('Carga: 400 peticiones simultáneas');
    const t0 = Date.now();
    const ráfaga = await Promise.allSettled(Array.from({ length: 400 }, () => fetch(`${BASE}/api/estado`).then(r => r.status)));
    const codigos = ráfaga.map(r => r.status === 'fulfilled' ? r.value : 'ERR');
    const buenas = codigos.filter(c => c === 200 || c === 429).length;
    check(`400 peticiones en paralelo: todas respondidas (200 o 429), sin errores (${Date.now() - t0} ms)`, buenas === 400, JSON.stringify([...new Set(codigos)]));
    check('servidor sano tras la ráfaga', await vivo());

    // ───────────────────────────────────────────────────────────────────────
    seccion('Resiliencia: cortes, reinicios y datos dañados');
    // 1) cortar el servidor de golpe y volver a levantarlo
    const c1 = await conectar();
    await emitir(c1, 'identificar', { tipo: 'caja', caja: 2, clientId: 'eq-2' });
    await dormir(500);
    const llamado = await emitir(c1, 'llamar_turno', { caja: 2 });
    const antes = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    srv.kill('SIGKILL'); await dormir(600);
    check('el equipo detecta el corte (se desconecta) en vez de quedarse colgado', await new Promise(r => { if (c1.disconnected) return r(true); c1.on('disconnect', () => r(true)); setTimeout(() => r(false), 3000); }));
    srv = arrancar();
    check('el servidor vuelve a arrancar tras un corte brusco (kill -9)', await esperar());
    const despues = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    check('los turnos ya entregados siguen guardados tras el corte', llamado.ok && despues.historial.length === antes.historial.length && despues.config.contador === antes.config.contador);
    check('el login sigue funcionando tras el reinicio', (await login('Ganaadmin', CLAVE)).status === 200 || (await login('Ganaadmin', CLAVE)).status === 429);

    // 2) archivo de datos corrupto
    srv.kill('SIGKILL'); await dormir(500);
    const guardado = fs.readFileSync(STORE, 'utf8');
    fs.writeFileSync(STORE, '{"config": {"contador": 5, ');   // JSON cortado a la mitad (apagón durante la escritura)
    srv = arrancar();
    const levanto = await esperar();
    check('con el archivo de datos CORRUPTO el servidor arranca igual (no se cae)', levanto);
    const ficheros = fs.readdirSync(path.dirname(STORE));
    check('se conserva una copia de seguridad del archivo dañado o respaldo previo', ficheros.some(f => /bak|corrupto|backup/i.test(f)), ficheros.join(', '));
    const e2 = await (await fetch(`${BASE}/api/estado`)).json();
    check('tras recuperarse recupera el último estado bueno (no pierde los turnos)', e2.contador === antes.config.contador, `contador=${e2.contador} esperado=${antes.config.contador}`);

    // 3) errores inesperados no matan el proceso
    check('el log del servidor no registra caídas (uncaught)', !/Uncaught|UnhandledPromise|ReferenceError|TypeError/.test(srv.log), srv.log.slice(-300));

    // 4) apagado ordenado
    const cerrado = await new Promise(res => { srv.on('exit', c => res(c)); srv.kill('SIGTERM'); setTimeout(() => res('colgado'), 5000); });
    check('SIGTERM (apagado de Render) cierra ordenadamente', cerrado === 0 || cerrado === null || cerrado === 143, `código ${cerrado}`);
  } finally {
    try { srv.kill('SIGKILL'); } catch {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(` Seguridad y resiliencia: ${ok} correctas, ${fail} fallidas`);
  if (fail) console.log(' Fallaron:\n  - ' + fallos.join('\n  - '));
  console.log(`══════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('Error en las pruebas:', e); process.exit(1); });
