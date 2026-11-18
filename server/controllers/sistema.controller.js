/**
 * controllers/sistema.controller.js — Estado de la operación diaria (solo administradores).
 * Muestra en el panel: tiempo encendido, si los datos son permanentes, el reinicio diario y la dirección pública.
 */
const configModel = require('../models/configuracion.model');
const adminModel  = require('../models/administrador.model');
const { ahoraLocal } = require('../services/jornada.service');

const INICIO = new Date();

/** GET /api/sistema (admin) */
function estado(req, res) {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  res.json({
    encendidoDesde: INICIO.toISOString(),
    segundosEncendido: Math.round(process.uptime()),
    enRender: !!process.env.RENDER,
    direccion: process.env.RENDER_EXTERNAL_URL || `${proto}://${req.headers.host}`,
    turnosPermanentes: configModel.dondeSeGuardanTurnos() === 'mysql',
    almacenamiento: adminModel.dondeSeGuarda(),
    reinicioDiario: configModel.getConfig('reinicio_diario') === true,
    horaReinicio: configModel.getConfig('hora_reinicio') || '06:00',
    ultimoReinicio: configModel.getConfig('ultimo_reinicio') || null,
    horaColombia: ahoraLocal().hora
  });
}

/** GET /api/salud (pública) — la usa Render para saber si el servicio responde. */
function salud(_req, res) {
  res.json({ ok: true, turnos: configModel.dondeSeGuardanTurnos(), administradores: adminModel.modo() });
}

module.exports = { estado, salud };
