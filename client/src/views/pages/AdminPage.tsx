import React, { useEffect, useState } from 'react';
import { api } from '../../controllers/api';
import type { Administrador } from '../../models/types';
import LoginAdmin from '../admin/LoginAdmin';
import PanelAdmin from '../admin/PanelAdmin';
import './AdminPage.css';

// ── Exportación: la sesión la decide el servidor (cookie HttpOnly) ───────────
export default function AdminPage() {
  const [admin, setAdmin]   = useState<Administrador | null>(null);
  const [listo, setListo]   = useState(false);
  const [nuevo, setNuevo]   = useState(false);

  useEffect(() => {
    api<{ admin: Administrador }>('/api/auth/me').then(r => {
      if (r.ok) {
        setAdmin(r.data.admin);
        // Tras volver de Google/GitHub (sesión recién creada) también se da la bienvenida
        if (document.referrer && !document.referrer.startsWith(window.location.origin)) setNuevo(true);
      }
      setListo(true);
    });
  }, []);

  useEffect(() => {
    document.title = !listo ? 'Cargando… · GanaGana'
      : admin ? 'Panel de Control · Administración GanaGana'
              : 'Acceso Administradores · GanaGana';
  }, [admin, listo]);

  async function salir() {
    await api('/api/auth/logout', { method: 'POST' });
    setAdmin(null);
  }

  if (!listo) return <div className="al-page"><span className="al-spinner al-spinner--big" /></div>;
  if (!admin) return <LoginAdmin onOk={a => { setNuevo(true); setAdmin(a); }} />;
  return <PanelAdmin admin={admin} onLogout={salir} onActualizar={setAdmin} recienIngresado={nuevo} />;
}


