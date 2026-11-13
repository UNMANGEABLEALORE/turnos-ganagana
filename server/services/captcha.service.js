/** services/captcha.service.js — Verificación de hCaptcha en el servidor. */

// Sin claves en credenciales/.env se usan las claves de PRUEBA oficiales de hCaptcha (siempre aprueban).
const SITEKEY = process.env.HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001';
const SECRET  = process.env.HCAPTCHA_SECRET  || '0x0000000000000000000000000000000000000000';
const MODO_PRUEBA = !process.env.HCAPTCHA_SITEKEY;

async function verificar(token, ip) {
  if (!token) return false;
  try {
    const r = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: SECRET, response: token, sitekey: SITEKEY, remoteip: ip || '' })
    });
    const j = await r.json();
    return j.success === true;
  } catch (e) {
    console.error('Error verificando CAPTCHA:', e.message);
    return false;
  }
}

module.exports = { SITEKEY, MODO_PRUEBA, verificar };
