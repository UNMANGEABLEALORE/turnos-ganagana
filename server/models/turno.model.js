/** models/turno.model.js — Contador de turnos, historial y estado general. */
const store = require('./store');

/** Asigna el siguiente turno a una caja. Atómico: Node ejecuta esto sin interrupciones. */
function asignarTurno(caja) {
  const cfg = store.datos.config;
  if (cfg.cajas_estado[caja] !== 'activa') {
    throw new Error(`Caja ${caja} está desactivada por el administrador`);
  }
  const historial = store.datos.historial;
  const turno = cfg.contador;
  cfg.contador = turno + 1;

  historial.push({
    id: historial.length > 0 ? historial[historial.length - 1].id + 1 : 1,
    turno,
    caja,
    llamado_en: new Date().toLocaleString('es-CO', { hour12: false })
  });
  store.guardar();
  return { turno, caja };
}

function getHistorial(limit = 100) {
  return [...store.datos.historial].reverse().slice(0, limit);
}

function resetContador() {
  store.datos.config.contador = 0;
  store.guardar();
}

/** Estado que ven las cajas y la pantalla pública. */
function getEstado() {
  const { historial, config } = store.datos;
  const cajas = {};
  for (let i = 1; i <= 4; i++) {
    const regs = historial.filter(r => r.caja === i);
    cajas[i] = regs.length > 0
      ? { turno: regs[regs.length - 1].turno, llamado_en: regs[regs.length - 1].llamado_en }
      : null;
  }
  const ultimos = [...historial].slice(-3).reverse().map(r => ({ turno: r.turno, caja: r.caja }));

  return { contador: config.contador, cajas, cajasEstado: config.cajas_estado, ultimos };
}

module.exports = { asignarTurno, getHistorial, resetContador, getEstado };
