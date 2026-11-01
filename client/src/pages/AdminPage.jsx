import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { formatTurno } from '../utils/formato';
import './AdminPage.css';

const SERVER = import.meta.env.VITE_SERVER_URL
  || (import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : window.location.origin);

const USUARIO_OK = 'Ganaadmin';
const CLAVE_OK   = 'Gana123';
const COOKIE_KEY = 'gana_admin_auth';

// ── Helpers de cookie ────────────────────────────────────────────────────────
function setCookie(name, value, days = 7) {
  const d = new Date();
  d.setTime(d.getTime() + days * 864e5);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Strict`;
}
function getCookie(name) {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] || null;
}
function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

// ── Login animado ────────────────────────────────────────────────────────────
function LoginAdmin({ onOk }) {
  const [usuario, setUsuario]  = useState('');
  const [pwd, setPwd]          = useState('');
  const [err, setErr]          = useState('');
  const [shake, setShake]      = useState(false);
  const [loading, setLoading]  = useState(false);
  const navigate               = useNavigate();

  function intentar(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (usuario === USUARIO_OK && pwd === CLAVE_OK) {
        setCookie(COOKIE_KEY, btoa(USUARIO_OK + ':' + CLAVE_OK), 7);
        onOk();
      } else {
        setErr('Usuario o contraseña incorrectos');
        setShake(true);
        setLoading(false);
        setTimeout(() => setShake(false), 600);
        setPwd('');
      }
    }, 700); // simular verificación
  }

  return (
    <div className="al-page">
      {/* Fondo animado con burbujas */}
      <div className="al-bubbles">
        {[...Array(8)].map((_, i) => <span key={i} className={`al-bubble al-bubble-${i+1}`} />)}
      </div>

      <div className={`al-box ${shake ? 'al-shake' : ''}`}>
        {/* Logo animado */}
        <div className="al-logo-wrap">
          <div className="al-logo">🎟️</div>
          <div className="al-logo-ring" />
        </div>

        <h1 className="al-title">GanaGana</h1>
        <p  className="al-subtitle">Panel Administrativo</p>

        <form onSubmit={intentar} autoComplete="off" className="al-form">
          <div className="al-field">
            <span className="al-field-icon">👤</span>
            <input
              type="text"
              value={usuario}
              onChange={e => { setUsuario(e.target.value); setErr(''); }}
              placeholder="Usuario"
              autoFocus
              required
            />
          </div>
          <div className="al-field">
            <span className="al-field-icon">🔑</span>
            <input
              type="password"
              value={pwd}
              onChange={e => { setPwd(e.target.value); setErr(''); }}
              placeholder="Contraseña"
              required
            />
          </div>

          {err && <div className="al-err"><span>⚠️</span> {err}</div>}

          <button type="submit" className={`al-btn ${loading ? 'al-btn--loading' : ''}`} disabled={loading}>
            {loading ? <span className="al-spinner" /> : 'Entrar al sistema'}
          </button>
        </form>

        <button className="al-back" onClick={() => navigate('/')}>← Volver al inicio</button>
      </div>
    </div>
  );
}

// ── Tarjeta de estado de una caja / pantalla ─────────────────────────────────
function TarjetaEstado({ titulo, icono, color, conectada, falla, detalle,
                          estadoAdmin, turno, onToggle, esPanel = false }) {
  let estadoLabel, estadoClass;
  if (falla)       { estadoLabel = 'FALLA'; estadoClass = 'ts-falla'; }
  else if (conectada) { estadoLabel = 'ACTIVA';    estadoClass = 'ts-activa'; }
  else             { estadoLabel = 'SIN CONEXIÓN'; estadoClass = 'ts-off'; }

  // Si el admin la desactivó, mostrar eso aunque esté conectada
  if (estadoAdmin === 'inactiva') {
    estadoLabel = 'DESACTIVADA'; estadoClass = 'ts-inactiva';
  }

  return (
    <div className={`ts-card ts-card--${color} ${falla ? 'ts-card--falla' : ''}`}>
      {falla && (
        <div className="ts-banner-error">
          ⚠️ <strong>ERROR:</strong> {detalle || 'Sin respuesta del cliente'}
        </div>
      )}
      <div className="ts-header">
        <span className="ts-icon">{icono}</span>
        <div>
          <div className="ts-titulo">{titulo}</div>
          <div className={`ts-estado-badge ${estadoClass}`}>{estadoLabel}</div>
        </div>
        {!esPanel && onToggle && (
          <button
            className={`ts-toggle ${estadoAdmin === 'activa' ? 'ts-toggle--on' : 'ts-toggle--off'}`}
            onClick={onToggle}
            title={estadoAdmin === 'activa' ? 'Desactivar caja' : 'Activar caja'}
          >
            {estadoAdmin === 'activa' ? '⏸ Desactivar' : '▶ Activar'}
          </button>
        )}
      </div>

      <div className="ts-info">
        {turno != null && (
          <div className="ts-turno-actual">
            <span className="ts-turno-label">Último turno</span>
            <span className="ts-turno-num">{formatTurno(turno)}</span>
          </div>
        )}
        <div className="ts-conn-dot-wrap">
          <span className={`ts-conn-dot ${conectada ? 'ts-conn-dot--on' : 'ts-conn-dot--off'}`} />
          <span className="ts-conn-txt">{conectada ? 'Conectada' : 'Sin conexión'}</span>
        </div>
      </div>
    </div>
  );
}

// ── Panel principal ──────────────────────────────────────────────────────────
function PanelAdmin({ onLogout }) {
  const navigate = useNavigate();
  const { connected, estado, config, presencia, cajasEstado } = useSocket({ tipo: 'admin' });

  const [historial,     setHistorial]     = useState([]);
  const [nombre,        setNombre]        = useState('');
  const [volumen,       setVolumen]       = useState(0.5);
  const [silencio,      setSilencio]      = useState(false);
  const [msgGuardar,    setMsgGuardar]    = useState('');
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [msgReset,      setMsgReset]      = useState('');
  const [errores,       setErrores]       = useState([]);

  // ── Atajo Ctrl+Shift+R → confirmar reset ──────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setConfirmReset(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Cargar historial ─────────────────────────────────────────────────────
  useEffect(() => {
    cargarHistorial();
  }, []);

  useEffect(() => {
    if (estado) cargarHistorial();
  }, [estado]);

  function cargarHistorial() {
    fetch(`${SERVER}/api/historial?limit=100`)
      .then(r => r.json()).then(setHistorial).catch(() => {});
  }

  // ── Sincronizar config ────────────────────────────────────────────────────
  useEffect(() => {
    if (!config) return;
    setNombre(config.establecimiento || '');
    setVolumen(config.volumen ?? 0.5);
    setSilencio(config.silencio ?? false);
  }, [config]);

  // ── Detectar errores desde presencia ─────────────────────────────────────
  useEffect(() => {
    if (!presencia) return;
    const nuevosErrores = [];
    for (let i = 1; i <= 4; i++) {
      const c = presencia.cajas?.[i];
      if (c?.falla) nuevosErrores.push({ tipo: `Caja ${i}`, detalle: c.detalle });
    }
    if (presencia.pantalla?.falla) {
      nuevosErrores.push({ tipo: 'Pantalla Pública', detalle: presencia.pantalla.detalle });
    }
    setErrores(nuevosErrores);
  }, [presencia]);

  async function guardarConfig() {
    try {
      const res = await fetch(`${SERVER}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ establecimiento: nombre, volumen, silencio })
      });
      if (res.ok) { setMsgGuardar('✅ Guardado'); setTimeout(() => setMsgGuardar(''), 3000); }
    } catch { setMsgGuardar('❌ Error al guardar'); }
  }

  async function reiniciarContador() {
    try {
      await fetch(`${SERVER}/api/reset`, { method: 'POST' });
      setMsgReset('✅ Contador reiniciado a 000');
      setConfirmReset(false);
      setTimeout(() => setMsgReset(''), 4000);
      cargarHistorial();
    } catch { setMsgReset('❌ Error'); }
  }

  async function toggleCaja(caja) {
    const actual  = cajasEstado[caja] || 'activa';
    const nuevo   = actual === 'activa' ? 'inactiva' : 'activa';
    await fetch(`${SERVER}/api/caja/${caja}/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevo })
    });
  }

  const CAJA_INFO = [
    { num: 1, color: 'sky',      icono: '🖥️' },
    { num: 2, color: 'mint',     icono: '🖥️' },
    { num: 3, color: 'lavender', icono: '🖥️' },
    { num: 4, color: 'peach',    icono: '🖥️' },
  ];

  return (
    <div className="admin-page">
      {/* ── Topbar ──────────────────────────────────────────────────── */}
      <header className="admin-header">
        <div className="admin-header-brand">
          <span className="admin-header-logo">🎟️</span>
          <span>GanaGana · Admin</span>
        </div>
        <div className="admin-header-center">
          {!connected && (
            <span className="admin-offline-badge">⚡ Sin conexión al servidor</span>
          )}
        </div>
        <div className="admin-header-actions">
          <div className={`badge-conn ${connected ? 'online' : 'offline'}`}>
            <span className="dot" />
            {connected ? 'En línea' : 'Desconectado'}
          </div>
          <button className="al-back" onClick={() => { deleteCookie(COOKIE_KEY); onLogout(); }}>
            🚪 Salir
          </button>
        </div>
      </header>

      <div className="admin-content" style={{ maxWidth: 1100 }}>

        {/* ── Banner de errores ──────────────────────────────────────── */}
        {errores.length > 0 && (
          <div className="admin-error-banner">
            <div className="admin-error-banner-title">🚨 Alertas del sistema</div>
            {errores.map((e, i) => (
              <div key={i} className="admin-error-item">
                <strong>{e.tipo}</strong>: {e.detalle}
              </div>
            ))}
          </div>
        )}

        {/* ── Dashboard: cajas + pantalla ────────────────────────────── */}
        <section className="card admin-section">
          <h2>Estado del sistema en tiempo real</h2>

          <div className="admin-dashboard-grid">
            {CAJA_INFO.map(({ num, color, icono }) => (
              <TarjetaEstado
                key={num}
                titulo={`Caja ${num}`}
                icono={icono}
                color={color}
                conectada={presencia?.cajas?.[num]?.conectada ?? false}
                falla={presencia?.cajas?.[num]?.falla ?? false}
                detalle={presencia?.cajas?.[num]?.detalle ?? ''}
                estadoAdmin={cajasEstado[num] || 'activa'}
                turno={estado?.cajas?.[num]?.turno ?? null}
                onToggle={() => toggleCaja(num)}
              />
            ))}

            {/* Pantalla pública */}
            <TarjetaEstado
              titulo="Pantalla Pública"
              icono="📺"
              color="rose"
              conectada={presencia?.pantalla?.conectada ?? false}
              falla={presencia?.pantalla?.falla ?? false}
              detalle={presencia?.pantalla?.detalle ?? ''}
              estadoAdmin="activa"
              turno={estado?.ultimos?.[0]?.turno ?? null}
              esPanel
            />

            {/* Tarjeta resumen */}
            <div className="ts-card ts-card--summary">
              <div className="ts-header">
                <span className="ts-icon">📊</span>
                <div>
                  <div className="ts-titulo">Contador global</div>
                  <div className="ts-estado-badge ts-activa">ACTIVO</div>
                </div>
              </div>
              <div className="ts-turno-actual" style={{ margin: '16px 0 0' }}>
                <span className="ts-turno-label">Próximo turno</span>
                <span className="ts-turno-num" style={{ fontSize: '3rem' }}>
                  {formatTurno(estado?.contador)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── BOTÓN ROJO RESET ──────────────────────────────────────── */}
        <section className="card admin-section admin-reset-section">
          <div className="admin-reset-content">
            <div>
              <h2 style={{ marginBottom: 6 }}>Reiniciar contador de turnos</h2>
              <p className="admin-warn-txt">
                Vuelve la numeración a 000. Solo para inicio de jornada.<br />
                Atajo de teclado: <kbd>Ctrl + Shift + R</kbd>
              </p>
              {msgReset && <p className="admin-msg">{msgReset}</p>}
            </div>

            {!confirmReset ? (
              <button
                className="btn-reset-rojo"
                onClick={() => setConfirmReset(true)}
                title="Ctrl+Shift+R"
              >
                🔴 REINICIAR
              </button>
            ) : (
              <div className="reset-confirm-inline">
                <p>¿Confirmas reiniciar a <strong>000</strong>?</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-reset-rojo" onClick={reiniciarContador}>
                    ✅ Confirmar
                  </button>
                  <button className="btn btn-sky" onClick={() => setConfirmReset(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Configuración ─────────────────────────────────────────── */}
        <section className="card admin-section">
          <h2>Configuración general</h2>
          <div className="form-group">
            <label>Nombre del establecimiento</label>
            <input type="text" value={nombre}
              onChange={e => setNombre(e.target.value)} maxLength={60}
              placeholder="Ej: GanaGana Centro" />
          </div>
          <div className="form-group">
            <label>Volumen del sonido</label>
            <div className="volumen-row">
              <input type="range" min="0" max="1" step="0.05" value={volumen}
                onChange={e => setVolumen(parseFloat(e.target.value))} />
              <span className="volumen-val">{Math.round(volumen * 100)}%</span>
            </div>
          </div>
          <div className="form-group check-row">
            <label>
              <input type="checkbox" checked={silencio}
                onChange={e => setSilencio(e.target.checked)} />
              &nbsp; Silenciar alerta sonora
            </label>
          </div>
          <button className="btn btn-mint" onClick={guardarConfig}>💾 Guardar</button>
          {msgGuardar && <p className="admin-msg">{msgGuardar}</p>}
        </section>

        {/* ── URLs de acceso ─────────────────────────────────────────── */}
        <section className="card admin-section">
          <h2>URLs de acceso en la red</h2>
          <div className="admin-urls">
            {[1,2,3,4].map(c => (
              <div key={c} className="admin-url-row">
                <span className="admin-url-label">Caja {c}</span>
                <code className="admin-url-code">
                  {`${window.location.protocol}//${window.location.hostname}:5173/caja/${c}`}
                </code>
              </div>
            ))}
            <div className="admin-url-row">
              <span className="admin-url-label">📺 Pantalla pública</span>
              <code className="admin-url-code">
                {`${window.location.protocol}//${window.location.hostname}:5173/pantalla`}
              </code>
            </div>
          </div>
        </section>

        {/* ── Historial ─────────────────────────────────────────────── */}
        <section className="card admin-section">
          <h2>Historial <span className="historial-count">({historial.length} turnos)</span></h2>
          <div className="historial-table-wrap">
            <table className="historial-table">
              <thead>
                <tr><th>#</th><th>Turno</th><th>Caja</th><th>Hora</th></tr>
              </thead>
              <tbody>
                {historial.length === 0 && (
                  <tr><td colSpan={4} className="historial-empty">Sin registros aún</td></tr>
                )}
                {historial.map((row, i) => (
                  <tr key={row.id}>
                    <td>{i + 1}</td>
                    <td className="historial-turno">{formatTurno(row.turno)}</td>
                    <td>Caja {row.caja}</td>
                    <td className="historial-hora">{row.llamado_en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}

// ── Exportación con cookie ────────────────────────────────────────────────────
export default function AdminPage() {
  const cookieOk = getCookie(COOKIE_KEY) === btoa(USUARIO_OK + ':' + CLAVE_OK);
  const [autenticado, setAutenticado] = useState(cookieOk);

  if (!autenticado) return <LoginAdmin onOk={() => setAutenticado(true)} />;
  return <PanelAdmin onLogout={() => setAutenticado(false)} />;
}
