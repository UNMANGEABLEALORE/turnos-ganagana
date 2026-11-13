/** routes/api.routes.js — /api/* : turnos, configuración y cajas. */
const { Router } = require('express');
const turnos = require('../controllers/turno.controller');
const config = require('../controllers/config.controller');
const cajas  = require('../controllers/caja.controller');
const { requireAdmin } = require('../middlewares/autenticacion');

const router = Router();

// Públicas
router.get('/estado', turnos.estado);
router.get('/config', config.obtener);
router.get('/cajas/estado', cajas.estados);

// Solo administradores
router.get ('/presencia', requireAdmin, cajas.presencia);
router.get ('/historial', requireAdmin, turnos.historial);
router.post('/reset', requireAdmin, turnos.reiniciar);
router.post('/config', requireAdmin, config.actualizar);
router.post('/caja/:id/estado', requireAdmin, cajas.cambiarEstado);
router.post('/caja/:id/liberar', requireAdmin, cajas.liberar);

module.exports = router;
