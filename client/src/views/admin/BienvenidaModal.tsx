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


// ── Bienvenida post-login (según el administrador) ───────────────────────────
function saludoHora() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
}

export default function BienvenidaModal({ admin, onCerrar }: { admin: Administrador; onCerrar: () => void }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, 5000);
    return () => clearTimeout(t);
  }, []);

  const primerNombre = admin.nombre.split(' ')[0];
  return (
    <div className="bv-overlay">
      <div className="bv-card">
        <div className="bv-avatar">{admin.avatar}</div>
        <div className="bv-saludo">¡{saludoHora()}, {primerNombre}!</div>
        <div className="bv-nombre">{admin.nombre}</div>
        <div className="bv-rol">{admin.rol}</div>
        <p className="bv-msg">{admin.saludo}</p>
        <div className="bv-progress"><div className="bv-progress-bar" /></div>
        <button className="bv-skip" onClick={onCerrar}>Continuar →</button>
      </div>
    </div>
  );
}

