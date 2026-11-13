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

// HTTPS directo si hay certificados; si no, HTTP (Render ya aporta HTTPS)
const usaHttps = fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT);
const server = usaHttps
  ? https.createServer({ key: fs.readFileSync(CERT_KEY), cert: fs.readFileSync(CERT_CRT) }, app)
  : http.createServer(app);

const io = new Server(server, {
  cors: process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(','), credentials: true } : false
});
tiempoReal.setIo(io);
socketController.registrar(io);

// Crea los administradores iniciales al arrancar (y credenciales/administradores.json si hace falta)
adminModel.listar();

server.listen(PUERTO, '0.0.0.0', () => {
  const esq = usaHttps ? 'https' : 'http';
  console.log(`\n✅ Servidor corriendo en ${esq}://0.0.0.0:${PUERTO}`);
  console.log(`   Pantalla pública:  ${esq}://localhost:${PUERTO}/pantalla`);
  console.log(`   Panel admin:       ${esq}://localhost:${PUERTO}/admin\n`);
});
