# Cómo publicar el sistema en internet (Railway)

Railway es un servicio gratuito, sin anuncios, que permite subir aplicaciones Node.js
y acceder a ellas desde cualquier lugar con internet.

## Paso 1 — Preparar el servidor para producción

El servidor ya sirve el cliente compilado como archivos estáticos.
Solo hace falta compilar el cliente React una sola vez antes de subir.

```bash
cd client
npm run build
```
Esto genera la carpeta `client/dist/` con los archivos listos.

## Paso 2 — Modificar server/index.js para servir el cliente

El servidor ya sirve la pantalla pública desde `/display`.
Agrega estas líneas al inicio de server/index.js para servir el cliente compilado:

```js
// Servir el cliente React compilado
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// SPA fallback: todas las rutas desconocidas → index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }
});
```

## Paso 3 — Crear cuenta en Railway

1. Ve a https://railway.app
2. Crea una cuenta gratuita (puedes usar GitHub)
3. En el dashboard, haz clic en "New Project"
4. Selecciona "Deploy from GitHub repo"
5. Sube el proyecto a GitHub primero (ver instrucciones abajo)

## Paso 4 — Subir a GitHub

```bash
# Desde la carpeta PROJEC GANAGANA
git init
git add .
git commit -m "Sistema de Turnos GanaGana v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/turnos-ganagana.git
git push -u origin main
```

## Paso 5 — Conectar en Railway

1. En Railway, selecciona el repositorio que acabas de subir
2. Railway detecta automáticamente que es Node.js
3. En "Settings" → "Start Command" escribe: `node server/index.js`
4. En "Variables" agrega: `PORT=3001`
5. Haz clic en "Deploy"

## Paso 6 — Obtener la URL pública

Railway te dará una URL como:
```
https://turnos-ganagana-production.up.railway.app
```

Con esa URL, desde CUALQUIER lugar con internet:
- Caja 1:  https://tu-url.railway.app/caja/1
- Caja 2:  https://tu-url.railway.app/caja/2
- Pantalla: https://tu-url.railway.app/pantalla
- Admin:   https://tu-url.railway.app/admin

## Importante — Admin sin conexión

Para que el panel admin funcione sin internet (solo en tu PC),
sigue usando la URL local:
```
http://localhost:5173/admin
```
Con usuario: Ganaadmin
Con clave:   Gana123

## Plan gratuito de Railway

- 500 horas/mes gratis (suficiente para uso diario)
- Sin límite de peticiones
- Sin anuncios
- HTTPS incluido
- El servidor duerme si no hay visitas en 1 hora (despertará en ~5 segundos cuando alguien entre)
