/**
 * Validaciones lógicas del frontend. Cada función devuelve `null` si el dato es válido
 * o un texto con el motivo si no. El servidor repite TODAS estas reglas (nunca se confía
 * solo en el navegador); aquí se validan para avisar al usuario antes de enviar.
 */

export type Resultado = string | null;

export const CAJAS_VALIDAS = [1, 2, 3, 4] as const;

export function validarCaja(valor: unknown): Resultado {
  const n = Number(valor);
  return Number.isInteger(n) && (CAJAS_VALIDAS as readonly number[]).includes(n)
    ? null : 'La caja debe ser 1, 2, 3 o 4.';
}

export function validarContadorTurno(valor: unknown): Resultado {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 ? null : 'El número de turno debe ser un entero mayor o igual a 0.';
}

export function validarVolumen(v: unknown): Resultado {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? null : 'El volumen debe estar entre 0 % y 100 %.';
}

export function validarEstablecimiento(nombre: string): Resultado {
  const t = nombre.trim();
  if (t.length < 2) return 'El nombre del establecimiento es muy corto.';
  if (t.length > 60) return 'El nombre del establecimiento no puede pasar de 60 caracteres.';
  if (!/^[\p{L}\p{N} .,&'’()\-#·]+$/u.test(t)) return 'Solo letras, números y . , & - # ( ) en el nombre.';
  return null;
}

export function validarUsuario(u: string): Resultado {
  return /^[A-Za-z0-9._-]{4,24}$/.test(u) ? null : 'Usuario: 4 a 24 caracteres (letras, números, . _ -).';
}

export function validarClave(c: string): Resultado {
  if (c.length < 8) return 'La contraseña debe tener mínimo 8 caracteres.';
  if (!/[A-Za-z]/.test(c) || !/\d/.test(c)) return 'La contraseña debe combinar letras y números.';
  if (/^(12345678|password|contraseña|qwerty123)/i.test(c)) return 'Esa contraseña es demasiado común.';
  return null;
}

export function validarCorreo(c: string): Resultado {
  if (!c) return null; // opcional
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.trim()) ? null : 'Correo inválido.';
}

export function validarGithub(u: string): Resultado {
  if (!u) return null; // opcional
  return /^[A-Za-z0-9-]{1,39}$/.test(u.trim()) ? null : 'Usuario de GitHub inválido.';
}

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

export function validarNombreReal(nombre: string): Resultado {
  const n = nombre.trim().replace(/\s+/g, ' ');
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

/** Devuelve el primer error de una lista de resultados, o null si todo está bien. */
export function primerError(...resultados: Resultado[]): Resultado {
  return resultados.find(r => r !== null) ?? null;
}
