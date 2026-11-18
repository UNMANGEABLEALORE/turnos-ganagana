import React, { useState } from 'react';
import { api } from '../../controllers/api';
import { formatTurno, parseTurno } from '../../models/formato';

// ── Fijar el número actual: para que el sistema coincida con el rollo de papel ──
export default function FijarNumero({ proximo }: { proximo?: number }) {
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState('');

  async function fijar(e: React.FormEvent) {
    e.preventDefault();
    const n = parseTurno(texto);
    if (n === null) { setMsg('⚠️ Escribe una letra y dos números, por ejemplo F23.'); return; }
    if (!window.confirm(`El próximo turno que se llame pasará de ${formatTurno(proximo)} a ${formatTurno(n)}.\n\nSi baja el número, se repetirán turnos ya llamados. ¿Confirmas?`)) return;
    setMsg('⏳ Guardando…');
    const r = await api<{ turno: string }>('/api/contador', { method: 'POST', body: { turno: texto } });
    setMsg(r.ok ? `✅ Guardado con éxito: el próximo turno será ${r.data.turno}.` : `⚠️ ${r.data.error || 'No se pudo guardar.'}`);
    if (r.ok) setTexto('');
  }

  return (
    <section className="card admin-section">
      <h2>Fijar número actual</h2>
      <p className="admin-warn-txt">
        Los turnos son de papel. Si el rollo y el sistema no coinciden, escribe el <strong>próximo número a llamar</strong>.
        Ahora el sistema seguirá con <strong>{formatTurno(proximo)}</strong>.
      </p>
      <form onSubmit={fijar} className="fn-fila">
        <input className="fn-input" value={texto} onChange={e => setTexto(e.target.value.toUpperCase())}
          placeholder="F23" maxLength={3} aria-label="Próximo turno (letra y dos números)" autoComplete="off" />
        <button className="btn-gg-primary" type="submit">📌 Fijar número</button>
      </form>
      {msg && <p className={`admin-msg-box ${msg.startsWith('✅') ? 'admin-msg-box--ok' : msg.startsWith('⏳') ? 'admin-msg-box--info' : 'admin-msg-box--err'}`} role="status">{msg}</p>}
    </section>
  );
}
