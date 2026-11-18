/**
 * controllers/socket.controller.js — Eventos en tiempo real (Socket.IO).
 *   identificar  → el equipo dice si es caja / pantalla / admin (y ocupa la caja si corresponde)
 *   heartbeat    → "sigo conectado"
 *   llamar_turno → solo el equipo que ocupa la caja puede llamar un turno
 * Todo payload se valida: nada de lo que llegue puede tumbar el servidor.
 */
const turnoModel  = require('../models/turno.model');
const configModel = require('../models/configuracion.model');
const { presencia, ocupacion } = require('../models/presencia.model');
const tiempoReal  = require('../services/tiempoReal.service');
const { adminDeCookie } = require('../middlewares/autenticacion');
const { formatTurno } = require('../utils/turno');
const { esCajaValida } = require('../utils/validaciones');

const ANTIREBOTE_MS = 400;

function registrar(io) {
  io.on('connection', (socket) => {
    console.log(`[+] ${socket.id}`);
    let ultimoLlamado = 0;

    // Anti-inundación: un equipo legítimo envía ~1 evento cada 10 s (heartbeat). Más de 300 en 10 s es un abuso.
    const ventana = { n: 0, desde: Date.now() };
    socket.use((_paquete, next) => {
      const ahora = Date.now();
      if (ahora - ventana.desde > 10_000) { ventana.n = 0; ventana.desde = ahora; }
      if (++ventana.n > 300) { console.warn(`[!] ${socket.id} desconectado por inundación de eventos`); socket.disconnect(true); return; }
      next();
    });

    socket.on('identificar', (datos, cb) => {
      const responder = typeof cb === 'function' ? cb : () => {};
      try {
        const tipo     = datos?.tipo;
        const caja     = parseInt(datos?.caja);
        const clientId = typeof datos?.clientId === 'string' ? datos.clientId.slice(0, 64) : '';

        if (!['caja', 'pantalla', 'admin'].includes(tipo)) return responder({ ok: false, error: 'Tipo inválido' });
        if (tipo === 'admin' && !adminDeCookie(socket.handshake.headers.cookie)) {
          return responder({ ok: false, error: 'Sesión de administrador requerida' });
        }
        tiempoReal.liberarSocket(socket.id);   // si antes tenía otra caja, la suelta

        if (tipo === 'caja') {
          if (!esCajaValida(caja, configModel.getNumCajas())) return responder({ ok: false, error: `Esa caja no existe: hay ${configModel.getNumCajas()} cajas.` });
          if (!clientId) return responder({ ok: false, error: 'Falta identificador del equipo' });
          const r = tiempoReal.intentarOcupar(socket, caja, clientId);
          if (!r.ok) return responder(r);
        }
        presencia[socket.id] = { tipo, caja: tipo === 'caja' ? caja : null, lastHB: Date.now() };
        tiempoReal.emitirPresencia();
        responder({ ok: true });
      } catch (err) {
        console.error('Error en identificar:', err.message);
        responder({ ok: false, error: 'Error interno' });
      }
    });

    socket.on('heartbeat', () => {
      if (presencia[socket.id]) presencia[socket.id].lastHB = Date.now();
    });

    // Estado inicial para el cliente que se conecta
    socket.emit('estado_actualizado', turnoModel.getEstado());
    socket.emit('config_actualizada', configModel.getConfigPublica());

    socket.on('llamar_turno', (payload, callback) => {
      const responder = typeof callback === 'function' ? callback : () => {};
      try {
        const caja = parseInt(payload?.caja);
        if (!esCajaValida(caja, configModel.getNumCajas())) return responder({ ok: false, error: `Esa caja no existe: hay ${configModel.getNumCajas()} cajas.` });

        // Solo el equipo que ocupa la caja puede llamar turnos desde ella
        const occ = ocupacion[caja];
        if (!occ || occ.socketId !== socket.id) {
          return responder({ ok: false, error: `Este equipo no tiene asignada la Caja ${caja}.` });
        }
        // Anti-rebote en el servidor (además del cliente)
        const ahora = Date.now();
        if (ahora - ultimoLlamado < ANTIREBOTE_MS) return responder({ ok: false, error: 'Espera un momento antes de llamar otro turno.' });
        ultimoLlamado = ahora;

        const resultado = turnoModel.asignarTurno(caja);
        io.emit('nuevo_turno', { ...resultado, estado: turnoModel.getEstado() });
        responder({ ok: true, ...resultado });
        console.log(`Turno ${formatTurno(resultado.turno)} → Caja ${caja}`);
      } catch (err) {
        console.error('Error al asignar turno:', err.message);
        responder({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      tiempoReal.liberarSocket(socket.id);
      delete presencia[socket.id];
      tiempoReal.emitirPresencia();
      console.log(`[-] ${socket.id}`);
    });
  });

  // Revisar timeouts de heartbeat cada 12 s y re-emitir presencia
  setInterval(tiempoReal.emitirPresencia, 12000).unref();
}

module.exports = { registrar };
