import { useEffect, useState, useRef } from 'react';
import socket from '../socket';

/**
 * useSocket({ tipo, caja })
 *   tipo: 'caja' | 'pantalla' | 'admin'
 *   caja: 1-4 (solo cuando tipo='caja')
 */
export function useSocket({ tipo = 'caja', caja = null } = {}) {
  const [connected,  setConnected]  = useState(socket.connected);
  const [estado,     setEstado]     = useState(null);
  const [config,     setConfig]     = useState(null);
  const [presencia,  setPresencia]  = useState(null);
  const [cajasEstado, setCajasEstado] = useState({ 1:'activa',2:'activa',3:'activa',4:'activa' });

  const hbRef = useRef(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      // Identificarse al servidor
      socket.emit('identificar', { tipo, caja });
      // Arrancar heartbeat
      hbRef.current = setInterval(() => socket.emit('heartbeat'), 10000);
    }

    function onDisconnect() {
      setConnected(false);
      clearInterval(hbRef.current);
    }

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

    socket.on('connect',               onConnect);
    socket.on('disconnect',            onDisconnect);
    socket.on('estado_actualizado',    onEstado);
    socket.on('nuevo_turno',           onNuevoTurno);
    socket.on('config_actualizada',    onConfig);
    socket.on('presencia_actualizada', onPresencia);
    socket.on('caja_estado_cambiado',  onCajaEstado);

    // Si ya está conectado al montar
    if (socket.connected) {
      socket.emit('identificar', { tipo, caja });
      hbRef.current = setInterval(() => socket.emit('heartbeat'), 10000);
    }

    return () => {
      clearInterval(hbRef.current);
      socket.off('connect',               onConnect);
      socket.off('disconnect',            onDisconnect);
      socket.off('estado_actualizado',    onEstado);
      socket.off('nuevo_turno',           onNuevoTurno);
      socket.off('config_actualizada',    onConfig);
      socket.off('presencia_actualizada', onPresencia);
      socket.off('caja_estado_cambiado',  onCajaEstado);
    };
  }, [tipo, caja]);

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

  return { connected, estado, config, presencia, cajasEstado, llamarTurno };
}
