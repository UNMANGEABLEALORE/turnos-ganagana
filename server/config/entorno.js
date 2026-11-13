/** Configuración del entorno: puertos y rutas. Los secretos NO van aquí (ver credenciales.js). */
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');

module.exports = {
  RAIZ,
  PUERTO: process.env.PORT || 3001,
  CLIENT_DIST: path.join(RAIZ, 'client', 'dist'),
  // HTTPS directo si existen estos certificados; si no, HTTP (Render ya aporta HTTPS)
  CERT_KEY: process.env.SSL_KEY || path.join(__dirname, '..', 'certs', 'key.pem'),
  CERT_CRT: process.env.SSL_CERT || path.join(__dirname, '..', 'certs', 'cert.pem')
};
