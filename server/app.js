/** app.js — Aplicación Express: middlewares, rutas (controladores) y vistas (React compilado). */
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const { CLIENT_DIST } = require('./config/entorno');
const { cabeceras, forzarHttps, limiteGeneral } = require('./middlewares/seguridad');
const { apiNoEncontrada, manejador } = require('./middlewares/errores');
const authRoutes = require('./routes/auth.routes');
const apiRoutes  = require('./routes/api.routes');

const app = express();

app.set('trust proxy', 1);
app.use(forzarHttps);
app.use(cabeceras);
app.use(express.json({ limit: '50kb' }));

// Controladores (API)
app.use('/api', limiteGeneral({ max: 600, ventanaMs: 60_000 }));   // anti-inundación
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', apiNoEncontrada);                                   // /api/lo-que-sea → 404 en JSON

// Vistas: el cliente React compilado (client/dist). /display se conserva como acceso directo antiguo.
app.get('/display', (_req, res) => res.redirect(301, '/pantalla'));
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api|\/socket\.io).*$/, (req, res) => {
    // Un archivo con extensión que no existe (.js, .css, .png…) es un 404 real; solo las páginas caen en la app
    if (path.extname(req.path)) return res.status(404).type('text/plain').send('No encontrado');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.use(manejador);   // último: errores sin traza

module.exports = app;
