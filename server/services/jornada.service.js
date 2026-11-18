/**
 * services/jornada.service.js — Reinicio automático del contador al empezar cada jornada.
 *
 * Cada día, a la hora configurada (por defecto 06:00, hora de Colombia), el contador vuelve a A00.
 * Si el servidor estaba apagado a esa hora, el reinicio se hace en cuanto arranca ese mismo día.
 * Se usa la zona horaria de Colombia aunque el servidor esté en otro país (Render usa UTC).
 *
 * Se configura desde el panel de administración (Configuración general).
 */
const configModel = require('../models/configuracion.model');
const turnoModel  = require('../models/turno.model');
const tiempoReal  = require('./tiempoReal.service');

const ZONA = process.env.TZ_TURNERO || 'America/Bogota';
const INTERVALO_MS = parseInt(process.env.JORNADA_INTERVALO_MS) || 30_000;

/** Fecha (AAAA-MM-DD) y hora (HH:MM) actuales en la zona del turnero. */
function ahoraLocal(fecha = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(fecha).map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** Revisa si toca reiniciar. Devuelve true si reinició. */
function revisar() {
  const { fecha, hora } = ahoraLocal();
  const ultimo = configModel.getConfig('ultimo_reinicio');

  // Primera vez con esta función: se marca hoy SIN reiniciar (no se borra el contador de quien ya trabaja)
  if (!ultimo) { configModel.setConfig('ultimo_reinicio', fecha); return false; }

  if (configModel.getConfig('reinicio_diario') !== true) return false;      // por defecto apagado: la numeración continúa al otro día
  const horaReinicio = configModel.getConfig('hora_reinicio') || '06:00';
  if (ultimo === fecha || hora < horaReinicio) return false;

  turnoModel.resetContador();
  configModel.setConfig('ultimo_reinicio', fecha);
  tiempoReal.emitir('estado_actualizado', turnoModel.getEstado());
  console.log(`🌅 Nueva jornada (${fecha} ${hora}): contador reiniciado a A00 automáticamente.`);
  return true;
}

function iniciar() {
  revisar();
  setInterval(revisar, INTERVALO_MS).unref();
}

module.exports = { iniciar, revisar, ahoraLocal, ZONA };
