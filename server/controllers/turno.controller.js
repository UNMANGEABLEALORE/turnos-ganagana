/** controllers/turno.controller.js — Estado, historial y reinicio de la numeración. */
const turnoModel = require('../models/turno.model');
const tiempoReal = require('../services/tiempoReal.service');

/** GET /api/estado */
function estado(_req, res) { res.json(turnoModel.getEstado()); }

/** GET /api/historial (admin) */
function historial(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 1000);
  res.json(turnoModel.getHistorial(limit));
}

/** POST /api/reset (admin) — vuelve a A00. */
function reiniciar(_req, res) {
  turnoModel.resetContador();
  tiempoReal.emitir('estado_actualizado', turnoModel.getEstado());
  res.json({ ok: true });
}

module.exports = { estado, historial, reiniciar };
