import React, { useState, useEffect } from 'react';
import './CookieBanner.css';

const COOKIE_CONSENT = 'gg_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT);
    if (!consent) setVisible(true);
  }, []);

  function aceptar() {
    localStorage.setItem(COOKIE_CONSENT, 'accepted');
    setVisible(false);
  }

  function rechazar() {
    localStorage.setItem(COOKIE_CONSENT, 'rejected');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Aviso de cookies">
      <div className="cookie-banner-content">
        <span className="cookie-icon">🍪</span>
        <div className="cookie-text">
          <strong>Este sitio usa cookies</strong>
          <p>
            Usamos una cookie de sesión esencial (HttpOnly, segura) para mantener tu acceso
            al panel; sin ella el panel no funciona. El CAPTCHA (hCaptcha) y el ingreso con
            Google o GitHub pueden usar cookies de esos servicios, y solo leen tu nombre y
            correo con tu autorización expresa en el formulario de acceso. No vendemos ni
            compartimos tus datos. Más información en la{' '}
            <a href="https://www.ganagana.com.co/cumplimiento-normativo/?tab=3"
               target="_blank" rel="noopener noreferrer">
              Política de Datos GanaGana
            </a>.
          </p>
        </div>
        <div className="cookie-btns">
          <button className="cookie-btn cookie-btn--accept" onClick={aceptar}>
            Aceptar
          </button>
          <button className="cookie-btn cookie-btn--reject" onClick={rechazar}>
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
