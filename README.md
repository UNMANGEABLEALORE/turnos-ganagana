# Sistema de Turnos — GanaGana

## Estructura del proyecto

```
PROJEC GANAGANA/
├── server/          ← Node.js + Express + Socket.IO + SQLite
│   ├── index.js     ← Punto de entrada del servidor
│   ├── db.js        ← Base de datos y lógica de negocio
│   └── turnos.db    ← Base de datos SQLite (se crea automáticamente)
├── client/          ← React + Vite (Cajas + Admin)
│   └── src/
│       ├── pages/   ← SelectorPage, CajaPage, AdminPage
│       ├── hooks/   ← useSocket.js
│       └── utils/   ← formato.js
├── display/         ← Pantalla pública (HTML puro, sin build)
│   └── index.html
└── iniciar.bat      ← Script de inicio para Windows
```

## Requisitos previos

- **Node.js 18+** → https://nodejs.org (descargar la versión LTS)
- Conexión de red local entre los computadores

## Instalación y arranque

### Opción A — Doble clic (recomendado)
1. Haz doble clic en `iniciar.bat`
2. Espera a que instale las dependencias (primera vez puede tardar 1-2 minutos)
3. Se abrirá el navegador automáticamente

### Opción B — Manual
```bash
# Terminal 1: Servidor
cd server
npm install
node index.js

# Terminal 2: Cliente
cd client
npm install
npm run dev
```

## URLs del sistema

| Pantalla | URL |
|----------|-----|
| Selector de caja | http://localhost:5173 |
| Caja 1 | http://localhost:5173/caja/1 |
| Caja 2 | http://localhost:5173/caja/2 |
| Caja 3 | http://localhost:5173/caja/3 |
| Caja 4 | http://localhost:5173/caja/4 |
| Pantalla pública | http://localhost:3001/display |
| Panel admin | http://localhost:5173/admin |

## Uso desde otros computadores en la red local

1. Averigua la IP del servidor: abre CMD y escribe `ipconfig`
2. Busca la línea "Dirección IPv4" (ej: `192.168.1.100`)
3. En los demás computadores abre el navegador con:
   - Panel caja: `http://192.168.1.100:5173/caja/2`
   - Pantalla pública: `http://192.168.1.100:3001/display`

**Nota:** Para que el cliente Vite sea accesible desde la red, ejecuta:
```bash
cd client
npx vite --host 0.0.0.0 --port 5173
```
O agrega `host: '0.0.0.0'` en `vite.config.js` > `server`.

## Variables de entorno (opcional)

Crea un archivo `client/.env.local` para apuntar al servidor:
```
VITE_SERVER_URL=http://192.168.1.100:3001
```

## Teclas de acceso rápido

| Tecla | Acción |
|-------|--------|
| F9 | Llamar siguiente turno (cuando la ventana del turnero está activa) |

## Arquitectura de concurrencia

Los turnos se asignan usando **transacciones SQLite serializadas**. Aunque cuatro cajas llamen simultáneamente, el motor de base de datos garantiza que cada turno se asigne una sola vez y en orden estrictamente secuencial.
