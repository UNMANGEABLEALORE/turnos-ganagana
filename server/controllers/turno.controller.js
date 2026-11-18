/** controllers/turno.controller.js — Estado, historial, reinicio y número actual. */
const turnoModel  = require('../models/turno.model');
const configModel = require('../models/configuracion.model');
const actividad   = require('../models/actividad.model');
const tiempoReal  = require('../services/tiempoReal.service');
const { formatTurno, parseTurno } = require('../utils/turno');

/** GET /api/estado */
function estado(_req, res) { res.json(turnoModel.getEstado()); }

/** GET /api/historial (admin) */
function historial(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 1000);
  res.json(turnoModel.getHistorial(limit));
}

/** POST /api/reset (admin) — vuelve a A00. */
async function reiniciar(req, res) {
  const antes = configModel.getConfig('contador');
  turnoModel.resetContador();
  tiempoReal.emitir('estado_actualizado', turnoModel.getEstado());
  await actividad.registrar(req.admin, 'Reinició el contador', `El próximo turno pasó de ${formatTurno(antes)} a A00`, req.ip);
  res.json({ ok: true });
}

/**
 * POST /api/contador (admin) — { turno: "F23" }
 * Fija el PRÓXIMO turno que se llamará. Sirve para que el sistema coincida con el rollo de papel.
 */
async function fijar(req, res) {
  const n = parseTurno(req.body?.turno);
  if (n === null) {
    return res.status(400).json({ ok: false, error: 'Escribe el turno con una letra y dos números, por ejemplo F23.' });
  }
  const antes = configModel.getConfig('contador');
  turnoModel.fijarContador(n);
  tiempoReal.emitir('estado_actualizado', turnoModel.getEstado());
  await actividad.registrar(req.admin, 'Fijó el número actual', `El próximo turno pasó de ${formatTurno(antes)} a ${formatTurno(n)}`, req.ip);
  res.json({ ok: true, contador: n, turno: formatTurno(n) });
}

module.exports = { estado, historial, reiniciar, fijar };
