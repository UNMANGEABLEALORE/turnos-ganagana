import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import SelectorPage from './views/pages/SelectorPage';
import CajaPage     from './views/pages/CajaPage';
import AdminPage    from './views/pages/AdminPage';
import DisplayPage  from './views/pages/DisplayPage';
import CookieBanner from './views/components/CookieBanner';
import './views/styles/global.css';

// ── Título dinámico por ruta ──────────────────────────────────────────────────
const TITULOS: Record<string, string> = {
  '/':          'Inicio · Selector de módulo | GanaGana',
  '/caja/1':    'Caja 1 · Atención al cliente | GanaGana',
  '/caja/2':    'Caja 2 · Atención al cliente | GanaGana',
  '/caja/3':    'Caja 3 · Atención al cliente | GanaGana',
  '/caja/4':    'Caja 4 · Atención al cliente | GanaGana',
  '/pantalla':  'Pantalla de Turnos · Sala de Espera | GanaGana',
  '/admin':     'Acceso Administradores | GanaGana',
};

function TituloSincronizado(): null {
  const loc = useLocation();
  React.useEffect(() => {
    const titulo = TITULOS[loc.pathname] || 'Sistema de Turnos | GanaGana';
    document.title = titulo;
  }, [loc.pathname]);
  return null;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <TituloSincronizado />
      <Routes>
        <Route path="/"          element={<SelectorPage />} />
        <Route path="/caja/:id"  element={<CajaPage />} />
        <Route path="/pantalla"  element={<DisplayPage />} />
        <Route path="/admin"     element={<AdminPage />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
      <CookieBanner />
    </BrowserRouter>
  </React.StrictMode>
);


