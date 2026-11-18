/** controllers/config.controller.js — Ajustes del sistema (nombre, volumen, silencio). */
const configModel = require('../models/configuracion.model');
const tiempoReal  = require('../services/tiempoReal.service');

/** GET /api/config */
function obtener(_req, res) { res.json(configModel.getConfigPublica()); }

/** POST /api/config (admin) — valida todo antes de guardar. */
function actualizar(req, res) {
  const { establecimiento, volumen, silencio, reinicioDiario, horaReinicio } = req.body || {};

  if (reinicioDiario !== undefined && typeof reinicioDiario !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'El reinicio diario debe ser verdadero o falso.' });
  }
  if (horaReinicio !== undefined && !(typeof horaReinicio === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(horaReinicio))) {
    return res.status(400).json({ ok: false, error: 'La hora de reinicio debe tener el formato HH:MM (por ejemplo 06:00).' });
  }

  if (establecimiento !== undefined && (typeof establecimiento !== 'string' || establecimiento.trim().length < 2 ||
      establecimiento.length > 60 || !/^[\p{L}\p{N} .,&'’()\-#·]+$/u.test(establecimiento.trim()))) {
    return res.status(400).json({ ok: false, error: 'Nombre de establecimiento inválido (2 a 60 caracteres: letras, números y . , & - # ( ) solamente).' });
  }
  if (volumen !== undefined && !(typeof volumen === 'number' && volumen >= 0 && volumen <= 1)) {
    return res.status(400).json({ ok: false, error: 'El volumen debe ser un número entre 0 y 1.' });
  }
  if (silencio !== undefined && typeof silencio !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'El valor de silencio debe ser verdadero o falso.' });
  }

  if (establecimiento !== undefined) configModel.setConfig('establecimiento', establecimiento);
  if (volumen         !== undefined) configModel.setConfig('volumen', volumen);
  if (silencio        !== undefined) configModel.setConfig('silencio', silencio);
  if (reinicioDiario  !== undefined) configModel.setConfig('reinicio_diario', reinicioDiario);
  if (horaReinicio    !== undefined) configModel.setConfig('hora_reinicio', horaReinicio);

  const cfg = configModel.getConfigPublica();
  tiempoReal.emitir('config_actualizada', cfg);
  res.json({ ok: true, config: cfg });
}

module.exports = { obtener, actualizar };
