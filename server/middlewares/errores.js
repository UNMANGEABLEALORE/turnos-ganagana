/**
 * middlewares/errores.js — Respuestas de error limpias: nunca se muestran trazas ni rutas internas.
 */

/** Rutas /api que no existen → 404 en JSON (el cliente puede mostrar un mensaje claro). */
function apiNoEncontrada(_req, res) {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
}

/** Cualquier error no controlado de Express. Sin `next`, Express mostraría la traza completa al visitante. */
// eslint-disable-next-line no-unused-vars
function manejador(err, req, res, _next) {
  if (err.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'La solicitud es demasiado grande' });
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ ok: false, error: 'JSON inválido' });
  console.error('Error no controlado en', req.method, req.path, '→', err.message);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
}

module.exports = { apiNoEncontrada, manejador };
