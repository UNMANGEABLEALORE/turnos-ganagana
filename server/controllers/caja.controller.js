/** controllers/caja.controller.js — Cajas: estado de conexión, activar/desactivar, liberar y agregar/quitar. */
const configModel = require('../models/configuracion.model');
const turnoModel  = require('../models/turno.model');
const actividad   = require('../models/actividad.model');
const { calcularPresencia } = require('../models/presencia.model');
const tiempoReal  = require('../services/tiempoReal.service');
const { esCajaValida } = require('../utils/validaciones');
const { direccionPublica } = require('../utils/direccion');

const noExiste = () => `Esa caja no existe: hay ${configModel.getNumCajas()} cajas.`;

/** GET /api/presencia (admin) */
function presencia(_req, res) { res.json(calcularPresencia(configModel.getNumCajas())); }

/** GET /api/cajas/estado */
function estados(_req, res) { res.json(configModel.getCajasEstado()); }

/** POST /api/caja/:id/estado (admin) — activa o desactiva una caja. */
async function cambiarEstado(req, res) {
  const caja   = parseInt(req.params.id);
  const estado = req.body?.estado;
  if (!esCajaValida(caja, configModel.getNumCajas()) || !['activa', 'inactiva'].includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Parámetros inválidos' });
  }
  configModel.setCajaEstado(caja, estado);
  tiempoReal.emitir('estado_actualizado', turnoModel.getEstado());
  tiempoReal.emitir('caja_estado_cambiado', { caja, estado });
  await actividad.registrar(req.admin, estado === 'activa' ? 'Activó una caja' : 'Desactivó una caja', `Caja ${caja}`, req.ip);
  res.json({ ok: true });
}

/** POST /api/caja/:id/liberar (admin) — expulsa a quien usa la caja. */
async function liberar(req, res) {
  const caja = parseInt(req.params.id);
  if (!esCajaValida(caja, configModel.getNumCajas())) return res.status(400).json({ ok: false, error: noExiste() });
  const estabaOcupada = tiempoReal.liberarCaja(caja);
  await actividad.registrar(req.admin, 'Liberó una caja', `Caja ${caja}${estabaOcupada ? '' : ' (no estaba en uso)'}`, req.ip);
  res.json({ ok: true, estabaOcupada });
}

/**
 * POST /api/cajas (admin) — { accion: 'agregar' | 'quitar' }
 * Agrega la siguiente caja (5, 6, 7…) o quita la última. Devuelve el enlace de la caja nueva.
 */
async function cambiarCantidad(req, res) {
  const accion = req.body?.accion;
  const total  = configModel.getNumCajas();
  const error  = (status, msg) => res.status(status).json({ ok: false, error: msg });

  if (accion === 'agregar') {
    if (total >= configModel.MAX_CAJAS) return error(409, `Ya hay el máximo de cajas (${configModel.MAX_CAJAS}).`);
    configModel.setNumCajas(total + 1);
  } else if (accion === 'quitar') {
    if (total <= 1) return error(409, 'Debe quedar al menos una caja.');
    if (tiempoReal.cajaEnUso(total)) return error(409, `La Caja ${total} está en uso. Libérala primero desde su tarjeta.`);
    configModel.setNumCajas(total - 1);
  } else {
    return error(400, 'Acción inválida.');
  }

  const nuevo = configModel.getNumCajas();
  tiempoReal.emitir('config_actualizada', configModel.getConfigPublica());
  tiempoReal.emitir('estado_actualizado', turnoModel.getEstado());
  tiempoReal.emitirPresencia();

  const enlace = `${direccionPublica(req)}/caja/${accion === 'agregar' ? nuevo : total}`;
  await actividad.registrar(req.admin, accion === 'agregar' ? 'Agregó una caja' : 'Quitó una caja',
    accion === 'agregar' ? `Caja ${nuevo} (ahora hay ${nuevo})` : `Caja ${total} (ahora hay ${nuevo})`, req.ip);
  res.json({ ok: true, numCajas: nuevo, caja: accion === 'agregar' ? nuevo : total, enlace });
}

module.exports = { presencia, estados, cambiarEstado, liberar, cambiarCantidad };
