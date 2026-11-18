/**
 * Voz de llamado de turnos (SpeechSynthesis del navegador, español latinoamericano).
 *
 *  - Lee el turno tal como se ve en pantalla: "Turno A cero uno", "Turno B veintidós".
 *  - Una sola frase, al volumen máximo, y se dice DOS veces como máximo.
 *  - Prefiere voces de Colombia y luego de México (Salomé, Gonzalo, Dalia, Jorge…);
 *    las de España solo se usan si el equipo no tiene ninguna latinoamericana.
 *
 * Ejemplo (turno A01, caja 2):  "Turno A cero uno. Diríjase a la caja número dos."
 */
const NOMBRE_LETRA: Record<string, string> = {
  A: 'A', B: 'Be', C: 'Ce', D: 'De', E: 'E', F: 'Efe', G: 'Ge', H: 'Hache', I: 'I', J: 'Jota',
  K: 'Ka', L: 'Ele', M: 'Eme', N: 'Ene', O: 'O', P: 'Pe', Q: 'Cu', R: 'Erre', S: 'Ese', T: 'Te',
  U: 'U', V: 'Ve', W: 'Doble ve', X: 'Equis', Y: 'Ye', Z: 'Zeta'
};
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ESPECIALES = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const VEINTES = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

/** 0..99 como se lee en pantalla: 01 → "cero uno", 00 → "cero cero", 22 → "veintidós". */
export function numeroEnPalabras(n: number): string {
  if (n < 10) return 'cero ' + UNIDADES[n];
  if (n < 20) return ESPECIALES[n - 10];
  if (n < 30) return VEINTES[n - 20];
  const d = Math.floor(n / 10), u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

/** La frase del llamado (una sola). */
export function partesVoz(turno: number | string, caja: number | string): string[] {
  const num = parseInt(String(turno), 10);
  const letra = String.fromCharCode(65 + (Math.floor(num / 100) % 26));
  const numTxt = numeroEnPalabras(num % 100);
  const c = Number(caja);
  const cajaTxt = c >= 10 && c < 100 ? numeroEnPalabras(c) : (UNIDADES[c] ?? String(caja));
  return [`Turno ${NOMBRE_LETRA[letra]} ${numTxt}. Diríjase a la caja número ${cajaTxt}.`];
}

export function textoVoz(turno: number | string, caja: number | string): string {
  return partesVoz(turno, caja).join(' ');
}

// ── Elección de voz: Colombia → México → resto de Latinoamérica → España ─────
const CLAVE_VOZ = 'gg_voz_latam';      // clave nueva: descarta elecciones antiguas de voces de España
let vozElegida: SpeechSynthesisVoice | null = null;

const esEspana = (v: SpeechSynthesisVoice) => /^es[-_]es$/i.test(v.lang || '') || /spain|españa/i.test(v.name);

function puntaje(v: SpeechSynthesisVoice): number {
  const lang = (v.lang || '').toLowerCase().replace('_', '-');
  let p = ({ 'es-co': 300, 'es-mx': 250, 'es-us': 150, 'es-419': 150 } as Record<string, number>)[lang] ?? 0;
  if (!p && !esEspana(v)) p = 100;                                  // otro país de Latinoamérica
  if (/natural|neural|online/i.test(v.name)) p += 40;              // voces neuronales: más claras
  if (/salome|gonzalo|dalia|jorge/i.test(v.name)) p += 20;
  if (esEspana(v)) p -= 500;                                       // España: solo como último recurso
  return p;
}

export function listarVoces(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices()
    .filter(v => (v.lang || '').toLowerCase().startsWith('es'))
    .sort((a, b) => puntaje(b) - puntaje(a));
}

function elegirVoz(): SpeechSynthesisVoice | null {
  const voces = listarVoces();
  const guardada = localStorage.getItem(CLAVE_VOZ);
  return voces.find(v => v.name === guardada) || voces[0] || null;
}

/** Guarda la voz elegida por el usuario en este equipo ('' = automática). */
export function elegirVozManual(nombre: string): void {
  if (nombre) localStorage.setItem(CLAVE_VOZ, nombre); else localStorage.removeItem(CLAVE_VOZ);
  vozElegida = elegirVoz();
}

export function vozDisponible(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Texto para mostrar en pantalla: qué voz se usará (ayuda a diagnosticar en cada equipo). */
export function infoVoz(): { ok: boolean; texto: string } {
  if (!vozDisponible()) return { ok: false, texto: 'Este navegador no soporta voz' };
  vozElegida = vozElegida || elegirVoz();
  return vozElegida
    ? { ok: true, texto: `Voz: ${vozElegida.name} (${vozElegida.lang})` }
    : { ok: false, texto: 'Sin voz en español instalada: se usará la voz por defecto' };
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { vozElegida = elegirVoz(); };
}

// Las frases en curso se guardan aquí: Chrome/Edge a veces "olvidan" una frase si nadie la referencia.
const enCurso: SpeechSynthesisUtterance[] = [];

/** Se llama cuando el navegador bloquea la voz (falta un toque del usuario en la página). */
let alBloqueo: (() => void) | null = null;
export function avisarSiSeBloquea(fn: (() => void) | null): void { alBloqueo = fn; }

function decir(texto: string, voz: SpeechSynthesisVoice | null, alEmpezar: () => void,
               alTerminar: () => void, alFallar: (bloqueado: boolean) => void): void {
  const u = new SpeechSynthesisUtterance(texto);
  if (voz) { u.voice = voz; u.lang = voz.lang; } else { u.lang = 'es-CO'; }
  u.volume = 1;        // volumen máximo de la voz (el navegador no permite más de 1)
  u.rate = 0.88;       // un poco más despacio que lo normal, para que se entienda
  u.pitch = 1;
  u.onstart = alEmpezar;
  u.onend = () => { const k = enCurso.indexOf(u); if (k >= 0) enCurso.splice(k, 1); alTerminar(); };
  u.onerror = e => {
    const k = enCurso.indexOf(u); if (k >= 0) enCurso.splice(k, 1);
    if (e.error === 'interrupted' || e.error === 'canceled') return;   // lo cortamos nosotros al cambiar de voz
    console.warn('Voz:', e.error);
    alFallar(e.error === 'not-allowed');
  };
  enCurso.push(u);
  window.speechSynthesis.speak(u);
}

const siguienteVoz = (probadas: Set<string>) =>
  listarVoces().find(v => !probadas.has(v.name) && (v.localService || !esEspana(v)))
  || listarVoces().find(v => !probadas.has(v.name)) || null;

/**
 * Dice UNA vez el turno y avisa con `fin` cuando termina (o cuando se rinde).
 * Si la voz elegida no arranca en 6 s (voz "Online" sin red) prueba otra; si pasan 20 s sin terminar, sigue con el siguiente.
 */
function decirTurno(turno: number | string, caja: number | string, fin: () => void): void {
  vozElegida = vozElegida || elegirVoz();
  const texto = textoVoz(turno, caja);
  const probadas = new Set<string>();
  let voz = vozElegida;
  let terminado = false;
  const tope = setTimeout(() => { window.speechSynthesis.cancel(); cerrar(); }, 20000);
  const cerrar = () => { if (terminado) return; terminado = true; clearTimeout(tope); fin(); };

  const intentar = () => {
    if (voz) probadas.add(voz.name);
    let empezo = false, cerrado = false;
    const otraVoz = () => {
      if (cerrado) return;
      cerrado = true; window.speechSynthesis.cancel();
      voz = siguienteVoz(probadas);
      if (voz && probadas.size < 4) intentar(); else cerrar();
    };
    let prorrogado = false;
    let vigilante: ReturnType<typeof setTimeout> = setTimeout(function revisar() {
      if (empezo) return;
      // Si la voz ya está "hablando" pero aún no avisó que empezó (voz Online cargando), se le dan 8 s más antes de cambiarla
      if (window.speechSynthesis.speaking && !prorrogado) { prorrogado = true; vigilante = setTimeout(revisar, 8000); return; }
      otraVoz();
    }, 6000);
    decir(texto, voz,
      () => { empezo = true; clearTimeout(vigilante); },
      () => { clearTimeout(vigilante); if (cerrado) return; cerrado = true; cerrar(); },
      (bloqueado) => {
        clearTimeout(vigilante);
        if (bloqueado) { cerrado = true; cola.length = 0; alBloqueo?.(); cerrar(); } else otraVoz();
      });
  };
  intentar();
}

// ── Fila de anuncios ─────────────────────────────────────────────────────────
// Cada turno que llega se anuncia COMPLETO y en orden; nunca se corta uno para decir otro.
// Cada turno se dice como máximo 2 veces. La repetición se pone al final de la fila, así que si hay
// varios esperando, primero se dicen todos y después se repiten:  A10, A11, A10, A11.
interface Anuncio { turno: number | string; caja: number | string; veces: number; }
const cola: Anuncio[] = [];
let hablando = false;
const PAUSA_ENTRE_MS = 900;
const MAX_EN_FILA = 10;
let antesDeSerie: (() => void | Promise<void>) | null = null;

/** Algo que se hace antes de empezar a hablar cuando la fila estaba vacía (por ejemplo, la campanilla). */
export function alIniciarSerie(fn: (() => void | Promise<void>) | null): void { antesDeSerie = fn; }

/** true si hay un anuncio en curso o esperando. */
export const hayAnunciosPendientes = (): boolean => hablando || cola.length > 0;

function siguienteDeLaFila(): void {
  const a = cola.shift();
  if (!a) { hablando = false; return; }
  decirTurno(a.turno, a.caja, () => {
    a.veces -= 1;
    if (a.veces > 0) cola.push(a);                       // su repetición va al final de la fila
    setTimeout(siguienteDeLaFila, PAUSA_ENTRE_MS);
  });
}

/**
 * Pone un turno en la fila de anuncios (se dice `veces` veces, máximo 2).
 * Devuelve false solo si el navegador no tiene síntesis de voz.
 */
export function encolarLlamado(turno: number | string, caja: number | string, veces = 2): boolean {
  if (!vozDisponible()) return false;
  cola.push({ turno, caja, veces: Math.max(1, Math.min(2, veces)) });
  if (cola.length > MAX_EN_FILA) {                        // fila exagerada: se descartan primero las repeticiones viejas
    const r = cola.findIndex(x => x.veces < 2);
    cola.splice(r >= 0 ? r : 0, 1);
  }
  if (!hablando) {
    hablando = true;
    const synth = window.speechSynthesis;
    synth.cancel();                                       // limpia frases atascadas de antes
    if (synth.paused) synth.resume();
    Promise.resolve(antesDeSerie ? antesDeSerie() : undefined).catch(() => {}).then(siguienteDeLaFila);
  }
  return true;
}

/** Anuncio suelto (botón "Probar voz"). Usa la misma fila. */
export function hablarTurno(
  turno: number | string, caja: number | string,
  { repeticiones = 2 }: { volumen?: number; repeticiones?: number } = {}
): boolean {
  return encolarLlamado(turno, caja, repeticiones);
}
