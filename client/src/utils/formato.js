/**
 * Formatea un número de turno:
 * 0-999   → 3 dígitos con ceros ("005", "123")
 * 1000+   → sin padding ("1000", "1001")
 */
export function formatTurno(n) {
  if (n == null) return '---';
  const num = parseInt(n, 10);
  if (num < 1000) return String(num).padStart(3, '0');
  return String(num);
}
