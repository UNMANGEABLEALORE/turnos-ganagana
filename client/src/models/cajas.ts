/** models/cajas.ts — Cuántas cajas puede haber y cómo se colorean (los colores se repiten cada 4). */
export const MAX_CAJAS = 12;

/** [1, 2, …, n] */
export const listaCajas = (n: number): number[] => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);

const CICLO = ['sky', 'mint', 'lavender', 'peach'] as const;
const HEX = ['#A8D5E2', '#B5EAD7', '#C9C0E8', '#FFDAB9'];

/** Nombre de color (clase CSS btn-*, caja-bg-*) de una caja. */
export const colorCaja = (n: number): string => CICLO[(n - 1) % 4] ?? 'sky';
/** Color hexadecimal de la caja (pantalla pública). */
export const hexCaja = (n: number): string => HEX[(n - 1) % 4] ?? HEX[0];
/** 1–4: variante de color de la tarjeta del panel (gg-1 … gg-4). */
export const colorGG = (n: number): number => ((n - 1) % 4) + 1;
