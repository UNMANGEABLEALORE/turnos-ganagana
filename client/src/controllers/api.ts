import type { RespuestaApi } from '../models/types';

// En desarrollo Vite hace proxy de /api → así la cookie de sesión es del mismo origen.
export const SERVER = import.meta.env.VITE_SERVER_URL || '';

// ── Cliente API (la sesión viaja en una cookie HttpOnly, no se guarda nada en JS) ──
interface OpcionesApi { method?: string; body?: unknown; }

export async function api<T = Record<string, unknown>>(ruta: string, { method = 'GET', body }: OpcionesApi = {}): Promise<RespuestaApi<T>> {
  const res = await fetch(`${SERVER}${ruta}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {} as RespuestaApi<T>['data'];
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { ok: res.ok, status: res.status, data };
}
