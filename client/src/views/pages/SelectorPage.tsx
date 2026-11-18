import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER } from '../../controllers/api';
import { colorCaja, listaCajas } from '../../models/cajas';
import './SelectorPage.css';

export default function SelectorPage() {
  const navigate = useNavigate();
  const [total, setTotal] = useState(4);   // cuántas cajas hay (el administrador puede agregar)
  useEffect(() => {
    fetch(`${SERVER}/api/config`).then(r => r.json()).then(c => { if (c.numCajas) setTotal(c.numCajas); }).catch(() => {});
  }, []);

  return (
    <div className="selector-page">
      <div className="selector-card card">
        <div className="selector-logo">🎟️</div>
        <h1>Sistema de Turnos</h1>
        <p className="selector-sub">Selecciona tu caja para comenzar</p>

        {/* Botones de caja — para las asesoras */}
        <div className="selector-grid">
          {listaCajas(total).map(n => (
            <button
              key={n}
              className={`btn btn-${colorCaja(n)} selector-btn`}
              onClick={() => navigate(`/caja/${n}`)}
            >
              <span className="selector-num">{n}</span>
              <span className="selector-label">Caja {n}</span>
            </button>
          ))}
        </div>

        <div className="selector-divider" />

        {/* Accesos secundarios */}
        <div className="selector-bottom">
          <button
            className="btn btn-sky selector-display-btn"
            onClick={() => navigate('/pantalla')}
          >
            📺 Pantalla pública (sala de espera)
          </button>

          <button
            className="btn btn-lavender selector-admin"
            onClick={() => navigate('/admin')}
          >
            ⚙️ Panel Administrativo
          </button>
        </div>
      </div>
    </div>
  );
}
