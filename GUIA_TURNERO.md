# Guía del Turnero GanaGana

Sistema de turnos con 4 cajas, pantalla pública con voz y panel de administración.

## 1. Direcciones

| Qué | Local (este computador) | Internet (Render) |
|---|---|---|
| Inicio | http://localhost:3001 | https://turnos-ganagana.onrender.com |
| Administración | http://localhost:3001/admin | https://turnos-ganagana.onrender.com/admin |
| Pantalla pública | http://localhost:3001/pantalla | https://turnos-ganagana.onrender.com/pantalla |
| Caja 1 · 2 · 3 · 4 | http://localhost:3001/caja/1 … /caja/4 | https://turnos-ganagana.onrender.com/caja/1 … /caja/4 |

Desde otro equipo de la misma red, cambia `localhost` por la IP del computador que tiene el servidor.

## 2. Encender el sistema
1. Doble clic en `iniciar.bat` (o, en una terminal dentro de `server`: `node index.js`).
2. Abre la dirección que necesites. En producción (Render) no hay que encender nada.

## 3. Numeración de turnos
El turno es **una letra + dos números**: `A00` … `A99`, luego `B00` … `B99`, y así hasta `Z99`; después vuelve a `A00`.
Son 2 600 turnos por ciclo. El botón rojo del admin reinicia a `A00`.

## 4. Cajeras (cada caja)
1. Abre **su** caja (por ejemplo `/caja/2`).
2. Pulsa **"Llamar siguiente turno"** o la tecla **F9**.
3. El turno aparece en su pantalla y la pantalla pública lo anuncia.

**Una caja = una persona.** Si otra persona intenta abrir una caja ocupada ve el aviso *"Caja X no disponible"* y no puede llamar turnos.
- Si la cajera recarga la página, recupera su caja sola.
- Si cierra el navegador, la caja queda reservada ~15 s por si fue un descuido.
- Si algo se traba, el administrador pulsa **"🔓 Liberar caja"** en el panel.

## 5. Pantalla pública (TV de la sala de espera)
1. Abre `/pantalla` en el televisor o computador de la sala.
2. Pulsa **una vez** "Activar pantalla" (el navegador no deja sonar sin ese clic).
3. Al llamar un turno: parpadea el borde amarillo, suena una campanilla y una voz dice, despacio y dos veces:
   > "Atención. Turno, letra *a*, de *Ana*. Número *veintidós*. *Dos, dos*. Diríjase a la caja número *dos*."
4. Botón **🔊 Probar voz** y selector de voz: si la voz no te gusta, elige otra de la lista. Las voces "Natural/Online" de **Microsoft Edge** son las más claras.
5. El tamaño se ajusta solo a cualquier pantalla (horizontal o vertical).

## 6. Administración
1. Entra a `/admin`, marca la autorización de datos personales y resuelve el CAPTCHA.
2. Usuario y contraseña: están en `credenciales/administradores.json` (ver sección 8). También puedes entrar con Google o GitHub si ya se configuraron y vinculaste tu cuenta.
3. Desde el panel:
   - Ver el estado de cada caja y de la pantalla en tiempo real.
   - Activar/desactivar o liberar una caja.
   - Cambiar nombre del establecimiento, volumen y silencio; **probar la voz**.
   - Reiniciar el contador (`A00`).
   - Ver el historial de turnos.
   - **Mi cuenta**: cambiar contraseña y vincular Google/GitHub.
   - **Administradores**: el principal crea o elimina administradores (solo nombres reales).

## 7. Dónde y cómo se guardan los datos
Sin base de datos se usa **un archivo JSON** (`server/data/store.json`). En producción los datos van a **Supabase** (ver sección 12).

```
server/data/store.json
├─ config      → contador, nombre del establecimiento, volumen, estado de cada caja
├─ historial   → cada turno llamado: id, número, caja y hora
└─ admins      → administradores (la contraseña va CIFRADA con scrypt, nunca en texto)
```

