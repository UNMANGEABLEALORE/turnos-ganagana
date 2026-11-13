/**
 * models/presencia.model.js — Qué equipos están conectados y qué equipo ocupa cada caja.
 * Es estado en memoria (se reconstruye cuando los equipos se reconectan).
 */
const TIMEOUT_HB = 15000;   // 15 s sin heartbeat → falla

// presencia[socketId] = { tipo: 'caja'|'pantalla'|'admin', caja: number|null, lastHB: number }
const presencia = {};

// ocupacion[caja] = { clientId, socketId, liberadaEn }
const ocupacion = {};

function calcularPresencia() {
  const ahora = Date.now();
  const resultado = {
    cajas: {},
    pantalla: { conectada: false, falla: false, detalle: '' },
    admin:    { conectada: false }
  };
  for (let i = 1; i <= 4; i++) resultado.cajas[i] = { conectada: false, falla: false, detalle: '' };

  for (const info of Object.values(presencia)) {
    const timedOut = (ahora - info.lastHB) > TIMEOUT_HB;
    if (info.tipo === 'caja' && info.caja) {
      resultado.cajas[info.caja].conectada = true;
      if (timedOut) {
        resultado.cajas[info.caja].falla   = true;
        resultado.cajas[info.caja].detalle = 'Sin respuesta (heartbeat timeout)';
      }
    } else if (info.tipo === 'pantalla') {
      resultado.pantalla.conectada = true;
      if (timedOut) {
        resultado.pantalla.falla   = true;
        resultado.pantalla.detalle = 'Sin respuesta (heartbeat timeout)';
      }
    } else if (info.tipo === 'admin') {
      resultado.admin.conectada = true;
    }
  }
  return resultado;
}

module.exports = { presencia, ocupacion, calcularPresencia };
