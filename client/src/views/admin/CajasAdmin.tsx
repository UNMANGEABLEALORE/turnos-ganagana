import React, { useState } from 'react';
import { api } from '../../controllers/api';
import { MAX_CAJAS } from '../../models/cajas';

interface Respuesta { numCajas: number; caja: number; enlace: string; }

// ── Agregar o quitar cajas (Caja 5, 6, 7…): al agregar se genera su enlace ──
export default function CajasAdmin({ numCajas }: { numCajas: number }) {
  const [msg, setMsg] = useState('');
  const [enlace, setEnlace] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function cambiar(accion: 'agregar' | 'quitar') {
    if (accion === 'quitar' && !window.confirm(`¿Quitar la Caja ${numCajas}? Su enlace dejará de funcionar.`)) return;
    setOcupado(true); setCopiado(false); setEnlace('');
    const r = await api<Respuesta>('/api/cajas', { method: 'POST', body: { accion } });
    setOcupado(false);
    if (!r.ok) { setMsg(`⚠️ ${r.data.error || 'No se pudo cambiar la cantidad de cajas.'}`); return; }
    if (accion === 'agregar') {
      setMsg(`✅ Guardado con éxito: la Caja ${r.data.caja} ya existe. Ahora hay ${r.data.numCajas} cajas.`);
      setEnlace(r.data.enlace);
    } else {
      setMsg(`✅ Guardado con éxito: la Caja ${r.data.caja} se quitó. Ahora hay ${r.data.numCajas} cajas.`);
    }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); } catch { setCopiado(false); }
  }

  return (
    <section className="card admin-section">
      <h2>Cajas <span className="historial-count">({numCajas} de máximo {MAX_CAJAS})</span></h2>
      <p className="admin-warn-txt">
        Agrega una caja y el sistema crea su enlace (Caja 5, 6, 7…). Ábrelo en el computador de esa asesora.
        Solo se puede quitar la última caja, y únicamente si nadie la está usando.
      </p>
      <div className="fn-fila">
        <button className="btn-gg-primary" disabled={ocupado || numCajas >= MAX_CAJAS} onClick={() => cambiar('agregar')}>
          ➕ Agregar Caja {numCajas + 1}
        </button>
        <button className="btn btn-rose" disabled={ocupado || numCajas <= 1} onClick={() => cambiar('quitar')}>
          ➖ Quitar Caja {numCajas}
        </button>
      </div>
      {msg && <p className={`admin-msg-box ${msg.startsWith('✅') ? 'admin-msg-box--ok' : 'admin-msg-box--err'}`} role="status">{msg}</p>}
      {enlace && (
        <div className="admin-url-row">
          <span className="admin-url-label">🔗 Enlace nuevo</span>
          <code className="admin-url-code">{enlace}</code>
          <button className="btn btn-sky" onClick={copiar}>{copiado ? '✔ Copiado' : '📋 Copiar'}</button>
        </div>
      )}
    </section>
  );
}
