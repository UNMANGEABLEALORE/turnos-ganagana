require('./config/credenciales');   // 1.º: carga credenciales/.env antes que cualquier otro módulo

const fs    = require('fs');
const http  = require('http');
const https = require('https');
const { Server } = require('socket.io');
const { PUERTO, CERT_KEY, CERT_CRT } = require('./config/entorno');
const app = require('./app');
const tiempoReal = require('./services/tiempoReal.service');
const socketController = require('./controllers/socket.controller');
const adminModel = require('./models/administrador.model');
const store = require('./models/store');
const actividad = require('./models/actividad.model');

// HTTPS directo si hay certificados; si no, HTTP (Render ya aporta HTTPS)
const usaHttps = fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT);
const server = usaHttps
  ? https.createServer({ key: fs.readFileSync(CERT_KEY), cert: fs.readFileSync(CERT_CRT) }, app)
  : http.createServer(app);

/** Solo páginas de este mismo sitio pueden abrir el WebSocket (evita que un sitio malicioso use la sesión del admin). */
function origenPermitido(req) {
  const origen = req.headers.origin;
  if (!origen) return true;                                   // herramientas y apps sin navegador
  try {
    const o = new URL(origen);
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0];
    if (o.hostname === host) return true;
    if ((process.env.CORS_ORIGIN || '').split(',').includes(origen)) return true;
    // Desarrollo: el servidor de Vite (puerto 5173) en la misma máquina o red local
    if (process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(o.hostname)) return true;
  } catch { /* origen ilegible → rechazado */ }
  return false;
}

const io = new Server(server, {
  cors: process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(','), credentials: true } : false,
  allowRequest: (req, cb) => cb(null, origenPermitido(req)),
  maxHttpBufferSize: 1e5                                     // mensajes de máximo 100 KB
});
tiempoReal.setIo(io);
socketController.registrar(io);


// Un error inesperado se registra pero NO tumba el servicio (los turnos no se interrumpen)
process.on('uncaughtException',  e => console.error('Excepción no controlada:', e));
process.on('unhandledRejection', e => console.error('Promesa rechazada sin manejar:', e));

// Apagado ordenado (Render envía SIGTERM al reiniciar o desplegar)
async function apagar() {
  console.log('Apagando el servidor…');
  io.close();
  server.close();
  setTimeout(() => process.exit(0), 6000).unref();
  await store.vaciar();                       // termina de guardar en la base de datos antes de salir
  await require('./config/postgres').cerrar();
  process.exit(0);
}
process.on('SIGTERM', apagar);
process.on('SIGINT',  apagar);

// Render (plan gratis) apaga el servicio tras ~15 min sin visitas y al despertar BORRA el disco
// (turnos y administradores creados). Un aviso cada 10 min lo mantiene despierto.
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => { fetch(process.env.RENDER_EXTERNAL_URL + '/api/estado').catch(() => {}); }, 10 * 60_000).unref();
}

// Si el puerto está ocupado (otro servidor ya corre) se sale con error, para que el supervisor lo sepa
server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `❌ El puerto ${PUERTO} ya está en uso: ¿hay otro turnero abierto?` : `❌ Error del servidor: ${e.message}`);
  process.exit(1);
});

// Arranque en orden:
//   1) recupera turnos y contador (de la base de datos si está configurada; así sobreviven a los reinicios de Render)
//   2) reinicio automático del contador a A00 al empezar cada jornada (por defecto 06:00, hora de Colombia)
//   3) carga los administradores
//   4) abre el servidor
(async () => {
  const dondeTurnos = await store.iniciar();
  require('./services/jornada.service').iniciar();
  await adminModel.iniciar();
  actividad.depurar();                                // el reporte de actividad guarda 90 días
  setInterval(() => actividad.depurar(), 3_600_000).unref();
  server.listen(PUERTO, '0.0.0.0', () => {
    const esq = usaHttps ? 'https' : 'http';
    console.log(`\n✅ Servidor corriendo en ${esq}://0.0.0.0:${PUERTO}`);
    console.log(`   Pantalla pública:  ${esq}://localhost:${PUERTO}/pantalla`);
    console.log(`   Panel admin:       ${esq}://localhost:${PUERTO}/admin`);
    console.log(`   Turnos:            ${dondeTurnos === 'postgres' ? 'base de datos Supabase (permanente)' : 'archivo local'}`);
    console.log(`   Administradores:   ${adminModel.dondeSeGuarda()}\n`);
  });
})();
