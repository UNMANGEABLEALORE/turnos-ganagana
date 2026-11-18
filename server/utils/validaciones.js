/**
 * utils/validaciones.js — Reglas de validación del servidor (las que realmente protegen).
 * Cada función devuelve `null` si el dato es válido o un texto con el motivo.
 * El cliente repite las mismas reglas en client/src/models/validaciones.ts para avisar más rápido.
 */

// No se puede comprobar contra un registro civil; se bloquean personajes,
// seres fantásticos, apodos y entradas que claramente no son nombres reales.
const PROHIBIDOS = [
  'goku','vegeta','naruto','sasuke','luffy','batman','superman','spiderman','spider','hulk','thor',
  'ironman','joker','robin','mario','luigi','pikachu','sonic','zelda','link','yoda','vader','darth',
  'skywalker','potter','harry','hermione','voldemort','gandalf','frodo','aragorn','legolas','shrek',
  'barbie','elsa','anna','mickey','minnie','donald','goofy','pluto','simba','thanos','loki','neo',
  'dragon','dragón','mago','hechicero','bruja','hada','duende','elfo','orco','troll','ogro','vampiro',
  'zombie','demonio','angel','ángel','dios','diosa','rey','reina','princesa','principe','príncipe',
  'ninja','samurai','robot','alien','admin','administrador','usuario','test','prueba','anonimo','anónimo',
  'fulano','mengano','zutano','nadie','nombre','apellido','asdf','qwerty'
];

function validarNombreReal(nombre) {
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (n.length < 5 || n.length > 60) return 'El nombre debe tener entre 5 y 60 caracteres.';
  const palabras = n.split(' ');
  if (palabras.length < 2 || palabras.length > 5) return 'Escribe nombre y apellido (2 a 5 palabras).';
  for (const p of palabras) {
    if (!/^\p{L}+(?:['’-]\p{L}+)*$/u.test(p)) return 'El nombre solo puede tener letras (sin números ni símbolos).';
    if (p.length < 2 || p.length > 20) return 'Cada nombre o apellido debe tener entre 2 y 20 letras.';
    if (/(.)\1{2,}/iu.test(p)) return 'El nombre contiene letras repetidas que no parecen reales.';
    if (!/[aeiouáéíóúüy]/iu.test(p)) return 'Una de las palabras no parece un nombre real.';
    if (PROHIBIDOS.includes(p.toLowerCase())) return `"${p}" no se acepta: usa tu nombre real (no personajes ni seres fantásticos).`;
  }
  return null;
}

function formatearNombre(n) {
  return n.trim().replace(/\s+/g, ' ').split(' ')
    .map(p => p.charAt(0).toLocaleUpperCase('es') + p.slice(1).toLocaleLowerCase('es')).join(' ');
}

function validarUsuario(u) {
  return /^[A-Za-z0-9._-]{4,24}$/.test(u || '') ? null : 'Usuario: 4 a 24 caracteres (letras, números, . _ -).';
}

function validarClave(c, etiqueta = 'La contraseña') {
  return typeof c === 'string' && c.length >= 8 && /[A-Za-z]/.test(c) && /\d/.test(c)
    ? null : `${etiqueta} debe tener 8+ caracteres con letras y números.`;
}

function validarCorreo(c) {
  if (!c) return null; // opcional
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ? null : 'Correo inválido.';
}

function validarGithub(u) {
  if (!u) return null; // opcional
  return /^[A-Za-z0-9-]{1,39}$/.test(u) ? null : 'Usuario de GitHub inválido.';
}

/** ¿Existe esa caja? `total` es cuántas cajas hay configuradas (por defecto 4). */
const esCajaValida = (n, total = 4) => Number.isInteger(n) && n >= 1 && n <= total;

module.exports = {
  validarNombreReal, formatearNombre, validarUsuario, validarClave, validarCorreo, validarGithub, esCajaValida
};
