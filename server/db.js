/**
 * db.js — Persistencia sin dependencias nativas (store.json)
 * Node.js es single-threaded → las escrituras síncronas son atómicas.
 */

const fs   = require('fs');
const path = require('path');

const STORE_PATH = process.env.RAILWAY_ENVIRONMENT
  ? '/tmp/store.json'          // Railway usa /tmp para archivos temporales
  : path.join(__dirname, 'store.json');  // Local: junto al servidor

function valorInicial() {
  return {
    config: {
      contador:        0,
      establecimiento: 'GanaGana',
      volumen:         0.5,
      silencio:        false,
      // Estado de cada caja: 'activa' | 'inactiva'
      cajas_estado: { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' }
    },
    historial: []
  };
}

function cargarStore() {
  if (!fs.existsSync(STORE_PATH)) {
    const v = valorInicial();
    fs.writeFileSync(STORE_PATH, JSON.stringify(v, null, 2), 'utf8');
    return v;
  }
  try {
    const s = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    // Migración: añadir cajas_estado si no existe
    if (!s.config.cajas_estado) {
      s.config.cajas_estado = { 1: 'activa', 2: 'activa', 3: 'activa', 4: 'activa' };
      fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf8');
    }
    return s;
  } catch {
    const v = valorInicial();
    fs.writeFileSync(STORE_PATH, JSON.stringify(v, null, 2), 'utf8');
    return v;
  }
}

function guardarStore(s) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf8');
}

let store = cargarStore();

// ── Config ──────────────────────────────────────────────────────────────────
function getConfig(key) { return store.config[key]; }

function setConfig(key, value) {
  store.config[key] = value;
  guardarStore(store);
}

// ── Estado de cajas (activa / inactiva) ──────────────────────────────────────
function getCajasEstado() {
  return store.config.cajas_estado;
}

function setCajaEstado(caja, estado) {
  store.config.cajas_estado[caja] = estado; // 'activa' | 'inactiva'
  guardarStore(store);
}

// ── Asignación atómica ──────────────────────────────────────────────────────
function asignarTurno(caja) {
  // Bloquear si la caja está inactiva
  if (store.config.cajas_estado[caja] !== 'activa') {
    throw new Error(`Caja ${caja} está desactivada por el administrador`);
  }

  const turno    = store.config.contador;
  const siguiente = turno + 1;
  store.config.contador = siguiente;

  const registro = {
    id: store.historial.length > 0
          ? store.historial[store.historial.length - 1].id + 1
          : 1,
    turno,
    caja,
    llamado_en: new Date().toLocaleString('es-CO', { hour12: false })
  };
  store.historial.push(registro);
  guardarStore(store);
  return { turno, caja };
}

function getHistorial(limit = 100) {
  return [...store.historial].reverse().slice(0, limit);
}

function resetContador() {
  store.config.contador = 0;
  guardarStore(store);
}

function getEstado() {
  const cajas = {};
  for (let i = 1; i <= 4; i++) {
    const regs = store.historial.filter(r => r.caja === i);
    cajas[i] = regs.length > 0
      ? { turno: regs[regs.length - 1].turno, llamado_en: regs[regs.length - 1].llamado_en }
      : null;
  }
  const ultimos = [...store.historial]
    .slice(-3).reverse()
    .map(r => ({ turno: r.turno, caja: r.caja }));

  return {
    contador:     store.config.contador,
    cajas,
    cajasEstado:  store.config.cajas_estado,
    ultimos
  };
}

module.exports = {
  getConfig, setConfig,
  getCajasEstado, setCajaEstado,
  asignarTurno, getHistorial,
  resetContador, getEstado
};
