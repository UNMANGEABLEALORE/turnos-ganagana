import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { formatTurno } from '../utils/formato';
import './AdminPage.css';

// En desarrollo Vite hace proxy de /api → así la cookie de sesión es del mismo origen.
const SERVER = import.meta.env.VITE_SERVER_URL || '';

// ── Cliente API (la sesión viaja en una cookie HttpOnly, no se guarda nada en JS) ──
async function api(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${SERVER}${ruta}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { ok: res.ok, status: res.status, data };
}

function saludoHora() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
}

// ── hCaptcha (verificado también en el servidor) ─────────────────────────────
function useCaptcha(sitekey) {
  const ref      = useRef(null);
  const widgetId = useRef(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!sitekey) return;
    let vivo = true;
    function render() {
      if (!vivo || !ref.current || widgetId.current !== null || !window.hcaptcha) return false;
      widgetId.current = window.hcaptcha.render(ref.current, {
        sitekey, theme: 'light',
        callback: t => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken('')
      });
      return true;
    }
    if (!document.getElementById('hcaptcha-script')) {
      const s = document.createElement('script');
      s.id = 'hcaptcha-script';
      s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
    if (!render()) {
      const t = setInterval(() => { if (render()) clearInterval(t); }, 300);
      return () => { vivo = false; clearInterval(t); };
    }
    return () => { vivo = false; };
  }, [sitekey]);

  return {
    ref, token,
    reset: () => {
      if (window.hcaptcha && widgetId.current !== null) window.hcaptcha.reset(widgetId.current);
      setToken('');
    }
  };
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginAdmin({ onOk }) {
  const [cfg,        setCfg]        = useState(null);
  const [usuario,    setUsuario]    = useState('');
  const [pwd,        setPwd]        = useState('');
  const [consent,    setConsent]    = useState(false);
  const [err,        setErr]        = useState('');
  const [shake,      setShake]      = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [mostrarPwd, setMostrarPwd] = useState(false);
  const [espera,     setEspera]     = useState(0);
  const navigate = useNavigate();
  const captcha  = useCaptcha(cfg?.hcaptchaSitekey);

  useEffect(() => {
    api('/api/auth/config').then(r => setCfg(r.data)).catch(() => {});
    const e = new URLSearchParams(window.location.search).get('error');
    if (e) { setErr(e); window.history.replaceState({}, '', '/admin'); }
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function fallar(msg) {
    setErr(msg); setShake(true);
    setTimeout(() => setShake(false), 600);
    captcha.reset(); setLoading(false); setPwd('');
  }

  async function intentar(e) {
    e.preventDefault();
    if (espera > 0) return;
    if (!consent) { setErr('Debes autorizar el tratamiento de tus datos personales.'); return; }
    if (!captcha.token) { setErr('Completa la verificación CAPTCHA.'); return; }
    setLoading(true); setErr('');
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: { usuario, clave: pwd, captcha: captcha.token, consentimiento: true }
    });
    if (r.ok) { onOk(r.data.admin); return; }
    if (r.status === 429) setEspera(r.data.espera || 60);
    fallar(r.data.error || 'No se pudo iniciar sesión.');
  }

  function oauth(prov) {
    if (!consent) { setErr('Debes autorizar el tratamiento de tus datos personales.'); return; }
    window.location.href = `${SERVER}/api/auth/oauth/${prov}?consent=1`;
  }

  return (
    <div className="al-page">
      <div className="al-particles">
        {[...Array(14)].map((_, i) => <span key={i} className={`al-particle al-p-${i + 1}`} />)}
      </div>
      <div className="al-diagonal" />

      <div className={`al-box ${shake ? 'al-shake' : ''}`}>
        <div className="al-logo-wrap">
          <div className="al-ring al-ring-1" />
          <div className="al-ring al-ring-2" />
          <img className="al-logo-img" src="/icono.png" alt="Logo GanaGana" width="76" height="76" />
        </div>

        <h1 className="al-title">GanaGana</h1>
        <p className="al-subtitle">Acceso de administradores · Sistema de Turnos</p>
        <div className="al-divider" />

        {espera > 0 ? (
          <div className="al-blocked">
            🔒 Demasiados intentos fallidos<br />
            <span>Podrás intentar de nuevo en <strong>{espera}s</strong></span>
          </div>
        ) : (
          <form onSubmit={intentar} className="al-form">
            <div className="al-field">
              <span className="al-field-icon">👤</span>
              <input type="text" value={usuario} placeholder="Usuario administrador"
                onChange={e => { setUsuario(e.target.value); setErr(''); }}
                autoFocus required autoComplete="username" maxLength={24} />
            </div>

            <div className="al-field">
              <span className="al-field-icon">🔑</span>
              <input type={mostrarPwd ? 'text' : 'password'} value={pwd} placeholder="Contraseña"
                onChange={e => { setPwd(e.target.value); setErr(''); }}
                required autoComplete="current-password" maxLength={100} />
              <button type="button" className="al-eye" onClick={() => setMostrarPwd(v => !v)}
                aria-label="Mostrar u ocultar contraseña">{mostrarPwd ? '🙈' : '👁️'}</button>
            </div>

            <label className="al-consent">
              <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setErr(''); }} />
              <span>
                Autorizo el tratamiento de mis datos personales (nombre y correo) para
                identificarme como administrador, según la{' '}
                <a href="https://www.ganagana.com.co/cumplimiento-normativo/?tab=3"
                   target="_blank" rel="noopener noreferrer">Política de Datos GanaGana</a>{' '}
                (Ley 1581 de 2012).
              </span>
            </label>

            <div className="al-captcha-wrap">
              <div ref={captcha.ref} />
              {cfg?.hcaptchaPrueba && <p className="al-captcha-hint">CAPTCHA en modo de prueba</p>}
            </div>

            {err && <div className="al-err" role="alert"><span>⚠️</span> {err}</div>}

            <button type="submit" className={`al-btn ${loading ? 'al-btn--loading' : ''}`}
              disabled={loading || !captcha.token || !consent}>
              {loading ? <><span className="al-spinner" /> Verificando...</> : '🔐 Acceder al panel'}
            </button>

            <div className="al-or"><span>o continúa con</span></div>
            <div className="al-oauth">
              <button type="button" className="al-oauth-btn" onClick={() => oauth('google')}
                disabled={!cfg?.google} title={cfg?.google ? '' : 'Google no está configurado en el servidor'}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
                  <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
                </svg>
                Google
              </button>
              <button type="button" className="al-oauth-btn" onClick={() => oauth('github')}
                disabled={!cfg?.github} title={cfg?.github ? '' : 'GitHub no está configurado en el servidor'}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                GitHub
              </button>
            </div>
          </form>
        )}

        <div className="al-footer-links">
          <button className="al-back" onClick={() => navigate('/')}>← Volver al inicio</button>
          <span className="al-security-badge">
            🔒 {window.location.protocol === 'https:' ? 'Conexión segura · HTTPS' : 'Conexión local · sin HTTPS'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Bienvenida post-login (según el administrador) ───────────────────────────
function BienvenidaModal({ admin, onCerrar }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, 5000);
    return () => clearTimeout(t);
  }, []);

  const primerNombre = admin.nombre.split(' ')[0];
  return (
    <div className="bv-overlay">
      <div className="bv-card">
        <div className="bv-avatar">{admin.avatar}</div>
        <div className="bv-saludo">¡{saludoHora()}, {primerNombre}!</div>
        <div className="bv-nombre">{admin.nombre}</div>
        <div className="bv-rol">{admin.rol}</div>
        <p className="bv-msg">{admin.saludo}</p>
        <div className="bv-progress"><div className="bv-progress-bar" /></div>
        <button className="bv-skip" onClick={onCerrar}>Continuar →</button>
      </div>
    </div>
  );
}

