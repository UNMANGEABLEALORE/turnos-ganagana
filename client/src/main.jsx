import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SelectorPage from './pages/SelectorPage';
import CajaPage     from './pages/CajaPage';
import AdminPage    from './pages/AdminPage';
import DisplayPage  from './pages/DisplayPage';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Selector de caja (pantalla de inicio para asesoras) */}
        <Route path="/"          element={<SelectorPage />} />
        {/* Pantallas de caja 1-4 */}
        <Route path="/caja/:id"  element={<CajaPage />} />
        {/* Pantalla pública para la sala de espera / TV */}
        <Route path="/pantalla"  element={<DisplayPage />} />
        {/* Panel del administrador (protegido con contraseña) */}
        <Route path="/admin"     element={<AdminPage />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