**¿Por qué JSON?** El sistema tiene 4 cajas y unas pocas decenas de escrituras por hora: un archivo es más que suficiente, no requiere instalar nada y es fácil de respaldar (copiar un archivo). Node.js ejecuta una operación a la vez, así que dos cajas **no pueden recibir el mismo número**: cada turno se asigna y se guarda en un solo paso.

**Limitaciones (importante):**
- En el plan gratuito de Render el disco se borra en cada reinicio o despliegue: allí se pierden turnos y administradores creados desde el panel.
  Para producción real conviene un disco persistente o una base de datos (PostgreSQL); el acceso a datos está aislado en `server/db.js`, así que cambiarlo no afecta al resto.
- Respalda `server/data/store.json` si necesitas conservar el historial.

## 8. Credenciales (nada en el código)
Todo lo secreto está en la carpeta **`credenciales/`**, que Git ignora:

| Archivo | Contenido |
|---|---|
| `credenciales/administradores.json` | Usuarios y contraseñas iniciales de los administradores |
| `credenciales/.env` | Claves de hCaptcha, Google, GitHub y URL pública |
| `credenciales/sesion.secret` | Clave para firmar sesiones (se crea sola) |
| `credenciales/ejemplo.*` | Plantillas sin datos reales (sí se suben) |

- Si `administradores.json` no existe, al primer arranque se crea el principal con una **contraseña aleatoria** y se guarda ahí.
- Las contraseñas del archivo son solo la fuente inicial; en `server/data/store.json` quedan cifradas. Cambia la tuya en **Mi cuenta**.
- En Render no hay carpeta: las mismas claves se escriben en **Environment** (`ADMIN_PRINCIPAL_PASSWORD`, `HCAPTCHA_*`, `GOOGLE_*`, `GITHUB_*`, `PUBLIC_URL`).
- Detalles en `credenciales/LEEME.md`.

## 9. Validaciones (dónde se revisa cada dato)
Cada dato se valida **dos veces**: en el navegador (para avisar rápido, `client/src/utils/validaciones.ts`) y en el servidor (la que realmente protege).

| Dato | Regla |
|---|---|
| Caja | Solo 1, 2, 3 o 4 |
| Turno | Solo lo asigna el servidor (contador entero); el cliente no lo puede inventar |
| Quién llama | Solo el equipo que ocupa esa caja; máximo 1 llamado cada 0,4 s |
| Volumen | Número entre 0 y 1 |
| Establecimiento | 2–60 caracteres, sin `<` ni `>` |
| Usuario | 4–24 caracteres: letras, números, `.` `_` `-` |
| Contraseña | 8+ caracteres con letras y números |
| Nombre de administrador | Nombre y apellido reales; se rechazan personajes y seres fantásticos |
| Acceso | CAPTCHA verificado en el servidor, máx. 5 intentos por minuto |
| Sesión | Cookie `HttpOnly`, firmada, de 8 horas |

## 10. Solución de problemas
- **No suena la voz:** haz clic en "Activar pantalla", sube el volumen del equipo y prueba **🔊 Probar voz**. Si suena rara, elige otra voz en el selector o usa Microsoft Edge.
- **"Caja X no disponible":** la usa otra persona. Pide al administrador **Liberar caja** o espera ~15 s.
- **La pantalla se ve pequeña:** recarga con **Ctrl + F5**.
- **No entro al admin:** revisa `credenciales/administradores.json`. Si lo borraste: elimina `"admins"` de `server/data/store.json` y reinicia.
- **Render tarda en abrir:** el plan gratuito se "duerme"; la primera visita puede tardar ~1 minuto.

## 11. Para quien mantiene el sistema
- **Frontend:** React 18 + **TypeScript** + Vite, organizado en `client/src/models`, `controllers` y `views`. `npm run build --prefix client` revisa los tipos y compila.
- **Servidor:** Node.js + Express + Socket.IO con arquitectura MVC (`server/models`, `controllers`, `routes`, `middlewares`, `services`). Ver README.md.
- **Pruebas automáticas:** `npm test` o `node server/tests/pruebas.js` (91 comprobaciones: formato de turnos, voz, validaciones, credenciales, exclusividad de caja, datos inválidos). Usan puerto y archivos temporales; no tocan tus datos.

