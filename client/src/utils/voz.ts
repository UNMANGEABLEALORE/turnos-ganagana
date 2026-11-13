/**
 * Voz de llamado de turnos (SpeechSynthesis del navegador, español).
 *
 * Pensada para personas con dificultad auditiva y para salas ruidosas:
 *  - Habla despacio (rate 0.8), tono grave y sereno.
 *  - Dice la letra con su nombre Y con una palabra de apoyo ("a, de Ana"), para que no se confunda
 *    B con V, M con N, etc.
 *  - Dice el número completo en palabras ("veintidós") y luego dígito por dígito ("dos, dos").
 *  - Separa el mensaje en frases con pausa y lo repite dos veces.
 *
 * Ejemplo (turno A22, caja 2):
 *   "Atención. Turno, letra a, de Ana."  "Número veintidós. Dos, dos."  "Diríjase a la caja número dos."
 *
 * (La misma lógica está en display/index.html — las pruebas verifican que coincidan.)
 */
const NOMBRE_LETRA: Record<string, string> = {
  A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'efe', G: 'ge', H: 'hache', I: 'i', J: 'jota',
  K: 'ka', L: 'ele', M: 'eme', N: 'ene', O: 'o', P: 'pe', Q: 'cu', R: 'erre', S: 'ese', T: 'te',
  U: 'u', V: 'uve', W: 'uve doble', X: 'equis', Y: 'ye', Z: 'zeta'
};
// Palabra de apoyo para distinguir letras parecidas (nombres y lugares conocidos)
const PALABRA_LETRA: Record<string, string> = {
  A: 'Ana', B: 'Bogotá', C: 'Cali', D: 'Diana', E: 'Elena', F: 'Fernando', G: 'Gloria', H: 'Hugo',
  I: 'Isabel', J: 'Juan', K: 'Kilo', L: 'Luis', M: 'María', N: 'Nancy', O: 'Óscar', P: 'Pedro',
  Q: 'Quito', R: 'Rosa', S: 'Sandra', T: 'Tolima', U: 'Uruguay', V: 'Valentina', W: 'Washington',
  X: 'Xilófono', Y: 'Yolanda', Z: 'Zapato'
};
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ESPECIALES = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const VEINTES = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

export function numeroEnPalabras(n: number): string {            // 0..99
  if (n < 10) return 'cero ' + UNIDADES[n];       // "05" → "cero cinco" (como se lee en pantalla)
  if (n < 20) return ESPECIALES[n - 10];
  if (n < 30) return VEINTES[n - 20];
  const d = Math.floor(n / 10), u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

/** Frases separadas (cada una se habla como un mensaje distinto, con pausa natural entre ellas). */
export function partesVoz(turno: number | string, caja: number | string): string[] {
  const num = parseInt(String(turno), 10);
  const letra = String.fromCharCode(65 + (Math.floor(num / 100) % 26));
  const resto = num % 100;
  const numTxt = resto === 0 ? 'cero cero' : numeroEnPalabras(resto);
  const digitos = `${UNIDADES[Math.floor(resto / 10)]}, ${UNIDADES[resto % 10]}`;
  return [
    `Atención. Turno, letra ${NOMBRE_LETRA[letra]}, de ${PALABRA_LETRA[letra]}.`,
    `Número ${numTxt}. ${digitos}.`,
    `Diríjase a la caja número ${UNIDADES[Number(caja)] ?? caja}.`
  ];
}

export function textoVoz(turno: number | string, caja: number | string): string {
  return partesVoz(turno, caja).join(' ');
}

// ── Elección de voz ──────────────────────────────────────────────────────────
const CLAVE_VOZ = 'gg_voz';
let vozElegida: SpeechSynthesisVoice | null = null;

function puntaje(v: SpeechSynthesisVoice): number {
  const lang = (v.lang || '').toLowerCase().replace('_', '-');
  let p = 0;
  if (/natural|neural|online/i.test(v.name)) p += 100;            // voces neuronales de Edge: las más claras
  if (/google/i.test(v.name)) p += 40;
  p += ({ 'es-co': 30, 'es-mx': 25, 'es-us': 20, 'es-es': 10 } as Record<string, number>)[lang] ?? 0;
  if (/salome|dalia|elvira|paloma|sabina|helena|laura|jorge|alonso/i.test(v.name)) p += 8;
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

function hablarRonda(partes: string[], volumen: number, alTerminar?: () => void): void {
  const synth = window.speechSynthesis;
  partes.forEach((txt, i) => {
    const u = new SpeechSynthesisUtterance(txt);
    if (vozElegida) { u.voice = vozElegida; u.lang = vozElegida.lang; } else { u.lang = 'es-CO'; }
    u.volume = Math.max(0.4, Math.min(1, volumen));
    u.rate = 0.8;          // despacio
    u.pitch = 0.95;        // un poco más grave = más sereno
    u.onerror = e => console.warn('Voz:', e.error);
    if (i === partes.length - 1 && alTerminar) { u.onend = alTerminar; }
    synth.speak(u);
  });
}

/**
 * Habla el llamado. SIEMPRE intenta hablar: si no hay voz en español instalada usa la
 * voz por defecto del navegador con lang="es-CO". Devuelve false solo si no hay SpeechSynthesis.
 */
export function hablarTurno(
  turno: number | string, caja: number | string,
  { volumen = 1, repeticiones = 2 }: { volumen?: number; repeticiones?: number } = {}
): boolean {
  if (!vozDisponible()) return false;
  const synth = window.speechSynthesis;
  vozElegida = vozElegida || elegirVoz();
  if (synth.paused) synth.resume();
  const partes = partesVoz(turno, caja);
  let restantes = repeticiones;
  const ronda = () => {
    restantes -= 1;
    // Pausa de 1,2 s entre una repetición y la siguiente
    hablarRonda(partes, volumen, restantes > 0 ? () => setTimeout(ronda, 1200) : undefined);
  };
  ronda();
  return true;
}
