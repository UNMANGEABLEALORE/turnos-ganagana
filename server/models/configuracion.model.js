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
    silencio:        getConfig('silencio') === true || getConfig('silencio') === 'true',
    numCajas:        getNumCajas(),
    reinicioDiario:  getConfig('reinicio_diario') === true,           // por defecto: NO (los turnos son de papel y siguen al otro día)
    horaReinicio:    getConfig('hora_reinicio') || '06:00'
  };
}

// ── Estado de cada caja (activa / inactiva) ──────────────────────────────────
function getCajasEstado() { return store.datos.config.cajas_estado; }

function setCajaEstado(caja, estado) {
  store.datos.config.cajas_estado[caja] = estado;
  store.guardar();
}

// ── Cantidad de cajas (el administrador puede agregar o quitar desde el panel) ──
const MAX_CAJAS = 12;
function getNumCajas() { return Number(store.datos.config.num_cajas) || 4; }

function setNumCajas(n) {
  const cfg = store.datos.config, antes = getNumCajas();
  cfg.num_cajas = n;
  cfg.cajas_estado = cfg.cajas_estado || {};
  for (let i = antes + 1; i <= n; i++) cfg.cajas_estado[i] = 'activa';
  for (let i = n + 1; i <= antes; i++) delete cfg.cajas_estado[i];
  store.guardar();
}

// ── Clave para firmar sesiones ───────────────────────────────────────────────
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // En Render el disco se borra al reiniciar: la clave va en el almacén (que se copia a MySQL) para no cerrar sesiones
  if (!process.env.RENDER) {
    const deCredenciales = cred.claveSesion();       // credenciales/sesion.secret (equipo local)
    if (deCredenciales) return deCredenciales;
  }
  if (!store.datos.sessionSecret) {                  // último recurso: se guarda en el almacén
    store.datos.sessionSecret = crypto.randomBytes(48).toString('hex');
    store.guardar();
  }
  return store.datos.sessionSecret;
}

/** 'mysql' si turnos y contador tienen copia permanente en MySQL; 'archivo' si solo están en disco. */
const dondeSeGuardanTurnos = () => store.dondeGuarda();

module.exports = { getConfig, setConfig, getConfigPublica, getCajasEstado, setCajaEstado, getSessionSecret, dondeSeGuardanTurnos, getNumCajas, setNumCajas, MAX_CAJAS };
