import React, { useEffect, useState } from 'react';
import { api } from '../../controllers/api';
import type { Administrador, FilaActividad, ResumenActividad } from '../../models/types';

interface Datos { filas: FilaActividad[]; resumen: ResumenActividad[]; soloPropia: boolean; diasGuardados: number; }

const hora = (iso: string) => new Date(iso).toLocaleString('es-CO', {
  timeZone: 'America/Bogota', hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
});

// ── Reporte: qué hizo cada administrador ─────────────────────────────────────
export default function Actividad({ admin }: { admin: Administrador }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [filtro, setFiltro] = useState('');         // id del administrador ('' = todos); solo lo usa el principal
  const [error, setError] = useState('');

  async function cargar() {
    const r = await api<Datos>(`/api/actividad?limite=200${filtro ? `&admin=${filtro}` : ''}`);
    if (r.ok) { setDatos(r.data as unknown as Datos); setError(''); }
    else setError(r.data.error || 'No se pudo cargar el reporte.');
  }
  useEffect(() => { cargar(); const t = setInterval(cargar, 30_000); return () => clearInterval(t); }, [filtro]);

  // Administradores que aparecen en el reporte (para el filtro)
  const quienes = datos ? [...new Map(datos.filas.filter(f => f.adminId).map(f => [f.adminId, f.nombre || f.usuario])).entries()] : [];

  return (
    <section className="card admin-section">
      <h2>Actividad de los administradores</h2>
      <p className="admin-warn-txt">
        {admin.principal ? 'Ves lo que hizo cada administrador.' : 'Ves tus propias acciones.'}
        {datos ? ` Se guardan ${datos.diasGuardados} días.` : ''}
      </p>

      {datos && datos.resumen.length > 0 && (
        <div className="sis-grid">
          {datos.resumen.map(x => (
            <div key={x.usuario} className="sis-item">
              <span className="sis-label">{x.nombre || x.usuario}</span>
              <strong>{x.acciones} {x.acciones === 1 ? 'acción' : 'acciones'}</strong>
              <span className="sis-sub">últimos 30 días · última {hora(x.ultima)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="fn-fila">
        {admin.principal && (
          <select className="act-filtro" value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Filtrar por administrador">
            <option value="">Todos los administradores</option>
            {quienes.map(([id, nombre]) => <option key={String(id)} value={String(id)}>{nombre}</option>)}
          </select>
        )}
        <button className="btn btn-sky" onClick={cargar}>🔄 Actualizar</button>
      </div>

      {error && <p className="admin-msg-box admin-msg-box--err">⚠️ {error}</p>}

      <div className="historial-table-wrap">
        <table className="historial-table">
          <thead><tr><th>Fecha y hora</th><th>Administrador</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {datos && datos.filas.length === 0 && <tr><td colSpan={4} className="historial-empty">Sin actividad todavía</td></tr>}
            {datos?.filas.map(f => (
              <tr key={f.id} className={/fallido/i.test(f.accion) ? 'act-alerta' : ''}>
                <td className="historial-hora">{hora(f.cuando)}</td>
                <td>{f.nombre || f.usuario} <span className="historial-hora">@{f.usuario}</span></td>
                <td><strong>{f.accion}</strong></td>
                <td>{f.detalle}{f.ip ? <span className="historial-hora"> · {f.ip}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
