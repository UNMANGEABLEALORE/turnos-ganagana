/**
 * navegador.js — Prueba en un navegador REAL (Microsoft Edge/Chrome) de qué ve la cajera cuando se queda sin internet.
 * Uso:  node server/tests/navegador.js      (requiere Edge o Chrome instalado y client/dist compilado)
 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const WebSocket = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'ws'));

const PORT = 3997, BASE = `http://localhost:${PORT}`, CDP = 9333;
const TMP = path.join(os.tmpdir(), `gg-nav-${Date.now()}`);
const dormir = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, fail = 0; const chk = (n, c, e = '') => { c ? ok++ : fail++; console.log(`  ${c ? '✔' : '✘'} ${n} ${c ? '' : e}`); };

const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(fs.existsSync);
if (!exe) { console.log('No hay Edge ni Chrome instalado: prueba omitida.'); process.exit(0); }

async function main() {
  fs.mkdirSync(path.join(TMP, 'cred'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'cred', 'administradores.json'), JSON.stringify([{ usuario: 'Ganaadmin', clave: 'ClavePrueba9x', nombre: 'Laura Martínez', principal: true }]));
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), STORE_PATH: path.join(TMP, 'store.json'), CREDENCIALES_DIR: path.join(TMP, 'cred') }, stdio: 'ignore' });
  const nav = spawn(exe, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${path.join(TMP, 'perfil')}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(`${BASE}/api/estado`); await fetch(`http://localhost:${CDP}/json/version`); break; } catch { await dormir(250); } }
    const tabs = await (await fetch(`http://localhost:${CDP}/json`)).json();
    const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));
    let id = 0; const pend = {};
    ws.on('message', m => { const d = JSON.parse(m); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } });
    const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    const texto = async () => (await cdp('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.result.value || '';
    const esperarTexto = async (re, ms = 8000) => { const t0 = Date.now(); let t = ''; while (Date.now() - t0 < ms) { t = await texto(); if (re.test(t)) return t; await dormir(250); } return t; };

    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
    console.log('\n▶ La cajera abre su caja con internet');
    await cdp('Page.navigate', { url: `${BASE}/caja/1` });
    let t = await esperarTexto(/Conectada/);
    chk('la caja abre y muestra "Conectada"', /Conectada/.test(t), t.slice(0, 120));
    chk('no muestra aviso de falta de internet', !/no tiene internet/i.test(t));
    await dormir(1500);   // deja que el service worker se instale y guarde la app

    console.log('\n▶ Se corta el internet del equipo (con la página abierta)');
    await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    t = await esperarTexto(/no tiene internet/i);
    chk('aparece el aviso "Este equipo no tiene internet"', /no tiene internet/i.test(t), t.slice(0, 200));
    chk('el aviso explica que no se pierde ningún turno', /no se pierde/i.test(t));
    const btn = (await cdp('Runtime.evaluate', { expression: `[...document.querySelectorAll('button')].find(b=>/Llamar siguiente/.test(b.innerText))?.disabled`, returnByValue: true })).result.result.value;
    chk('el botón "Llamar siguiente turno" queda desactivado (no se puede pedir turno sin red)', btn === true);

    console.log('\n▶ Con el internet cortado, la cajera recarga la página (F5)');
    await cdp('Page.navigate', { url: `${BASE}/caja/1` });
    t = await esperarTexto(/CAJA 1|Caja 1/i, 8000);
    chk('la página SIGUE ABRIENDO sin internet (no sale el dinosaurio ni "sin conexión" del navegador)', /CAJA 1/i.test(t), t.slice(0, 160));
    t = await esperarTexto(/no tiene internet/i, 5000);
    chk('y le sigue mostrando el aviso de que no hay internet', /no tiene internet/i.test(t), t.slice(0, 160));

    console.log('\n▶ Vuelve el internet');
    await cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    t = await esperarTexto(/Conectada/, 15000);
    chk('la caja se reconecta SOLA (sin recargar) y vuelve a "Conectada"', /Conectada/.test(t) && !/no tiene internet/i.test(t), t.slice(0, 160));
    const btn2 = (await cdp('Runtime.evaluate', { expression: `[...document.querySelectorAll('button')].find(b=>/Llamar siguiente/.test(b.innerText))?.disabled`, returnByValue: true })).result.result.value;
    chk('el botón vuelve a estar activo', btn2 === false);

    console.log('\n▶ Rutas inexistentes en el navegador');
    await cdp('Page.navigate', { url: `${BASE}/esta-pagina-no-existe` });
    await dormir(1500);
    const url = (await cdp('Runtime.evaluate', { expression: 'location.pathname', returnByValue: true })).result.result.value;
    chk('una dirección inexistente lleva al inicio (no deja la pantalla en blanco)', url === '/', `quedó en ${url}`);
    ws.close();
  } finally {
    nav.kill(); srv.kill();
    await dormir(500);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  }
  console.log(`\n══════════════════════════════════════\n Navegador real: ${ok} correctas, ${fail} fallidas\n══════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('Error:', e); process.exit(1); });
