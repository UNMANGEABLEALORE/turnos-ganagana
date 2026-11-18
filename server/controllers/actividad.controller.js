/** controllers/actividad.controller.js — Reporte de actividad de los administradores. */
const actividad = require('../models/actividad.model');

/**
 * GET /api/actividad?limite=200&admin=3 (admin)
 * El administrador principal ve a todos (y puede filtrar por uno); los demás solo ven sus propias acciones.
 */
async function listar(req, res) {
  try {
    const pedido = parseInt(req.query.admin);
    const adminId = req.admin.principal ? (Number.isInteger(pedido) ? pedido : null) : req.admin.id;
    const [filas, resumen] = await Promise.all([
      actividad.listar({ limite: req.query.limite, adminId }),
      actividad.resumen({ adminId })
    ]);
    res.json({ ok: true, filas, resumen, soloPropia: !req.admin.principal, diasGuardados: actividad.RETENER_DIAS });
  } catch (e) {
    console.error('Error en el reporte de actividad:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo cargar el reporte de actividad.' });
  }
}

module.exports = { listar };
