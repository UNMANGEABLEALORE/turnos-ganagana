/** routes/auth.routes.js — /api/auth/* : acceso, sesión, administradores y "Mi cuenta". */
const { Router } = require('express');
const auth   = require('../controllers/auth.controller');
const admins = require('../controllers/administradores.controller');
const { requireAdmin } = require('../middlewares/autenticacion');
const { limitador } = require('../middlewares/seguridad');

const router = Router();
const limite = limitador({ max: 5, ventanaMs: 60_000, bloqueoMs: 60_000 });   // 5 intentos por minuto

// Acceso
router.get ('/config', auth.configuracion);
router.get ('/me', auth.yo);
router.post('/login', limite, auth.login);
router.post('/logout', auth.logout);
router.get ('/oauth/:prov', auth.oauthInicio);
router.get ('/oauth/:prov/callback', auth.oauthCallback);

// Administradores (requieren sesión)
router.get   ('/admins', requireAdmin, admins.listar);
router.post  ('/admins', requireAdmin, admins.crear);
router.delete('/admins/:id', requireAdmin, admins.eliminar);
router.post  ('/me/clave', requireAdmin, admins.cambiarClave);
router.post  ('/me/vinculos', requireAdmin, admins.vincular);

module.exports = router;
