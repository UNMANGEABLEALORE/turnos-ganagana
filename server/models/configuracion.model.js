/** models/configuracion.model.js — Ajustes del sistema, estado de las cajas y clave de sesión. */
const crypto = require('crypto');
const store  = require('./store');
const cred   = require('../config/credenciales');

function getConfig(key) { return store.datos.config[key]; }

function setConfig(key, value) {
  store.datos.config[key] = value;
  store.guardar();
}

/** Configuración pública que se envía a los clientes (pantalla, cajas, admin). */
function getConfigPublica() {
  return {
    establecimiento: getConfig('establecimiento'),
    volumen:         parseFloat(getConfig('volumen')),
    silencio:        getConfig('silencio') === true || getConfig('silencio') === 'true'
  };
}

// ── Estado de cada caja (activa / inactiva) ──────────────────────────────────
function getCajasEstado() { return store.datos.config.cajas_estado; }

function setCajaEstado(caja, estado) {
  store.datos.config.cajas_estado[caja] = estado;
  store.guardar();
}

// ── Clave para firmar sesiones ───────────────────────────────────────────────
function getSessionSecret() {
  const deCredenciales = cred.claveSesion();         // variable de entorno o credenciales/sesion.secret
  if (deCredenciales) return deCredenciales;
  if (!store.datos.sessionSecret) {                  // último recurso: se guarda en el almacén
    store.datos.sessionSecret = crypto.randomBytes(48).toString('hex');
    store.guardar();
  }
  return store.datos.sessionSecret;
}

module.exports = { getConfig, setConfig, getConfigPublica, getCajasEstado, setCajaEstado, getSessionSecret };
