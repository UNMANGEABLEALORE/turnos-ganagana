import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { formatTurno } from '../utils/formato';
import './CajaPage.css';

const CAJA_COLORES = { 1: 'sky', 2: 'mint', 3: 'lavender', 4: 'peach' };

export default function CajaPage() {
  const { id } = useParams();
  const cajaNum = parseInt(id, 10);
  const navigate = useNavigate();

  // Validar caja
  if (![1, 2, 3, 4].includes(cajaNum)) {
    navigate('/');
    return null;
  }

  const { connected, estado, config, cajasEstado, llamarTurno } = useSocket({ tipo: 'caja', caja: cajaNum });
  const estaActiva = cajasEstado?.[cajaNum] !== 'inactiva';

  const [ultimoTurno, setUltimoTurno] = useState(null);
  const [flash, setFlash]     = useState(false);
  const [error, setError]     = useState('');
  const [cargando, setCargando] = useState(false);

  // Anti-rebote: evitar múltiples pulsaciones de F9
  const bloqueado = useRef(false);
  const timerFlash = useRef(null);

  // Inicializar desde estado del servidor
  useEffect(() => {
    if (estado?.cajas?.[cajaNum]) {
      setUltimoTurno(estado.cajas[cajaNum].turno);
    }
  }, [estado, cajaNum]);

  const ejecutarLlamado = useCallback(async () => {
    if (bloqueado.current || cargando || !connected || !estaActiva) return;

    bloqueado.current = true;
    setCargando(true);
    setError('');

    try {
      const resp = await llamarTurno(cajaNum);
      setUltimoTurno(resp.turno);

      // Flash de confirmación
      clearTimeout(timerFlash.current);
      setFlash(true);
      timerFlash.current = setTimeout(() => setFlash(false), 1500);
    } catch (err) {
      setError(err.message || 'No se pudo asignar el turno');
    } finally {
      setCargando(false);
      // Desbloquear después de 800 ms para evitar rebote
      setTimeout(() => { bloqueado.current = false; }, 800);
    }
  }, [cajaNum, cargando, connected, llamarTurno]);

  // Tecla F9 — solo cuando el foco NO está en un input/select/textarea
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'F9') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (['input', 'select', 'textarea'].includes(tag)) return;
        e.preventDefault();
        ejecutarLlamado();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ejecutarLlamado]);

  const color = CAJA_COLORES[cajaNum] || 'sky';

  // Próximos turnos globales (los más recientes)
  const ultimos = estado?.ultimos || [];
  const contador = estado?.contador ?? '?';

  return (
    <div className={`caja-page caja-bg-${color}`}>
      {/* Header */}
      <header className="caja-header">
        <button className="btn-back" onClick={() => navigate('/')} title="Volver al selector">
          ← Inicio
        </button>
        <div className="caja-header-title">
          <span className="caja-badge">CAJA {cajaNum}</span>
          {config?.establecimiento && (
            <span className="caja-estab">{config.establecimiento}</span>
          )}
        </div>
        <div className={`badge-conn ${connected ? 'online' : 'offline'}`}>
          <span className="dot" />
          {connected ? 'Conectada' : 'Sin conexión'}
        </div>
      </header>

      {/* Área principal */}
      <main className="caja-main">
        {/* Turno actual de esta caja */}
        <div className={`card turno-card ${flash ? 'flash' : ''}`}>
          <p className="turno-label">Turno en atención</p>
          <div className="turno-numero">
            {ultimoTurno != null ? formatTurno(ultimoTurno) : '---'}
          </div>
          {ultimoTurno != null && (
            <p className="turno-caja-txt">Caja {cajaNum}</p>
          )}
        </div>

        {/* Botón y tecla */}
        <div className="caja-accion">
          {error && (
            <div className="caja-error">⚠️ {error}</div>
          )}

          {!connected && (
            <div className="caja-warn">
              ⚡ Sin conexión con el servidor. Espera a reconectar antes de llamar un turno.
            </div>
          )}

          {!estaActiva && (
            <div className="caja-warn" style={{ background: '#fff0cc', color: '#7a5500' }}>
              🔒 Esta caja ha sido desactivada por el administrador.
            </div>
          )}

          <button
            className={`btn btn-${color} btn-llamar`}
            onClick={ejecutarLlamado}
            disabled={!connected || cargando || !estaActiva}
          >
            {cargando ? '⏳ Asignando...' : '📣 Llamar siguiente turno'}
          </button>

          <div className="tecla-hint">
            También puedes presionar <kbd>F9</kbd>
          </div>
        </div>

        {/* Estado general */}
        <div className="card estado-card">
          <h3>Estado de las cajas</h3>
          <div className="estado-grid">
            {[1, 2, 3, 4].map(c => {
              const info = estado?.cajas?.[c];
              const esEsta = c === cajaNum;
              return (
                <div key={c} className={`estado-item ${esEsta ? 'estado-item--mine' : ''}`}>
                  <span className="estado-caja-num">Caja {c}</span>
                  <span className="estado-caja-turno">
                    {info ? formatTurno(info.turno) : '---'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="estado-contador">
            Próximo disponible: <strong>{formatTurno(contador)}</strong>
          </p>
        </div>
      </main>
    </div>
  );
}
