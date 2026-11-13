# Sistema de Turnos — GanaGana

Turnero con 4 cajas, pantalla pública con voz y panel de administración.
Guía de uso completa: [`GUIA_TURNERO.md`](GUIA_TURNERO.md).

## Arquitectura MVC

```
PROJEC GANAGANA/
├── server/                      ← Node.js + Express + Socket.IO
│   ├── index.js                 · Arranque: servidor HTTP(S) + Socket.IO
│   ├── app.js                   · Aplicación Express (middlewares, rutas, vistas)
│   ├── config/                  · entorno.js (puertos, rutas) · credenciales.js (lee /credenciales)
│   ├── models/                  · M — datos y reglas de negocio
│   │   ├── store.js                 persistencia JSON (data/store.json)
│   │   ├── turno.model.js           contador, historial, estado
│   │   ├── configuracion.model.js   ajustes, estado de cajas, clave de sesión
│   │   ├── administrador.model.js   administradores y super administrador
│   │   └── presencia.model.js       equipos conectados y ocupación de cajas
│   ├── controllers/             · C — reciben la petición y orquestan los modelos
│   │   ├── auth · administradores · config · turno · caja   (HTTP)
│   │   └── socket.controller.js                              (tiempo real)
│   ├── routes/                  · auth.routes.js · api.routes.js
│   ├── middlewares/             · seguridad.js (CSP, HTTPS, límite) · autenticacion.js
│   ├── services/                · captcha · oauth (Google/GitHub) · tiempoReal (Socket.IO)
│   ├── utils/                   · sesion.js (cookies, firmas, scrypt) · validaciones.js · turno.js
│   ├── tests/pruebas.js         · 91 pruebas automáticas
│   └── data/store.json          · datos (no se sube a Git)
│
├── client/                      ← React 18 + TypeScript + Vite
│   └── src/
│       ├── models/                  · M — tipos, formato de turno (A00–Z99), validaciones
│       ├── controllers/             · C — api.ts, socket.ts, useSocket, useCaptcha, voz
│       ├── views/                   · V — lo que ve el usuario
│       │   ├── pages/                   Selector, Caja, Pantalla pública, Admin
│       │   ├── admin/                   Login, Panel, Tarjeta, Mi cuenta, Administradores…
│       │   ├── components/              CookieBanner
│       │   └── styles/                  global.css
│       └── main.tsx                 · rutas y arranque
│
├── credenciales/                ← secretos (ignorados por Git; solo van las plantillas ejemplo.*)
├── render.yaml                  ← despliegue en Render
└── iniciar.bat                  ← arranque en Windows
```

**Flujo de una petición:** `Vista (React)` → `controllers/api.ts` → `routes/` → `controllers/` → `models/` → `data/store.json`.
Los controladores nunca tocan el archivo de datos directamente: siempre pasan por un modelo.

## Arranque

```bash
# Windows: doble clic en iniciar.bat
# Manual:
npm install --prefix server
npm install --prefix client
npm run build --prefix client      # compila React (revisa los tipos de TypeScript)
node server/index.js               # todo en http://localhost:3001
```

Desarrollo del cliente con recarga en vivo: `npm run dev --prefix client` (puerto 5173, con proxy al 3001).

## Pruebas

```bash
npm test          # = node server/tests/pruebas.js
```
Usa un puerto y archivos temporales; no toca tus datos ni tus credenciales.

## Credenciales

Nada secreto está en el código. Ver [`credenciales/LEEME.md`](credenciales/LEEME.md).
En Render se escriben como variables de entorno (ver `render.yaml`).

## Despliegue en Render

1. Sube el repositorio a GitHub (la carpeta `client/dist` ya viene compilada).
2. En Render: *New → Web Service*, rama `main`, build `npm install --prefix server`, start `node server/index.js`.
3. En **Environment** agrega las claves de `credenciales/ejemplo.env` (`PUBLIC_URL`, `HCAPTCHA_*`, `GOOGLE_*`, `GITHUB_*`, `ADMIN_PRINCIPAL_*`).
4. Si cambias el código del cliente, ejecuta `npm run build --prefix client` y sube también `client/dist`.

> El plan gratuito de Render borra el disco en cada reinicio: los turnos y los administradores creados desde el panel se pierden.
