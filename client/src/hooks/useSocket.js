import { useEffect, useState, useRef, useCallback } from 'react';
import socket from '../socket';

// Identificador del equipo/pestaña: sobrevive a recargas (sessionStorage) pero NO se
// comparte entre equipos ni entre pestañas distintas. Sirve para que el servidor
// distinga "la misma cajera que recargó" de "otra persona que quiere entrar".
function obtenerClientId() {
  let id = sessionStorage.getItem('gg_cid');
  if (!id) {
    id = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now());
    sessionStorage.setItem('gg_cid', id);
  }
  return id;
}

/**
 * useSocket({ tipo, caja })
 *   tipo: 'caja' | 'pantalla' | 'admin'
 *   caja: 1-4 (solo cuando tipo='caja')
 * bloqueoCaja: texto con el motivo si la caja está en uso por otro equipo (o se perdió).
 */
export function useSocket({ tipo = 'caja', caja = null } = {}) {
  const [connected,  setConnected]  = useState(socket.connected);
  const [estado,     setEstado]     = useState(null);
  const [config,     setConfig]     = useState(null);
  const [presencia,  setPresencia]  = useState(null);
  const [cajasEstado, setCajasEstado] = useState({ 1:'activa',2:'activa',3:'activa',4:'activa' });
  const [bloqueoCaja, setBloqueoCaja] = useState('');

  const hbRef = useRef(null);
  const desplazadaRef = useRef(false);   // si me quitaron la caja, no la recupero sola al reconectar
  const identificar = useCallback(() => {
    socket.emit('identificar', { tipo, caja, clientId: obtenerClientId() }, (resp) => {
      if (resp?.ok) setBloqueoCaja('');
      else if (tipo === 'caja') setBloqueoCaja(resp?.error || 'No se pudo ocupar la caja');
    });
  }, [tipo, caja]);

  useEffect(() => {
    function arrancar() {
      if (!desplazadaRef.current) identificar();
      clearInterval(hbRef.current);
      hbRef.current = setInterval(() => socket.emit('heartbeat'), 10000);
    }

    function onConnect()    { setConnected(true); arrancar(); }
    function onDisconnect() { setConnected(false); clearInterval(hbRef.current); }

    function onEstado(data) {
      setEstado(data);
      if (data.cajasEstado) setCajasEstado(data.cajasEstado);
    }

    function onNuevoTurno(data) {
      if (data.estado) {
        setEstado(data.estado);
        if (data.estado.cajasEstado) setCajasEstado(data.estado.cajasEstado);
      }
    }

    function onConfig(data)     { setConfig(data); }
    function onPresencia(data)  { setPresencia(data); }
    function onCajaEstado(data) {
      setCajasEstado(prev => ({ ...prev, [data.caja]: data.estado }));
    }
    // Otro equipo/pestaña tomó la caja, o el admin la liberó
    function onDesplazada(data) {
      if (tipo === 'caja' && data?.caja === caja) desplazadaRef.current = true;
      if (tipo === 'caja' && data?.caja === caja) setBloqueoCaja(data.motivo || 'Esta caja fue cerrada en este equipo.');
    }

    socket.on('connect',               onConnect);
    socket.on('disconnect',            onDisconnect);
    socket.on('estado_actualizado',    onEstado);
    socket.on('nuevo_turno',           onNuevoTurno);
    socket.on('config_actualizada',    onConfig);
    socket.on('presencia_actualizada', onPresencia);
    socket.on('caja_estado_cambiado',  onCajaEstado);
    socket.on('caja_desplazada',       onDesplazada);

    if (socket.connected) arrancar();   // ya conectado al montar

    return () => {
      clearInterval(hbRef.current);
      socket.off('connect',               onConnect);
      socket.off('disconnect',            onDisconnect);
      socket.off('estado_actualizado',    onEstado);
      socket.off('nuevo_turno',           onNuevoTurno);
      socket.off('config_actualizada',    onConfig);
      socket.off('presencia_actualizada', onPresencia);
      socket.off('caja_estado_cambiado',  onCajaEstado);
      socket.off('caja_desplazada',       onDesplazada);
    };
  }, [tipo, caja, identificar]);

  function llamarTurno(numCaja) {
    return new Promise((resolve, reject) => {
      if (!socket.connected) {
        reject(new Error('Sin conexión con el servidor'));
        return;
      }
      socket.emit('llamar_turno', { caja: numCaja }, (resp) => {
        if (resp?.ok) resolve(resp);
        else reject(new Error(resp?.error || 'Error desconocido'));
      });
    });
  }

  // Reintentar tomar la caja (botón "Reintentar" cuando estaba ocupada)
  function reintentarCaja() { desplazadaRef.current = false; if (socket.connected) identificar(); }

  return { connected, estado, config, presencia, cajasEstado, llamarTurno, bloqueoCaja, reintentarCaja };
}