// ── Tarjeta de estado ─────────────────────────────────────────────────────────
function TarjetaEstado({ titulo, icono, color, conectada, falla, detalle,
                          estadoAdmin, turno, onToggle, esPanel = false }) {
  let label, cls;
  if (estadoAdmin === 'inactiva') { label = 'DESACTIVADA'; cls = 'ts-inactiva'; }
  else if (falla)                  { label = 'FALLA';        cls = 'ts-falla';    }
  else if (conectada)              { label = 'ACTIVA';       cls = 'ts-activa';   }
  else                             { label = 'SIN CONEXIÓN'; cls = 'ts-off';      }

  return (
    <div className={`ts-card ts-card--${color} ${falla ? 'ts-card--falla' : ''}`}>
      {falla && (
        <div className="ts-banner-error">
          ⚠️ <strong>ERROR:</strong> {detalle || 'Sin respuesta del cliente'}
        </div>
      )}
      <div className="ts-header">
        <span className="ts-icon">{icono}</span>
        <div style={{ flex: 1 }}>
          <div className="ts-titulo">{titulo}</div>
          <div className={`ts-estado-badge ${cls}`}>{label}</div>
        </div>
        {!esPanel && onToggle && (
          <button
            className={`ts-toggle ${estadoAdmin === 'activa' ? 'ts-toggle--on' : 'ts-toggle--off'}`}
            onClick={onToggle}
          >
            {estadoAdmin === 'activa' ? '⏸' : '▶'}
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


// ── PANEL PRINCIPAL ────────────────────────────────────────────────────────────
function PanelAdmin({ admin, onLogout, onActualizar, recienIngresado }) {
  const { connected, estado, config, presencia, cajasEstado } = useSocket({ tipo: 'admin' });
  const [historial,    setHistorial]    = useState([]);
  const [nombre,       setNombre]       = useState('');
  const [volumen,      setVolumen]      = useState(1);
  const [silencio,     setSilencio]     = useState(false);
  const [msgGuardar,   setMsgGuardar]   = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [msgReset,     setMsgReset]     = useState('');
  const [errores,      setErrores]      = useState([]);
  const [mostrarBv,    setMostrarBv]    = useState(recienIngresado);

  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault(); setConfirmReset(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { cargarHistorial(); }, []);
  useEffect(() => { if (estado) cargarHistorial(); }, [estado]);

  function cargarHistorial() {
    api('/api/historial?limit=100').then(r => {
      if (r.status === 401) onLogout(); else if (r.ok) setHistorial(r.data);
    });
  }

  useEffect(() => {
    if (!config) return;
    setNombre(config.establecimiento || '');
    setVolumen(config.volumen ?? 1);
    setSilencio(config.silencio ?? false);
  }, [config]);

  useEffect(() => {
    if (!presencia) return;
    const e = [];
    for (let i = 1; i <= 4; i++) {
      if (presencia.cajas?.[i]?.falla)
        e.push({ tipo: `Caja ${i}`, detalle: presencia.cajas[i].detalle });
    }
    if (presencia.pantalla?.falla)
      e.push({ tipo: 'Pantalla Pública', detalle: presencia.pantalla.detalle });
    setErrores(e);
  }, [presencia]);

  async function guardarConfig() {
    const res = await api('/api/config', { method: 'POST', body: { establecimiento: nombre, volumen, silencio } });
    if (res.status === 401) return onLogout();
    if (res.ok) { setMsgGuardar('✅ Cambios guardados'); setTimeout(() => setMsgGuardar(''), 3000); }
  }

  async function reiniciar() {
    await api('/api/reset', { method: 'POST' });
    setMsgReset('✅ Contador reiniciado a 000');
    setConfirmReset(false);
    setTimeout(() => setMsgReset(''), 4000);
    cargarHistorial();
  }

  async function toggleCaja(caja) {
    const nuevo = (cajasEstado[caja] || 'activa') === 'activa' ? 'inactiva' : 'activa';
    await api(`/api/caja/${caja}/estado`, { method: 'POST', body: { estado: nuevo } });
  }

  const CAJAS = [
    { num: 1, color: 'gg-1', icono: '🖥️' },
    { num: 2, color: 'gg-2', icono: '🖥️' },
    { num: 3, color: 'gg-3', icono: '🖥️' },
    { num: 4, color: 'gg-4', icono: '🖥️' },
  ];

  return (
    <div className="admin-page">
      {mostrarBv && (
        <BienvenidaModal admin={admin} onCerrar={() => setMostrarBv(false)} />
      )}

      {/* ── Header GanaGana ──────────────────────────────────────── */}
      <header className="admin-header">
        <div className="admin-header-brand">
          <img className="admin-header-gg" src="/icono.png" alt="GanaGana" width="40" height="40" />
          <div>
            <div className="admin-header-title">GanaGana</div>
            <div className="admin-header-sub">Panel de Administración</div>
          </div>
        </div>

        <div className="admin-header-center">
          {!connected && (
            <span className="admin-offline-badge">⚡ Sin conexión al servidor</span>
          )}
        </div>

        <div className="admin-header-right">
          <div className="admin-user-chip">
            <span>{admin.avatar}</span>
            <div>
              <div className="admin-user-name">{admin.nombre}</div>
              <div className="admin-user-rol">{admin.rol}</div>
            </div>
          </div>
          <div className={`badge-conn ${connected ? 'online' : 'offline'}`}>
            <span className="dot" />
            {connected ? 'En línea' : 'Desconectado'}
          </div>
          <button className="admin-logout-btn"
            onClick={onLogout}>
            🚪 Salir
          </button>
        </div>
      </header>

      <div className="admin-content">

        {/* Errores */}
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

        <MiCuenta admin={admin} onActualizar={onActualizar} />

        {/* Dashboard */}
        <section className="card admin-section">
          <h2>Estado del sistema en tiempo real</h2>
          <div className="admin-dashboard-grid">
            {CAJAS.map(({ num, color, icono }) => (
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
            <TarjetaEstado
              titulo="Pantalla Pública"
              icono="📺"
              color="gg-pantalla"
              conectada={presencia?.pantalla?.conectada ?? false}
              falla={presencia?.pantalla?.falla ?? false}
              detalle={presencia?.pantalla?.detalle ?? ''}
              estadoAdmin="activa"
              turno={estado?.ultimos?.[0]?.turno ?? null}
              esPanel
            />
            <div className="ts-card ts-card--gg-summary">
              <div className="ts-header">
                <span className="ts-icon">📊</span>
                <div>
                  <div className="ts-titulo">Contador Global</div>
                  <div className="ts-estado-badge ts-activa">ACTIVO</div>
                </div>
              </div>
              <div className="ts-turno-actual" style={{ padding: '0 16px 16px' }}>
                <span className="ts-turno-label">Próximo turno</span>
                <span className="ts-turno-num" style={{ fontSize: '3rem' }}>
                  {formatTurno(estado?.contador)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Botón ROJO reset */}
        <section className="card admin-section admin-reset-section">
          <div className="admin-reset-content">
            <div>
              <h2 style={{ marginBottom: 6 }}>Reiniciar contador</h2>
              <p className="admin-warn-txt">
                Vuelve la numeración a 000. Solo al inicio de la jornada.<br />
                Atajo: <kbd>Ctrl + Shift + R</kbd>
              </p>
              {msgReset && <p className="admin-msg">{msgReset}</p>}
            </div>
            {!confirmReset ? (
              <button className="btn-reset-rojo" onClick={() => setConfirmReset(true)}>
                🔴 REINICIAR
              </button>
            ) : (
              <div className="reset-confirm-inline">
                <p>¿Confirmas reiniciar a <strong>000</strong>?</p>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn-reset-rojo" onClick={reiniciar}>✅ Confirmar</button>
                  <button className="btn btn-sky" onClick={() => setConfirmReset(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Configuración */}
        <section className="card admin-section">
          <h2>Configuración general</h2>
          <div className="form-group">
            <label>Nombre del establecimiento</label>
            <input type="text" value={nombre}
              onChange={e => setNombre(e.target.value)} maxLength={60}
              placeholder="Ej: GanaGana Centro" />
          </div>
          <div className="form-group">
            <label>Volumen del sonido de turnos (100% = máximo y amplificado)</label>
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
          <button className="btn-gg-primary" onClick={guardarConfig}>💾 Guardar cambios</button>
          {msgGuardar && <p className="admin-msg">{msgGuardar}</p>}
        </section>

        {/* URLs */}
        <section className="card admin-section">
          <h2>URLs de acceso</h2>
          <div className="admin-urls">
            {[1,2,3,4].map(c => (
              <div key={c} className="admin-url-row">
                <span className="admin-url-label">🖥️ Caja {c}</span>
                <code className="admin-url-code">
                  {`${window.location.origin}/caja/${c}`}
                </code>
              </div>
            ))}
            <div className="admin-url-row">
              <span className="admin-url-label">📺 Pantalla pública</span>
              <code className="admin-url-code">{`${window.location.origin}/pantalla`}</code>
            </div>
          </div>
        </section>

        <Administradores admin={admin} />

        {/* Historial */}
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


// ── Mi cuenta: contraseña y vínculos con Google / GitHub ─────────────────────
function MiCuenta({ admin, onActualizar }) {
  const [actual, setActual] = useState('');
  const [nueva,  setNueva]  = useState('');
  const [email,  setEmail]  = useState(admin.emails?.[0] || '');
  const [github, setGithub] = useState(admin.github || '');
  const [msg,    setMsg]    = useState('');

  async function cambiarClave(e) {
    e.preventDefault();
    const r = await api('/api/auth/me/clave', { method: 'POST', body: { actual, nueva } });
    setMsg(r.ok ? '✅ Contraseña actualizada' : `⚠️ ${r.data.error}`);
    if (r.ok) { setActual(''); setNueva(''); onActualizar({ ...admin, debeCambiar: false }); }
  }
  async function vincular(e) {
    e.preventDefault();
    const r = await api('/api/auth/me/vinculos', { method: 'POST', body: { email, github } });
    setMsg(r.ok ? '✅ Cuentas vinculadas' : `⚠️ ${r.data.error}`);
    if (r.ok) onActualizar(r.data.admin);
  }

  return (
    <section className="card admin-section">
      <h2>Mi cuenta · {admin.nombre}</h2>
      {admin.debeCambiar && (
        <div className="admin-warn-box">⚠️ Tu contraseña es la inicial. Cámbiala ahora.</div>
      )}
      <div className="admin-two-col">
        <form onSubmit={cambiarClave}>
          <div className="form-group"><label>Contraseña actual</label>
            <input type="password" value={actual} onChange={e => setActual(e.target.value)} autoComplete="current-password" required /></div>
          <div className="form-group"><label>Nueva contraseña (8+, letras y números)</label>
            <input type="password" value={nueva} onChange={e => setNueva(e.target.value)} autoComplete="new-password" required minLength={8} /></div>
          <button className="btn-gg-primary" type="submit">🔑 Cambiar contraseña</button>
        </form>
        <form onSubmit={vincular}>
          <div className="form-group"><label>Correo de Google (para entrar con Google)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tucorreo@gmail.com" /></div>
          <div className="form-group"><label>Usuario de GitHub (para entrar con GitHub)</label>
            <input type="text" value={github} onChange={e => setGithub(e.target.value)} placeholder="tu-usuario" maxLength={39} /></div>
          <button className="btn-gg-primary" type="submit">🔗 Guardar vínculos</button>
        </form>
      </div>
      {msg && <p className="admin-msg">{msg}</p>}
    </section>
  );
}

// ── Administradores (solo el principal puede crear / eliminar) ───────────────
function Administradores({ admin }) {
  const [lista, setLista] = useState([]);
  const [f, setF] = useState({ nombre: '', usuario: '', clave: '', rol: 'Administrador', email: '', github: '' });
  const [msg, setMsg] = useState('');

  const cargar = () => api('/api/auth/admins').then(r => r.ok && setLista(r.data));
  useEffect(() => { cargar(); }, []);
  const set = k => e => setF({ ...f, [k]: e.target.value });

  async function crear(e) {
    e.preventDefault();
    const r = await api('/api/auth/admins', { method: 'POST', body: f });
    setMsg(r.ok ? `✅ Administrador ${r.data.admin.nombre} creado` : `⚠️ ${r.data.error}`);
    if (r.ok) { setF({ nombre: '', usuario: '', clave: '', rol: 'Administrador', email: '', github: '' }); cargar(); }
  }
  async function eliminar(a) {
    if (!window.confirm(`¿Eliminar a ${a.nombre}?`)) return;
    const r = await api(`/api/auth/admins/${a.id}`, { method: 'DELETE' });
    setMsg(r.ok ? '✅ Administrador eliminado' : `⚠️ ${r.data.error}`);
    cargar();
  }

  return (
    <section className="card admin-section">
      <h2>Administradores <span className="historial-count">({lista.length})</span></h2>
      <div className="historial-table-wrap">
        <table className="historial-table">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Google / GitHub</th><th /></tr></thead>
          <tbody>
            {lista.map(a => (
              <tr key={a.id}>
                <td>{a.avatar} {a.nombre}</td><td>{a.usuario}</td><td>{a.rol}</td>
                <td className="historial-hora">{a.emails?.[0] || '—'} / {a.github || '—'}</td>
                <td>{admin.principal && !a.principal &&
                  <button className="btn-link-danger" onClick={() => eliminar(a)}>Eliminar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {admin.principal && (
        <form onSubmit={crear} className="admin-new">
          <h3>Nuevo administrador</h3>
          <p className="admin-warn-txt">Solo nombres reales (nombre y apellido). No se aceptan personajes ni seres fantásticos.</p>
          <div className="admin-two-col">
            <div className="form-group"><label>Nombre real completo</label>
              <input value={f.nombre} onChange={set('nombre')} placeholder="Ej: Laura Martínez" required maxLength={60} /></div>
            <div className="form-group"><label>Cargo</label>
              <input value={f.rol} onChange={set('rol')} maxLength={40} /></div>
            <div className="form-group"><label>Usuario</label>
              <input value={f.usuario} onChange={set('usuario')} required maxLength={24} autoComplete="off" /></div>
            <div className="form-group"><label>Contraseña inicial (8+, letras y números)</label>
              <input type="password" value={f.clave} onChange={set('clave')} required minLength={8} autoComplete="new-password" /></div>
            <div className="form-group"><label>Correo Google (opcional)</label>
              <input type="email" value={f.email} onChange={set('email')} /></div>
            <div className="form-group"><label>Usuario GitHub (opcional)</label>
              <input value={f.github} onChange={set('github')} maxLength={39} /></div>
          </div>
          <button className="btn-gg-primary" type="submit">➕ Crear administrador</button>
        </form>
      )}
      {msg && <p className="admin-msg">{msg}</p>}
    </section>
  );
}

// ── Exportación: la sesión la decide el servidor (cookie HttpOnly) ───────────
export default function AdminPage() {
  const [admin, setAdmin]   = useState(null);
  const [listo, setListo]   = useState(false);
  const [nuevo, setNuevo]   = useState(false);

  useEffect(() => {
    api('/api/auth/me').then(r => {
      if (r.ok) {
        setAdmin(r.data.admin);
        // Tras volver de Google/GitHub (sesión recién creada) también se da la bienvenida
        if (document.referrer && !document.referrer.startsWith(window.location.origin)) setNuevo(true);
      }
      setListo(true);
    });
  }, []);

  useEffect(() => {
    document.title = !listo ? 'Cargando… · GanaGana'
      : admin ? 'Panel de Control · Administración GanaGana'
              : 'Acceso Administradores · GanaGana';
  }, [admin, listo]);

  async function salir() {
    await api('/api/auth/logout', { method: 'POST' });
    setAdmin(null);
  }

  if (!listo) return <div className="al-page"><span className="al-spinner al-spinner--big" /></div>;
  if (!admin) return <LoginAdmin onOk={a => { setNuevo(true); setAdmin(a); }} />;
  return <PanelAdmin admin={admin} onLogout={salir} onActualizar={setAdmin} recienIngresado={nuevo} />;
}


