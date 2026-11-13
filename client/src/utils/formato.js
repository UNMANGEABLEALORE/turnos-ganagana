/**
 * Formato de turno: LETRA + 2 dígitos.
 *   0  → A00 … 99 → A99, 100 → B00 … 199 → B99 … 2599 → Z99, 2600 → A00 (vuelve a empezar)
 * El servidor guarda un contador entero; la letra se calcula aquí.
 * (La misma lógica está en server/turno.js y en display/index.html — las pruebas verifican que coincidan.)
 */
export function formatTurno(n) {
  if (n == null || n === '') return '---';
  const num = parseInt(n, 10);
  if (!Number.isFinite(num) || num < 0) return '---';
  const letra = String.fromCharCode(65 + (Math.floor(num / 100) % 26));
  return letra + String(num % 100).padStart(2, '0');
}
