import React from 'react';
import { useNavigate } from 'react-router-dom';
import './SelectorPage.css';

const CAJAS = [1, 2, 3, 4];
const COLORES = ['sky', 'mint', 'lavender', 'peach'];

export default function SelectorPage() {
  const navigate = useNavigate();

  return (
    <div className="selector-page">
      <div className="selector-card card">
        <div className="selector-logo">🎟️</div>
        <h1>Sistema de Turnos</h1>
        <p className="selector-sub">Selecciona tu caja para comenzar</p>

        {/* Botones de caja — para las asesoras */}
        <div className="selector-grid">
          {CAJAS.map((n, i) => (
            <button
              key={n}
              className={`btn btn-${COLORES[i]} selector-btn`}
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
