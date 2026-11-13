const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const fs         = require('fs');
const https      = require('https');
const sec        = require('./security');
const auth       = require('./auth');
const path       = require('path');

const {
  getConfig, setConfig,
  getCajasEstado, setCajaEstado,
  asignarTurno, getHistorial,
  resetContador, getEstado
} = require('./db');

const app    = express();
// HTTPS directo si hay certificados (server/certs/key.pem y cert.pem); si no, HTTP (Render ya da HTTPS)
const CERT_KEY  = process.env.SSL_KEY  || path.join(__dirname, 'certs', 'key.pem');
const CERT_CRT  = process.env.SSL_CERT || path.join(__dirname, 'certs', 'cert.pem');
const usaHttps  = fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT);
const server = usaHttps
  ? https.createServer({ key: fs.readFileSync(CERT_KEY), cert: fs.readFileSync(CERT_CRT) }, app)
  : http.createServer(app);
const io     = new Server(server, {
  cors: process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(','), credentials: true } : false
});

app.set('trust proxy', 1);
app.use(sec.forzarHttps);
app.use(sec.cabeceras);
app.use(express.json({ limit: '50kb' }));
app.use('/api/auth', auth.router);
app.use('/display', express.static(path.join(__dirname, '..', 'display')));

// En producción (Railway): servir el cliente React compilado
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/socket\.io|\/display).*$/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Presencia: rastrea qué clientes están conectados y a qué caja ────────────
// presencia[socketId] = { tipo: 'caja'|'pantalla'|'admin', caja?: number, lastHB: Date }
const presencia = {};

function calcularPresencia() {
  const ahora = Date.now();
  const TIMEOUT_HB = 15000; // 15 s sin heartbeat → falla

  const resultado = {
    cajas: {},
    pantalla: { conectada: false, falla: false, detalle: '' },
    admin:    { conectada: false }
  };

  for (let i = 1; i <= 4; i++) {
    resultado.cajas[i] = { conectada: false, falla: false, detalle: '' };
  }

  for (const [sid, info] of Object.entries(presencia)) {
    const timedOut = (ahora - info.lastHB) > TIMEOUT_HB;
    if (info.tipo === 'caja' && info.caja) {
      resultado.cajas[info.caja].conectada = true;
      if (timedOut) {
        resultado.cajas[info.caja].falla   = true;
        resultado.cajas[info.caja].detalle = 'Sin respuesta (heartbeat timeout)';
      }
    } else if (info.tipo === 'pantalla') {
      resultado.pantalla.conectada = true;
      if (timedOut) {
        resultado.pantalla.falla   = true;
        resultado.pantalla.detalle = 'Sin respuesta (heartbeat timeout)';
      }
    } else if (info.tipo === 'admin') {
      resultado.admin.conectada = true;
    }
  }

  return resultado;
}

// ── REST ─────────────────────────────────────────────────────────────────────

app.get('/api/estado', (_req, res) => res.json(getEstado()));

app.get('/api/presencia', auth.requireAdmin, (_req, res) => res.json(calcularPresencia()));

app.get('/api/config', (_req, res) => res.json({
  establecimiento: getConfig('establecimiento'),
  volumen:         parseFloat(getConfig('volumen')),
  silencio:        getConfig('silencio') === true || getConfig('silencio') === 'true'
}));

app.post('/api/config', auth.requireAdmin, (req, res) => {
  const { establecimiento, volumen, silencio } = req.body;
  if (establecimiento !== undefined) setConfig('establecimiento', establecimiento);
  if (volumen         !== undefined) setConfig('volumen', volumen);
  if (silencio        !== undefined) setConfig('silencio', silencio);

  const cfg = {
    establecimiento: getConfig('establecimiento'),
    volumen:         parseFloat(getConfig('volumen')),
    silencio:        getConfig('silencio') === true || getConfig('silencio') === 'true'
  };
  io.emit('config_actualizada', cfg);
  res.json({ ok: true, config: cfg });
});

app.get('/api/historial', auth.requireAdmin, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(getHistorial(limit));
});

app.post('/api/reset', auth.requireAdmin, (_req, res) => {
  resetContador();
  const estado = getEstado();
  io.emit('estado_actualizado', estado);
  res.json({ ok: true });
});

// Activar / desactivar caja
app.post('/api/caja/:id/estado', auth.requireAdmin, (req, res) => {
  const caja   = parseInt(req.params.id);
  const estado = req.body.estado; // 'activa' | 'inactiva'
  if (![1,2,3,4].includes(caja) || !['activa','inactiva'].includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Parámetros inválidos' });
  }
  setCajaEstado(caja, estado);
  const s = getEstado();
  io.emit('estado_actualizado', s);
  io.emit('caja_estado_cambiado', { caja, estado });
  res.json({ ok: true });
});

app.get('/api/cajas/estado', (_req, res) => res.json(getCajasEstado()));

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // El cliente se identifica inmediatamente
  socket.on('identificar', ({ tipo, caja }) => {
    // Solo una sesión de administrador válida puede identificarse como admin
    if (tipo === 'admin' && !auth.adminDeCookie(socket.handshake.headers.cookie)) return;
    presencia[socket.id] = { tipo, caja: caja || null, lastHB: Date.now() };
    emitirPresencia();
  });

  // Heartbeat: el cliente manda ping cada ~10 s
  socket.on('heartbeat', () => {
    if (presencia[socket.id]) {
      presencia[socket.id].lastHB = Date.now();
    }
  });

  // Enviar estado inicial
  socket.emit('estado_actualizado', getEstado());
  socket.emit('config_actualizada', {
    establecimiento: getConfig('establecimiento'),
    volumen:         parseFloat(getConfig('volumen')),
    silencio:        getConfig('silencio') === true || getConfig('silencio') === 'true'
  });

  socket.on('llamar_turno', (payload, callback) => {
    const caja = parseInt(payload?.caja);
    if (![1,2,3,4].includes(caja)) {
      return callback?.({ ok: false, error: 'Caja inválida' });
    }
    try {
      const resultado = asignarTurno(caja);
      const estado    = getEstado();
      io.emit('nuevo_turno', { ...resultado, estado });
      callback?.({ ok: true, ...resultado });
      console.log(`Turno ${resultado.turno} → Caja ${caja}`);
    } catch (err) {
      console.error('Error al asignar turno:', err.message);
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    delete presencia[socket.id];
    emitirPresencia();
    console.log(`[-] ${socket.id}`);
  });
});

function emitirPresencia() {
  io.emit('presencia_actualizada', calcularPresencia());
}

// Revisar timeouts cada 12 s y re-emitir presencia
setInterval(() => { emitirPresencia(); }, 12000);

// ── Inicio ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  const esq = usaHttps ? 'https' : 'http';
  console.log(`\n✅ Servidor corriendo en ${esq}://0.0.0.0:${PORT}`);
  console.log(`   Pantalla pública:  ${esq}://localhost:${PORT}/display`);
  console.log(`   Panel admin:       ${esq}://localhost:${PORT}/admin\n`);
});

