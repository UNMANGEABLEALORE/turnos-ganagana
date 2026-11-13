/**
 * Voz de llamado de turnos (SpeechSynthesis del navegador, español).
 * Ejemplo: turno 22 en la caja 2 → "Turno A, veintidós. Diríjase a la caja número 2."
 * (La misma lógica está en display/index.html — las pruebas verifican que coincidan.)
 */
const NOMBRE_LETRA = {
  A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'efe', G: 'ge', H: 'hache', I: 'i', J: 'jota',
  K: 'ka', L: 'ele', M: 'eme', N: 'ene', O: 'o', P: 'pe', Q: 'cu', R: 'erre', S: 'ese', T: 'te',
  U: 'u', V: 'uve', W: 'uve doble', X: 'equis', Y: 'ye', Z: 'zeta'
};
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ESPECIALES = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const VEINTES = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

export function numeroEnPalabras(n) {            // 0..99
  if (n < 10) return 'cero ' + UNIDADES[n];       // "05" → "cero cinco" (como se lee en pantalla)
  if (n < 20) return ESPECIALES[n - 10];
  if (n < 30) return VEINTES[n - 20];
  const d = Math.floor(n / 10), u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

export function textoVoz(turno, caja) {
  const num = parseInt(turno, 10);
  const letra = String.fromCharCode(65 + (Math.floor(num / 100) % 26));
  const resto = num % 100;
  const numTxt = resto === 0 ? 'cero cero' : numeroEnPalabras(resto);
  return `Turno ${NOMBRE_LETRA[letra]}, ${numTxt}. Diríjase a la caja número ${caja}.`;
}

let vozElegida = null;
function elegirVoz() {
  if (!('speechSynthesis' in window)) return null;
  const voces = window.speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith('es'));
  const pref = ['es-co', 'es-mx', 'es-us', 'es-es'];
  for (const p of pref) {
    const v = voces.find(x => x.lang.toLowerCase().replace('_', '-') === p);
    if (v) return v;
  }
  return voces[0] || null;
}

export function vozDisponible() {
  return 'speechSynthesis' in window && !!(vozElegida || (vozElegida = elegirVoz()));
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { vozElegida = elegirVoz(); };
}

/** Habla el llamado. Devuelve false si el navegador no tiene voz en español (para usar el sonido de respaldo). */
export function hablarTurno(turno, caja, { volumen = 1, repeticiones = 2 } = {}) {
  if (!('speechSynthesis' in window)) return false;
  vozElegida = vozElegida || elegirVoz();
  if (!vozElegida) return false;
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();
  for (let i = 0; i < repeticiones; i++) {
    const u = new SpeechSynthesisUtterance(textoVoz(turno, caja));
    u.voice = vozElegida; u.lang = vozElegida.lang;
    u.volume = Math.max(0.2, Math.min(1, volumen));
    u.rate = 0.9; u.pitch = 1;
    synth.speak(u);
  }
  return true;
}
