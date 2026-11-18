import React, { useEffect, useState } from 'react';
import { api } from '../../controllers/api';
import type { EstadoServidor } from '../../models/types';
import { listaCajas } from '../../models/cajas';

function duracion(seg: number): string {
  const d = Math.floor(seg / 86400), h = Math.floor((seg % 86400) / 3600), m = Math.floor((seg % 3600) / 60);
  return [d && `${d} d`, h && `${h} h`, `${m} min`].filter(Boolean).join(' ');
}

// ── Operación del día: encendido, datos permanentes, reinicio diario y direcciones ──
export default function EstadoSistema({ numCajas }: { numCajas?: number }) {
  const [s, setS] = useState<EstadoServidor | null>(null);

  useEffect(() => {
    const cargar = () => api<EstadoServidor>('/api/sistema').then(r => { if (r.ok) setS(r.data as unknown as EstadoServidor); });
    cargar();
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!s) return null;

  return (
    <section className="card admin-section">
      <h2>Operación del día</h2>

      {!s.turnosPermanentes && (
        <div className="admin-msg-box admin-msg-box--err">
          ⚠️ <strong>Los turnos NO están en una base de datos permanente.</strong>{' '}
          {s.enRender
            ? 'Si Render se reinicia durante el día, el contador vuelve a A00 y se pierden el historial y los administradores creados. Conecta Supabase (ver guía).'
            : 'Se guardan solo en el archivo de este equipo.'}
        </div>
      )}

      <div className="sis-grid">
        <div className="sis-item">
          <span className="sis-label">Encendido sin interrupción</span>
          <strong>{duracion(s.segundosEncendido)}</strong>
          <span className="sis-sub">Hora Colombia: {s.horaColombia}</span>
        </div>
        <div className="sis-item">
          <span className="sis-label">Turnos y contador</span>
          <strong>{s.turnosPermanentes ? 'Supabase (permanente)' : 'Temporal'}</strong>
          <span className={`sis-badge ${s.turnosPermanentes ? 'sis-ok' : 'sis-warn'}`}>
            {s.turnosPermanentes ? '✔ Sobreviven a reinicios' : '⚠ Se pierden si se reinicia'}
          </span>
        </div>
        <div className="sis-item">
          <span className="sis-label">Administradores en</span>
          <strong>{s.almacenamiento}</strong>
        </div>
        <div className="sis-item">
          <span className="sis-label">Reinicio a A00</span>
          <strong>{s.reinicioDiario ? `Cada día a las ${s.horaReinicio}` : 'Desactivado (manual)'}</strong>
          <span className="sis-sub">Último: {s.ultimoReinicio || '—'}</span>
        </div>
      </div>

      <h3 className="sis-h3">Direcciones para las cajas y el televisor</h3>
      <div className="admin-urls">
        {listaCajas(numCajas ?? s.numCajas ?? 4).map(c => (
          <div key={c} className="admin-url-row">
            <span className="admin-url-label">🖥️ Caja {c}</span>
            <code className="admin-url-code">{`${s.direccion}/caja/${c}`}</code>
          </div>
        ))}
        <div className="admin-url-row">
          <span className="admin-url-label">📺 Smart TV</span>
          <code className="admin-url-code">{`${s.direccion}/pantalla`}</code>
        </div>
      </div>
    </section>
  );
}
