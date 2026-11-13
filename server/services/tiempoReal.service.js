/**
 * services/tiempoReal.service.js — Socket.IO: difusión de eventos y exclusividad de caja.
 *
 * Exclusividad: una caja solo puede estar en uso por UN equipo a la vez.
 *  - Cada navegador genera un clientId (sessionStorage) y lo envía al identificarse.
 *  - Mismo clientId (recarga / reconexión)  → recupera su caja y expulsa la sesión vieja.
 *  - Otro clientId con la caja en uso        → se rechaza.
 *  - Si el dueño se desconecta, su caja queda reservada GRACIA_MS por si solo recarga.
 */
const { presencia, ocupacion, calcularPresencia } = require('../models/presencia.model');

const GRACIA_MS = parseInt(process.env.GRACIA_MS) || 15000;
let io = null;

function setIo(instancia) { io = instancia; }
function getIo() { return io; }

function emitir(evento, datos) { if (io) io.emit(evento, datos); }
function emitirPresencia() { emitir('presencia_actualizada', calcularPresencia()); }

const socketVivo = id => !!id && !!io && io.sockets.sockets.has(id);

function intentarOcupar(socket, caja, clientId) {
  const occ   = ocupacion[caja];
  const ahora = Date.now();

  if (occ) {
    const vivo = socketVivo(occ.socketId) && occ.socketId !== socket.id;
    if (vivo && occ.clientId !== clientId) {
      return { ok: false, error: `La Caja ${caja} ya está siendo usada por otra persona o equipo.` };
    }
    if (!vivo && occ.liberadaEn && occ.clientId !== clientId && ahora - occ.liberadaEn < GRACIA_MS) {
      const seg = Math.ceil((GRACIA_MS - (ahora - occ.liberadaEn)) / 1000);
      return { ok: false, error: `La Caja ${caja} se acaba de liberar. Intenta de nuevo en ${seg}s.` };
    }
    if (vivo) {                       // mismo equipo en otra pestaña/conexión → desplaza la vieja
      io.sockets.sockets.get(occ.socketId)?.emit('caja_desplazada', {
        caja, motivo: 'Esta caja se abrió en otra ventana del mismo equipo.'
      });
      delete presencia[occ.socketId];
    }
  }
  ocupacion[caja] = { clientId, socketId: socket.id, liberadaEn: null };
  return { ok: true };
}

/** Marca como "recién liberadas" las cajas de un socket que se desconectó. */
function liberarSocket(socketId) {
  for (const occ of Object.values(ocupacion)) {
    if (occ.socketId === socketId) occ.liberadaEn = Date.now();
  }
}

/** El administrador libera una caja a la fuerza. Devuelve true si estaba ocupada. */
function liberarCaja(caja) {
  const occ = ocupacion[caja];
  if (!occ) return false;
  io?.sockets.sockets.get(occ.socketId)?.emit('caja_desplazada', {
    caja, motivo: 'El administrador liberó esta caja.'
  });
  delete presencia[occ.socketId];
  delete ocupacion[caja];
  emitirPresencia();
  return true;
}

module.exports = { setIo, getIo, emitir, emitirPresencia, intentarOcupar, liberarSocket, liberarCaja };