## 12. Producción en Render (operación diaria 6 am – 11 pm)

El turnero vive en **Render**: las cajas (PC) y el Smart TV solo necesitan internet y abrir su dirección.

| Equipo | Dirección |
|---|---|
| Caja 1 … 4 (PC de cada asesora) | https://turnos-ganagana.onrender.com/caja/1 … /caja/4 |
| Smart TV (sala de espera) | https://turnos-ganagana.onrender.com/pantalla |
| Administración | https://turnos-ganagana.onrender.com/admin |

**Automático, sin intervención:**
- El contador vuelve a **A00 cada día a las 06:00** (hora de Colombia). Se cambia o desactiva en *Configuración general*.
- Render vuelve a levantar el servicio si se cae (revisa `/api/salud`), y el servidor se mantiene despierto solo.
- Las cajas y la pantalla se reconectan solas si se corta el internet.

### Base de datos permanente: Supabase (obligatoria para producción)
El plan gratis de Render **borra el disco en cada reinicio**. Con Supabase (Postgres) se guarda todo lo importante:

| Tabla | Qué guarda | Se depura |
|---|---|---|
| `contador` | El número actual de turno (una sola fila) | **Nunca**: así la numeración sigue al otro día (los turnos son de papel) |
| `turnos` | Historial de turnos llamados | Solo, pasados **7 días** |
| `configuracion` | Nombre, volumen, cajas, etc. | No |
| `administradores` | Usuarios del panel (clave cifrada) | No |
| `actividad` | Reporte de lo que hace cada administrador | Solo, pasados 90 días |

Las tablas se crean solas al arrancar y tienen **RLS activado**: la API pública de Supabase no puede leerlas.

1. https://supabase.com/dashboard → *New project* (anota la contraseña de la base de datos; mejor solo letras y números).
2. *Connect* → pestaña **Transaction pooler** → copia la URI (`postgresql://postgres.xxxx:[TU-CLAVE]@...pooler.supabase.com:6543/postgres`) y reemplaza `[TU-CLAVE]`.
3. Pásala a **Render** → *Environment* → `DATABASE_URL`. Guarda: Render se reinicia solo.
4. El panel → *Operación del día* debe decir **“Supabase (permanente)”**.
5. Para llevar los datos de este equipo a Supabase (una sola vez): pon `DATABASE_URL=...` en `credenciales/.env`, ejecuta
   `npm run migrar --prefix server` y **quita la línea** del `.env` (no corras el turnero local y Render a la vez contra la misma base de datos).

### Smart TV
- Abre `/pantalla` en el navegador del televisor y pulsa **Activar pantalla** con el control remoto.
- Muchos navegadores de televisor **no traen voz**: si es así, la pantalla lo avisa y los turnos se anuncian con la campanilla
  y en grande. Para tener voz, conecta al TV un dispositivo con Chrome (Chromecast con Google TV, Fire TV, mini-PC o portátil por HDMI).
- Desactiva en el televisor el **ahorro de energía / apagado automático** para que no se apague durante la jornada.

## 13. Panel de administraci�n: n�mero, cajas y actividad
- **Fijar n�mero actual:** si el rollo de papel y el sistema no coinciden, escribe el pr�ximo turno (por ejemplo F23). La numeraci�n **no se reinicia sola** al otro d�a; el contador se guarda en Supabase.
- **Cajas:** *Agregar Caja N* crea la siguiente caja (hasta 12) y muestra su enlace (/caja/5, /caja/6�) con bot�n *Copiar*. Solo se quita la �ltima, y solo si nadie la usa.
- **Actividad de los administradores:** tabla con fecha, qui�n, qu� hizo y detalle (ingresos, intentos fallidos, n�mero fijado, cajas, configuraci�n, administradores). El administrador principal ve a todos y puede filtrar; los dem�s solo ven lo suyo. Se guarda 90 d�as.
- **Turnos:** el historial se depura solo a los 7 d�as; el contador y la actividad (90 d�as) no se tocan antes.
