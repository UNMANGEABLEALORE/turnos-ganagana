import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../controllers/useSocket';
import { formatTurno } from '../../models/formato';
import { validarCaja } from '../../models/validaciones';
import './CajaPage.css';

const CAJA_COLORES: Record<number, string> = { 1: 'sky', 2: 'mint', 3: 'lavender', 4: 'peach' };

export default function CajaPage() {
  const { id } = useParams();
  const cajaNum = parseInt(id ?? '', 10);
  const navigate = useNavigate();

  // Validar caja
  if (validarCaja(cajaNum) !== null) {   // validación lógica del parámetro de la URL
    navigate('/');
    return null;
  }

  const { connected, sinInternet, estado, config, cajasEstado, llamarTurno, bloqueoCaja, reintentarCaja } = useSocket({ tipo: 'caja', caja: cajaNum });
  const estaActiva = cajasEstado?.[cajaNum] !== 'inactiva';

  const [ultimoTurno, setUltimoTurno] = useState<number | null>(null);
  const [flash, setFlash]     = useState(false);
  const [error, setError]     = useState('');
  const [cargando, setCargando] = useState(false);

  // Anti-rebote: evitar múltiples pulsaciones de F9
  const bloqueado = useRef(false);
  const timerFlash = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Inicializar desde estado del servidor
  useEffect(() => {
    if (estado?.cajas?.[cajaNum]) {
      setUltimoTurno(estado.cajas[cajaNum]!.turno);
    }
  }, [estado, cajaNum]);

  const ejecutarLlamado = useCallback(async () => {
    if (bloqueado.current || cargando || !connected || sinInternet || !estaActiva || bloqueoCaja) return;

    bloqueado.current = true;
    setCargando(true);
    setError('');

    try {
      const resp = await llamarTurno(cajaNum);
      setUltimoTurno(resp.turno ?? null);

      // Flash de confirmación
      clearTimeout(timerFlash.current);
      setFlash(true);
      timerFlash.current = setTimeout(() => setFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar el turno');
    } finally {
      setCargando(false);
      // Desbloquear después de 800 ms para evitar rebote
      setTimeout(() => { bloqueado.current = false; }, 800);
    }
  }, [cajaNum, cargando, connected, sinInternet, llamarTurno, bloqueoCaja]);

  // Tecla F9 — solo cuando el foco NO está en un input/select/textarea
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F9') {
        const tag = document.activeElement?.tagName?.toLowerCase() ?? '';
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
      {/* Caja en uso por otra persona / equipo: se bloquea todo */}
      {bloqueoCaja && (
        <div className="caja-bloqueo" role="alertdialog" aria-live="assertive">
          <div className="caja-bloqueo-box">
            <div className="caja-bloqueo-icono">🔒</div>
            <h2>Caja {cajaNum} no disponible</h2>
            <p>{bloqueoCaja}</p>
            <p className="caja-bloqueo-sub">
              Si es un error, pide al administrador que libere la caja o intenta de nuevo.
            </p>
            <div className="caja-bloqueo-btns">
              <button className="btn btn-sky" onClick={reintentarCaja}>🔄 Reintentar</button>
              <button className="btn btn-peach" onClick={() => navigate('/')}>← Elegir otra caja</button>
            </div>
          </div>
        </div>
      )}
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

          {sinInternet && (
            <div className="caja-warn caja-warn--internet" role="alert">
              📡 <strong>Este equipo no tiene internet.</strong> No se puede llamar turnos ahora. Revisa el cable o el Wi-Fi: cuando vuelva la señal, la caja se reconecta sola y no se pierde ningún turno.
            </div>
          )}

          {!connected && !sinInternet && (
            <div className="caja-warn">
              ⚡ Sin conexión con el servidor. Reconectando automáticamente… espera antes de llamar un turno.
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
            disabled={!connected || sinInternet || cargando || !estaActiva || !!bloqueoCaja}
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
