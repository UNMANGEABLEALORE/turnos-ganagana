# Carpeta de credenciales

Aquí (y solo aquí) viven las contraseñas y claves del sistema. **Nada de esto está escrito en el código.**

| Archivo | Para qué sirve | ¿Se sube a GitHub? |
|---|---|---|
| `.env` | Claves de hCaptcha, Google, GitHub, URL pública | No |
| `administradores.json` | Administradores iniciales y sus contraseñas | No |
| `sesion.secret` | Clave para firmar sesiones (se crea sola) | No |
| `ejemplo.env`, `ejemplo.administradores.json` | Plantillas sin datos reales | Sí |

## Cómo se usa
1. Copia `ejemplo.env` como `.env` y llena los valores.
2. (Opcional) Copia `ejemplo.administradores.json` como `administradores.json` con tus administradores.
   Si no existe, al primer arranque se crea el principal con una contraseña aleatoria y se guarda ahí.
3. Reinicia el servidor.

## Importante
- Los administradores del archivo solo se cargan cuando el almacén de datos está vacío (primer arranque).
  Para volver a cargarlos, borra la clave `"admins"` de `server/data/store.json` y reinicia.
- Las contraseñas se guardan cifradas (scrypt) en `server/data/store.json`; este archivo es solo la fuente inicial.
  Cambia la contraseña desde el panel (sección "Mi cuenta") y luego puedes borrar la clave del archivo.
- No copies esta carpeta por WhatsApp, correo ni la subas a repositorios.
- En Render no se usa la carpeta: las mismas claves se escriben en **Environment**.
