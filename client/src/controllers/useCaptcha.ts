import { useEffect, useRef, useState } from 'react';

// ── hCaptcha (verificado también en el servidor) ─────────────────────────────
export function useCaptcha(sitekey?: string) {
  const ref      = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | number | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!sitekey) return;
    let vivo = true;
    function render() {
      if (!vivo || !ref.current || widgetId.current !== null || !window.hcaptcha) return false;
      widgetId.current = window.hcaptcha.render(ref.current, {
        sitekey, theme: 'light',
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken('')
      });
      return true;
    }
    if (!document.getElementById('hcaptcha-script')) {
      const s = document.createElement('script');
      s.id = 'hcaptcha-script';
      s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
    if (!render()) {
      const t = setInterval(() => { if (render()) clearInterval(t); }, 300);
      return () => { vivo = false; clearInterval(t); };
    }
    return () => { vivo = false; };
  }, [sitekey]);

  return {
    ref, token,
    reset: () => {
      if (window.hcaptcha && widgetId.current !== null) window.hcaptcha.reset(widgetId.current);
      setToken('');
    }
  };
}

