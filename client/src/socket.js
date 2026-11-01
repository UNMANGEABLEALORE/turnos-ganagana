import { io } from 'socket.io-client';

/**
 * En desarrollo (Vite con proxy): URL vacía → proxy redirige al servidor local.
 * En red local (otro PC): mismo host pero puerto 3001.
 * En producción (Railway/internet): misma URL del sitio, sin puerto extra.
 */
function getServerUrl() {
  // Variable de entorno explícita (para casos especiales)
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  // En desarrollo con Vite, el proxy maneja /socket.io → localhost:3001
  if (import.meta.env.DEV) {
    return '';
  }

  // En producción: el servidor Express sirve todo desde la misma URL
  // No necesitamos puerto separado
  return window.location.origin;
}

const socket = io(getServerUrl(), {
  autoConnect: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling']
});

export default socket;
