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
  numCajas?: number;          // cuántas cajas hay (el administrador puede agregar)
  reinicioDiario?: boolean;   // el contador vuelve a A00 cada mañana
  horaReinicio?: string;      // "HH:MM", hora de Colombia
}

export interface EstadoServidor {
  encendidoDesde: string;
  segundosEncendido: number;
  enRender: boolean;
  direccion: string;
  numCajas?: number;
  turnosPermanentes: boolean;   // true = turnos y contador guardados en la base de datos (sobreviven a reinicios)
  almacenamiento: string;       // dónde están los administradores
  reinicioDiario: boolean;
  horaReinicio: string;
  ultimoReinicio: string | null;
  horaColombia: string;
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

export interface FilaActividad { id: number; cuando: string; adminId: number | null; usuario: string; nombre: string; accion: string; detalle: string; ip: string; }
export interface ResumenActividad { usuario: string; nombre: string; acciones: number; ultima: string; }
