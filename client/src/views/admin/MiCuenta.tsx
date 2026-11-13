import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../controllers/api';
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


// ── Mi cuenta: contraseña y vínculos con Google / GitHub ─────────────────────
export default function MiCuenta({ admin, onActualizar }: { admin: Administrador; onActualizar: (a: Administrador) => void }) {
  const [actual, setActual] = useState('');
  const [nueva,  setNueva]  = useState('');
  const [email,  setEmail]  = useState(admin.emails?.[0] || '');
  const [github, setGithub] = useState(admin.github || '');
  const [msg,    setMsg]    = useState('');

  async function cambiarClave(e: React.FormEvent) {
    e.preventDefault();
    const err = validarClave(nueva);
    if (err) { setMsg(`⚠️ ${err}`); return; }
    const r = await api('/api/auth/me/clave', { method: 'POST', body: { actual, nueva } });
    setMsg(r.ok ? '✅ Contraseña actualizada' : `⚠️ ${r.data.error}`);
    if (r.ok) { setActual(''); setNueva(''); onActualizar({ ...admin, debeCambiar: false }); }
  }
  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    const err = primerError(validarCorreo(email), validarGithub(github));
    if (err) { setMsg(`⚠️ ${err}`); return; }
    const r = await api<{ admin: Administrador }>('/api/auth/me/vinculos', { method: 'POST', body: { email, github } });
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

