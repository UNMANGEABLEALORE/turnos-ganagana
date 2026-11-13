/** Tipos compartidos del frontend (reflejan lo que envía el servidor). */

export type NumeroCaja = 1 | 2 | 3 | 4;
export type EstadoCaja = 'activa' | 'inactiva';

export interface TurnoLlamado { turno: number; caja: number; }
export interface InfoCaja { turno: number; llamado_en: string; }

export interface EstadoSistema {
  contador: number;
  cajas: Record<number, InfoCaja | null>;
  cajasEstado: Record<number, EstadoCaja>;
  ultimos: TurnoLlamado[];
}

export interface ConfigSistema {
  establecimiento: string;
  volumen: number;     // 0..1
  silencio: boolean;
}

export interface PresenciaItem { conectada: boolean; falla: boolean; detalle: string; }
export interface Presencia {
  cajas: Record<number, PresenciaItem>;
  pantalla: PresenciaItem;
  admin: { conectada: boolean };
}

export interface RegistroHistorial { id: number; turno: number; caja: number; llamado_en: string; }

export interface Administrador {
  id: number;
  usuario: string;
  nombre: string;
  rol: string;
  avatar: string;
  saludo: string;
  principal: boolean;
  emails: string[];
  github: string;
  debeCambiar: boolean;
}

export interface ConfigAuth {
  hcaptchaSitekey: string;
  hcaptchaPrueba: boolean;
  google: boolean;
  github: boolean;
}

/** Respuesta genérica de la API REST. */
export interface RespuestaApi<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string; espera?: number };
}

/** Respuesta de los eventos Socket.IO con callback. */
export interface AckSocket { ok: boolean; error?: string; turno?: number; caja?: number; }
