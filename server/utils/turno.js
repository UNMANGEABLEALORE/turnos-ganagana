/** Misma regla que client/src/models/formato.ts: contador 0 → A00 … 99 → A99, 100 → B00 … 2599 → Z99, 2600 → A00 */
function formatTurno(n) {
  const num = parseInt(n, 10);
  if (!Number.isFinite(num) || num < 0) return '---';
  const letra = String.fromCharCode(65 + (Math.floor(num / 100) % 26));
  return letra + String(num % 100).padStart(2, '0');
}
/** "F23" → 523 (letra × 100 + número). Devuelve null si no tiene la forma letra + dos dígitos. */
function parseTurno(texto) {
  const m = /^([A-Za-z])(\d{2})$/.exec(String(texto ?? '').trim());
  return m ? (m[1].toUpperCase().charCodeAt(0) - 65) * 100 + Number(m[2]) : null;
}
module.exports = { formatTurno, parseTurno };
