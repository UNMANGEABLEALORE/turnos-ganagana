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

  // El id nunca retrocede, aunque la depuración de 7 días deje el historial vacío
  const id = Math.max(cfg.ultimo_id || 0, historial.length ? historial[historial.length - 1].id : 0) + 1;
  cfg.ultimo_id = id;
  const ahora = new Date();
  historial.push({
    id, turno, caja,
    llamado_en: ahora.toLocaleString('es-CO', { hour12: false, timeZone: 'America/Bogota' }),
    ts: ahora.getTime()                              // hora exacta: sirve para depurar a los 7 días
  });
  if (historial.length > 2000) historial.splice(0, historial.length - 2000);    // últimos 2000 turnos: el guardado sigue liviano
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
