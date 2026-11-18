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
import BienvenidaModal from './BienvenidaModal';
import TarjetaEstado from './TarjetaEstado';
import MiCuenta from './MiCuenta';
import Administradores from './Administradores';
import EstadoSistema from './EstadoSistema';

// ── PANEL PRINCIPAL ────────────────────────────────────────────────────────────
export default function PanelAdmin({ admin, onLogout, onActualizar, recienIngresado }: {
  admin: Administrador; onLogout: () => void; onActualizar: (a: Administrador) => void; recienIngresado: boolean;
}) {
  const { connected, estado, config, presencia, cajasEstado } = useSocket({ tipo: 'admin' });
  const [historial,    setHistorial]    = useState<RegistroHistorial[]>([]);
  const [nombre,       setNombre]       = useState('');
  const [volumen,      setVolumen]      = useState(1);
  const [silencio,     setSilencio]     = useState(false);
  const [reinicioDiario, setReinicioDiario] = useState(true);
  const [horaReinicio,   setHoraReinicio]   = useState('06:00');
  const [msgGuardar,   setMsgGuardar]   = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [msgReset,     setMsgReset]     = useState('');
  const [errores,      setErrores]      = useState<{ tipo: string; detalle: string }[]>([]);
  const [mostrarBv,    setMostrarBv]    = useState(recienIngresado);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
    api<RegistroHistorial[]>('/api/historial?limit=100').then(r => {
      if (r.status === 401) onLogout(); else if (r.ok) setHistorial(r.data as unknown as RegistroHistorial[]);
    });
  }

  useEffect(() => {
    if (!config) return;
    setNombre(config.establecimiento || '');
    setVolumen(config.volumen ?? 1);
    setSilencio(config.silencio ?? false);
    setReinicioDiario(config.reinicioDiario ?? true);
    setHoraReinicio(config.horaReinicio || '06:00');
  }, [config]);

  useEffect(() => {
    if (!presencia) return;
    const e: { tipo: string; detalle: string }[] = [];
    for (let i = 1; i <= 4; i++) {
      if (presencia.cajas?.[i]?.falla)
        e.push({ tipo: `Caja ${i}`, detalle: presencia.cajas[i].detalle });
    }
    if (presencia.pantalla?.falla)
      e.push({ tipo: 'Pantalla Pública', detalle: presencia.pantalla.detalle });
    setErrores(e);
  }, [presencia]);

  async function guardarConfig() {
    const err = primerError(validarEstablecimiento(nombre), validarVolumen(volumen));
    if (err) { setMsgGuardar(`⚠️ ${err}`); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaReinicio)) { setMsgGuardar('⚠️ La hora de reinicio no es válida.'); return; }
    const res = await api('/api/config', { method: 'POST', body: { establecimiento: nombre, volumen, silencio, reinicioDiario, horaReinicio } });
    if (res.status === 401) return onLogout();
    if (res.ok) { setMsgGuardar('✅ Guardado con éxito'); setTimeout(() => setMsgGuardar(''), 3000); }
    else setMsgGuardar(`⚠️ ${res.data.error || 'No se pudo guardar.'}`);
  }

  async function reiniciar() {
    await api('/api/reset', { method: 'POST' });
    setMsgReset('✅ Contador reiniciado a A00');
    setConfirmReset(false);
    setTimeout(() => setMsgReset(''), 4000);
    cargarHistorial();
  }

  async function liberarCaja(caja: number) {
    if (!window.confirm(`¿Liberar la Caja ${caja}? La persona que la está usando perderá el acceso.`)) return;
    await api(`/api/caja/${caja}/liberar`, { method: 'POST' });
  }

  function probarVoz() {
    if (!vozDisponible()) { setMsgGuardar('⚠️ Este navegador no tiene voz en español'); return; }
    hablarTurno(22, 2, { volumen, repeticiones: 1 });
  }

  async function toggleCaja(caja: number) {
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

        <EstadoSistema />

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
                onLiberar={() => liberarCaja(num)}
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
                Vuelve la numeración a A00 ahora mismo{reinicioDiario ? ` (además se hace solo cada día a las ${horaReinicio})` : ''}.<br />
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
                <p>¿Confirmas reiniciar a <strong>A00</strong>?</p>
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
            <label>Volumen de la voz de llamado</label>
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
          <div className="form-group check-row">
            <label>
              <input type="checkbox" checked={reinicioDiario}
                onChange={e => setReinicioDiario(e.target.checked)} />
              &nbsp; Reiniciar el contador a A00 automáticamente cada día a las
              &nbsp;<input type="time" value={horaReinicio} disabled={!reinicioDiario}
                onChange={e => setHoraReinicio(e.target.value)} style={{ width: 'auto' }} />
              &nbsp;(hora de Colombia)
            </label>
          </div>
          <button className="btn-gg-primary" onClick={guardarConfig}>💾 Guardar cambios</button>
          &nbsp;<button className="btn btn-sky" onClick={probarVoz}>🔊 Probar voz (A22, caja 2)</button>
          {msgGuardar && <p className="admin-msg">{msgGuardar}</p>}
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


