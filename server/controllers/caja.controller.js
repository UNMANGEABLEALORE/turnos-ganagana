/** controllers/caja.controller.js — Estado de conexión de las cajas, activar/desactivar y liberar. */
const configModel = require('../models/configuracion.model');
const turnoModel  = require('../models/turno.model');
const { calcularPresencia } = require('../models/presencia.model');
const tiempoReal  = require('../services/tiempoReal.service');
const { esCajaValida } = require('../utils/validaciones');

/** GET /api/presencia (admin) */
function presencia(_req, res) { res.json(calcularPresencia()); }

/** GET /api/cajas/estado */
function estados(_req, res) { res.json(configModel.getCajasEstado()); }

/** POST /api/caja/:id/estado (admin) — activa o desactiva una caja. */
function cambiarEstado(req, res) {
  const caja   = parseInt(req.params.id);
  const estado = req.body?.estado;
  if (!esCajaValida(caja) || !['activa', 'inactiva'].includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Parámetros inválidos' });
  }
  configModel.setCajaEstado(caja, estado);
  tiempoReal.emitir('estado_actualizado', turnoModel.getEstado());
  tiempoReal.emitir('caja_estado_cambiado', { caja, estado });
  res.json({ ok: true });
}

/** POST /api/caja/:id/liberar (admin) — expulsa a quien usa la caja. */
function liberar(req, res) {
  const caja = parseInt(req.params.id);
  if (!esCajaValida(caja)) return res.status(400).json({ ok: false, error: 'Caja inválida' });
  res.json({ ok: true, estabaOcupada: tiempoReal.liberarCaja(caja) });
}

module.exports = { presencia, estados, cambiarEstado, liberar };
