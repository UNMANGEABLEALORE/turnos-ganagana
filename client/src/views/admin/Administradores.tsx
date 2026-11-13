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


// ── Administradores (solo el principal puede crear / eliminar) ───────────────
export default function Administradores({ admin }: { admin: Administrador }) {
  const [lista, setLista] = useState<Administrador[]>([]);
  const [f, setF] = useState({ nombre: '', usuario: '', clave: '', rol: 'Administrador', email: '', github: '' });
  const [msg, setMsg] = useState('');

  const cargar = () => api<Administrador[]>('/api/auth/admins').then(r => { if (r.ok) setLista(r.data as unknown as Administrador[]); });
  useEffect(() => { cargar(); }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    // Validación lógica en el navegador (el servidor la repite)
    const err = primerError(validarNombreReal(f.nombre), validarUsuario(f.usuario), validarClave(f.clave), validarCorreo(f.email), validarGithub(f.github));
    if (err) { setMsg(`⚠️ ${err}`); return; }
    setMsg('⏳ Creando…');
    const r = await api<{ admin: Administrador }>('/api/auth/admins', { method: 'POST', body: f });
    setMsg(r.ok ? `✅ Administrador ${r.data.admin.nombre} creado. Ya puede entrar con el usuario "${r.data.admin.usuario}".`
                : `⚠️ ${r.data.error || (r.status === 401 ? 'Tu sesión expiró: vuelve a iniciar sesión.' : 'No se pudo crear el administrador.')}`);
    if (r.ok) { setF({ nombre: '', usuario: '', clave: '', rol: 'Administrador', email: '', github: '' }); cargar(); }
  }
  async function eliminar(a: Administrador) {
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

      {!admin.principal && (
        <p className="admin-msg-box admin-msg-box--info">
          ℹ️ Solo el <strong>administrador principal</strong> puede crear administradores. Entra con el usuario <strong>JUAN-PORRAS</strong>.
        </p>
      )}

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
          {msg && <p className={`admin-msg-box ${msg.startsWith('✅') ? 'admin-msg-box--ok' : msg.startsWith('⏳') ? 'admin-msg-box--info' : 'admin-msg-box--err'}`} role="status">{msg}</p>}
          <button className="btn-gg-primary" type="submit">➕ Crear administrador</button>
        </form>
      )}
      {msg && !admin.principal && <p className="admin-msg-box admin-msg-box--err">{msg}</p>}
    </section>
  );
}

