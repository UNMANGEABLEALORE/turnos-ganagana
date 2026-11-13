import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../controllers/useSocket';
import { formatTurno } from '../../models/formato';
import { hablarTurno, infoVoz, listarVoces, elegirVozManual, avisarSiSeBloquea } from '../../controllers/voz';
import type { TurnoLlamado } from '../../models/types';
import './DisplayPage.css';

const CAJA_COLORES: Record<number, string> = {
  1: '#A8D5E2',
  2: '#B5EAD7',
  3: '#C9C0E8',
  4: '#FFDAB9',
};

export default function DisplayPage() {
  const { connected, estado, config } = useSocket({ tipo: 'pantalla' });

  // Audio
  const audioCtx   = useRef<AudioContext | null>(null);
  const [activado, setActivado] = useState(false);
  const activadoRef = useRef(false);            // la voz solo puede sonar después del clic en "Activar pantalla"
  const [vozBloqueada, setVozBloqueada] = useState(false);
  const silencioRef = useRef(false);
  const [silencio, setSilencio] = useState(false);
  const volumenRef = useRef(1);

  // Animación
  const [animKey, setAnimKey] = useState(0);
  const ultimoIdRef = useRef<string | null>(null);

  // Estado de pantalla
  const ultimos  = estado?.ultimos || [];
  const actual   = ultimos[0] || null;
  const siguiente = ultimos[1] || null;
  const despues  = ultimos[2] || null;

  // Reloj
  const [hora, setHora] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      setHora(`${hh}:${mm}:${ss}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Sincronizar config de audio
  useEffect(() => {
    if (!config) return;
    volumenRef.current = config.volumen ?? 1;
    setSilencio(config.silencio ?? false);
    silencioRef.current = config.silencio ?? false;
  }, [config]);

  useEffect(() => { avisarSiSeBloquea(() => setVozBloqueada(true)); return () => avisarSiSeBloquea(null); }, []);

  // Detectar nuevo turno y animar + sonar
  useEffect(() => {
    if (!actual) return;
    const id = `${actual.turno}-${actual.caja}`;
    if (id !== ultimoIdRef.current) {
      ultimoIdRef.current = id;
      setAnimKey(k => k + 1);
      // El turno que ya estaba en pantalla al abrir NO se anuncia (el navegador bloquearía la voz)
      if (activadoRef.current) anunciar(actual);
    }
  }, [actual]);

  // Llama por voz; si el navegador no tiene voz en español, usa la campanilla de respaldo
  // Primero suena la campanilla y enseguida la voz ("Turno a, veintidós. Diríjase a la caja número 2")
  function anunciar(t: TurnoLlamado) {
    if (silencioRef.current) return;
    playDing();
    setTimeout(() => {
      hablarTurno(t.turno, t.caja, { volumen: volumenRef.current, repeticiones: 2 });
    }, 1000);
  }

  const [vozTxt, setVozTxt] = useState({ ok: true, texto: '' });
  const [voces, setVoces] = useState<string[]>([]);
  const [vozSel, setVozSel] = useState<string>(localStorage.getItem('gg_voz') || '');
  useEffect(() => {
    if (!activado) return;
    const refrescar = () => { setVozTxt(infoVoz()); setVoces(listarVoces().map(v => v.name)); };
    refrescar();
    const t = setInterval(refrescar, 2000);     // las voces cargan de forma asíncrona
    return () => clearInterval(t);
  }, [activado]);

  function activar() {
    activadoRef.current = true;
    setVozBloqueada(false);
    // Desbloquea la síntesis de voz con un gesto del usuario
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    audioCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    setActivado(true);
  }

  // Campanilla fuerte: 3 notas repetidas 2 veces, onda triangular (más presencia que
  // la senoidal), ganancia amplificada y compresor para subir volumen sin distorsionar.
  function playDing() {
    if (!audioCtx.current || silencioRef.current) return;
    const vol = Math.max(0, Math.min(1, volumenRef.current));
    const ctx = audioCtx.current;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = vol * 3.2;               // hasta 3.2× al 100 %
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6;
    comp.attack.value = 0.003;  comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    const notas = [880, 1100, 1320];
    [0].forEach(repeticion => {
      notas.forEach((freq, i) => {
        const ini = t0 + repeticion + i * 0.22;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ini);
        g.gain.exponentialRampToValueAtTime(0.9, ini + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, ini + 0.7);
        g.connect(master);
        ([['triangle', freq], ['sine', freq * 2]] as [OscillatorType, number][]).forEach(([tipo, f]) => {
          const o = ctx.createOscillator();
          o.type = tipo; o.frequency.value = f;
          o.connect(g); o.start(ini); o.stop(ini + 0.75);
        });
      });
    });
  }

  if (!activado) {
    return (
      <div className="dp-overlay">
        <div className="dp-activate-box">
          <div className="dp-activate-icon">🎟️</div>
          <h1>Sistema de Turnos</h1>
          <p>{config?.establecimiento || 'GanaGana'}</p>
          <button className="dp-activate-btn" onClick={activar}>
            ▶ Activar pantalla
          </button>
          <span className="dp-activate-hint">
            Haz clic para habilitar la voz que llama los turnos
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dp-screen">
      {vozBloqueada && (
        <button className="dp-voz-bloqueada" onClick={() => { activar(); anunciar({ turno: actual?.turno ?? 22, caja: actual?.caja ?? 2 }); }}>
          🔇 El navegador bloqueó la voz. Toca aquí para volver a activarla
        </button>
      )}
      {/* Aviso visual para personas con dificultad auditiva: parpadea cada vez que se llama un turno */}
      {animKey > 0 && <div key={`flash-${animKey}`} className="dp-llamada-flash" aria-hidden="true" />}
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="dp-header">
        <div className="dp-header-logo">🎟️</div>
        <div className="dp-header-name">{config?.establecimiento || 'GanaGana'}</div>
        <div className="dp-header-right">
          <span className="dp-clock">{hora}</span>
          <span className={`dp-conn ${connected ? 'dp-conn--on' : 'dp-conn--off'}`}>
            <span className="dp-conn-dot" />
            {connected ? 'En línea' : 'Sin conexión'}
          </span>
          {silencio && <span className="dp-muted">🔇</span>}
          {voces.length > 0 && (
            <select className="dp-test-voz" value={vozSel} aria-label="Elegir voz"
              onChange={e => { setVozSel(e.target.value); elegirVozManual(e.target.value); }}>
              <option value="">Voz automática (la más clara)</option>
              {voces.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <button className="dp-test-voz" onClick={() => anunciar({ turno: 22, caja: 2 })}
            title={vozTxt.texto}>🔊 Probar voz</button>
        </div>
      </header>

      {/* ── Cuerpo principal ───────────────────────────────────────── */}
      <main className="dp-main">

        {/* Turno actual — GRANDE */}
        <div className="dp-current-wrap">
          <p className="dp-label-top">TURNO EN ATENCIÓN</p>

          <div
            key={animKey}
            className="dp-current-num"
            style={actual ? { color: '#2A2A3A' } : { color: '#ccc' }}
          >
            {actual ? formatTurno(actual.turno) : '---'}
          </div>

          {actual ? (
            <div
              className="dp-caja-pill"
              style={{ background: CAJA_COLORES[actual.caja] || '#A8D5E2' }}
            >
              DIRÍJASE A LA CAJA {actual.caja}
            </div>
          ) : (
            <div className="dp-caja-pill dp-caja-pill--empty">
              Esperando turno…
            </div>
          )}
        </div>

        {/* Panel lateral: siguiente y después */}
        <div className="dp-side">
          <div className="dp-next-card dp-next-card--sig">
            <span className="dp-next-label">Siguiente</span>
            <span className="dp-next-num">
              {siguiente ? formatTurno(siguiente.turno) : '---'}
            </span>
            {siguiente && (
              <span className="dp-next-caja">Caja {siguiente.caja}</span>
            )}
          </div>

          <div className="dp-next-card dp-next-card--des">
            <span className="dp-next-label">Después</span>
            <span className="dp-next-num dp-next-num--small">
              {despues ? formatTurno(despues.turno) : '---'}
            </span>
            {despues && (
              <span className="dp-next-caja">Caja {despues.caja}</span>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="dp-footer">
        <span>🟢 Por favor espere a ser llamado por su número</span>
        <span className="dp-footer-brand">{config?.establecimiento || 'Sistema de Turnos'}</span>
      </footer>
    </div>
  );
}


