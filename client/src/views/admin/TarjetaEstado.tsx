import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../controllers/api';
import { useSocket } from '../../controllers/useSocket';
import { useCaptcha } from '../../controllers/useCaptcha';
import { hablarTurno, vozDisponible } from '../../controllers/voz';
import { formatTurno } from '../../models/formato';
import type {
  Administrador, ConfigAuth, EstadoCaja, RegistroHistorial
} from '../../models/types';
import {
  validarClave, validarCorreo, validarEstablecimiento, validarGithub, validarNombreReal,
  validarUsuario, validarVolumen, primerError
} from '../../models/validaciones';


// ── Tarjeta de estado ─────────────────────────────────────────────────────────
interface TarjetaProps {
  titulo: string; icono: string; color: string; conectada: boolean; falla: boolean; detalle: string;
  estadoAdmin: EstadoCaja; turno: number | null; onToggle?: () => void; onLiberar?: () => void; esPanel?: boolean;
}

export default function TarjetaEstado({ titulo, icono, color, conectada, falla, detalle,
                          estadoAdmin, turno, onToggle, onLiberar, esPanel = false }: TarjetaProps) {
  let label: string, cls: string;
  if (estadoAdmin === 'inactiva') { label = 'DESACTIVADA'; cls = 'ts-inactiva'; }
  else if (falla)                  { label = 'FALLA';        cls = 'ts-falla';    }
  else if (conectada)              { label = 'ACTIVA';       cls = 'ts-activa';   }
  else                             { label = 'SIN CONEXIÓN'; cls = 'ts-off';      }

  return (
    <div className={`ts-card ts-card--${color} ${falla ? 'ts-card--falla' : ''}`}>
      {falla && (
        <div className="ts-banner-error">
          ⚠️ <strong>ERROR:</strong> {detalle || 'Sin respuesta del cliente'}
        </div>
      )}
      <div className="ts-header">
        <span className="ts-icon">{icono}</span>
        <div style={{ flex: 1 }}>
          <div className="ts-titulo">{titulo}</div>
          <div className={`ts-estado-badge ${cls}`}>{label}</div>
        </div>
        {!esPanel && onToggle && (
          <button
            className={`ts-toggle ${estadoAdmin === 'activa' ? 'ts-toggle--on' : 'ts-toggle--off'}`}
            onClick={onToggle}
          >
            {estadoAdmin === 'activa' ? '⏸' : '▶'}
          </button>
        )}
      </div>
      <div className="ts-info">
        {turno != null && (
          <div className="ts-turno-actual">
            <span className="ts-turno-label">Último turno</span>
            <span className="ts-turno-num">{formatTurno(turno)}</span>
          </div>
        )}
        <div className="ts-conn-dot-wrap">
          <span className={`ts-conn-dot ${conectada ? 'ts-conn-dot--on' : 'ts-conn-dot--off'}`} />
          <span className="ts-conn-txt">{conectada ? 'En uso' : 'Libre / sin conexión'}</span>
        </div>
        {onLiberar && conectada && (
          <button className="ts-liberar" onClick={onLiberar}>🔓 Liberar caja</button>
        )}
      </div>
    </div>
  );
}


