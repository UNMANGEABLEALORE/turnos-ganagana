/** Misma regla que client/src/utils/formato.js: contador 0 → A00 … 99 → A99, 100 → B00 … 2599 → Z99, 2600 → A00 */
function formatTurno(n) {
  const num = parseInt(n, 10);
  if (!Number.isFinite(num) || num < 0) return '---';
  const letra = String.fromCharCode(65 + (Math.floor(num / 100) % 26));
  return letra + String(num % 100).padStart(2, '0');
}
module.exports = { formatTurno };
