/** app.js — Aplicación Express: middlewares, rutas (controladores) y vistas (React compilado). */
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const { CLIENT_DIST } = require('./config/entorno');
const { cabeceras, forzarHttps } = require('./middlewares/seguridad');
const authRoutes = require('./routes/auth.routes');
const apiRoutes  = require('./routes/api.routes');

const app = express();

app.set('trust proxy', 1);
app.use(forzarHttps);
app.use(cabeceras);
app.use(express.json({ limit: '50kb' }));

// Controladores (API)
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Vistas: el cliente React compilado (client/dist). /display se conserva como acceso directo antiguo.
app.get('/display', (_req, res) => res.redirect(301, '/pantalla'));
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api|\/socket\.io).*$/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

module.exports = app;
