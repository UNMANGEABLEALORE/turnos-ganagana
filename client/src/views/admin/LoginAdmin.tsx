import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SERVER } from '../../controllers/api';
import { useSocket } from '../../controllers/useSocket';
import { useCaptcha } from '../../controllers/useCaptcha';
import { hablarTurno, vozDisponible } from '../../controllers/voz';
import { formatTurno } from '../../models/formato';
import type {
  Administrador, ConfigAuth, EstadoCaja, RegistroHistorial
} from '../../models/types';
import {
  validarClave, validarCorreo, validarEstablecimiento, validarGithub, validarNombreReal,
  validarUsuario, validarVolumen, primerError
} from '../../models/validaciones';


// ── LOGIN ─────────────────────────────────────────────────────────────────────
export default function LoginAdmin({ onOk }: { onOk: (a: Administrador) => void }) {
  const [cfg,        setCfg]        = useState<ConfigAuth | null>(null);
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
    api<ConfigAuth>('/api/auth/config').then(r => setCfg(r.data)).catch(() => {});
    const e = new URLSearchParams(window.location.search).get('error');
    if (e) { setErr(e); window.history.replaceState({}, '', '/admin'); }
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function fallar(msg: string) {
    setErr(msg); setShake(true);
    setTimeout(() => setShake(false), 600);
    captcha.reset(); setLoading(false); setPwd('');
  }

  async function intentar(e: React.FormEvent) {
    e.preventDefault();
    if (espera > 0) return;
    if (!consent) { setErr('Debes autorizar el tratamiento de tus datos personales.'); return; }
    if (!captcha.token) { setErr('Completa la verificación CAPTCHA.'); return; }
    setLoading(true); setErr('');
    const r = await api<{ admin: Administrador }>('/api/auth/login', {
      method: 'POST',
      body: { usuario, clave: pwd, captcha: captcha.token, consentimiento: true }
    });
    if (r.ok) { onOk(r.data.admin); return; }
    if (r.status === 429) setEspera(r.data.espera || 60);
    fallar(r.data.error || 'No se pudo iniciar sesión.');
  }

  function oauth(prov: 'google' | 'github') {
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

