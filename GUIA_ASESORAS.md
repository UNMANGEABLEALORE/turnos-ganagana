# Guía de Uso — Sistema de Turnos GanaGana
### Para las asesoras de atención al público

---

## ¿Qué es este sistema?

El Sistema de Turnos es una herramienta que permite llamar a los usuarios por número de turno de forma organizada. Cada asesora tiene asignada una caja y puede llamar al siguiente turno con solo presionar una tecla. La pantalla del televisor en la sala de espera muestra quién es llamado en cada momento.

---

## 1. Cómo abrir el sistema

1. Enciende el computador y espera a que cargue Windows.
2. Abre el navegador (Google Chrome o Microsoft Edge).
3. Escribe en la barra de dirección:

   ```
   http://localhost:5173
   ```
   (O la dirección que te indique el administrador, por ejemplo: `http://192.168.1.100:5173`)

4. Verás una pantalla con cuatro botones, uno por cada caja.

---

## 2. Cómo identificar tu caja

- Cada computador tiene asignada una caja fija.
- El administrador te indicó qué número de caja usas (Caja 1, Caja 2, Caja 3 o Caja 4).
- Haz clic en el botón de **tu caja**.

> **Ejemplo:** Si eres la asesora de la Caja 2, haz clic en el botón grande que dice "Caja 2".

---

## 3. Cómo llamar el siguiente turno

Una vez dentro de tu pantalla de caja, tienes dos opciones:

### Opción A — Con el teclado (recomendado)
- Presiona la tecla **F9** una sola vez.
- El sistema asignará automáticamente el siguiente número disponible.

### Opción B — Con el mouse
- Haz clic en el botón grande **"Llamar siguiente turno"**.

**¿Qué pasa después de llamar?**

1. El número grande en tu pantalla cambia al turno que acabas de llamar.
2. La pantalla del televisor en la sala de espera muestra el nuevo turno y el número de tu caja.
3. Escuchas un sonido suave de notificación.
4. El usuario con ese número se acerca a tu caja.

> **Importante:** Espera siempre a que el usuario llegue y sea atendido antes de llamar al siguiente turno.

---

## 4. Qué muestra la pantalla del televisor

La pantalla pública (el televisor en la sala de espera) muestra:

- **Número grande al centro:** El turno que está siendo atendido ahora mismo.
- **"DIRÍJASE A LA CAJA X":** El número de la caja que llamó ese turno.
- **"Siguiente":** El turno que fue llamado antes (para referencia).
- **"Después":** El turno anterior a ese.

Los usuarios solo deben acercarse cuando escuchen el sonido y vean su número en la pantalla.

---

## 5. Cómo funciona el sonido

- Cada vez que se llama un turno, se escucha un sonido suave (dos tonos).
- El sonido se produce en la pantalla pública del televisor.
- También puede sonar en tu computador si el volumen está activado.

**¿No se escucha el sonido en el televisor?**

1. Alguien debe hacer clic en el botón "Activar pantalla" la primera vez que se abre el televisor.
2. Esto es normal y es un requisito de seguridad de los navegadores.
3. Verifica que el volumen del televisor/computador no esté silenciado.

---

## 6. Qué hacer cuando un turno no cambia

Si presionaste F9 (o el botón) y el número en pantalla no cambió:

1. **Espera 2 segundos** — a veces hay un pequeño retardo de red.
2. Si sigue igual, revisa el indicador de conexión en la esquina superior derecha de tu pantalla.
3. Si dice **"Sin conexión"** (en rojo), sigue las instrucciones del punto 7.
4. Si dice **"Conectada"** (en verde) y aun así no cambia, presiona F9 una vez más.

> **No presiones F9 varias veces seguidas** — el sistema tiene protección, pero podría registrar turnos de más si se presiona muy rápido.

---

## 7. Qué hacer si se pierde la conexión

La pantalla mostrará un aviso en rojo: **"Sin conexión con el servidor"**.

**Pasos a seguir:**

1. **No llames ningún turno mientras aparezca el aviso rojo.**
2. Espera unos 30 segundos — el sistema intenta reconectarse automáticamente.
3. Si la conexión vuelve (el indicador vuelve a verde), puedes continuar normalmente.
4. Si después de 2 minutos no se reconecta, avisa al administrador.

**No cierres ni recargues el navegador** mientras esperas — esto podría perder el estado de tu caja.

---

## 8. Cómo reportar un error

Si ves algo raro (número incorrecto, pantalla en blanco, sonido que no para, etc.):

1. Anota el turno en el que ocurrió el error.
2. Anota la hora aproximada.
3. Avisa al administrador inmediatamente.
4. Si el error bloquea tu atención, el administrador puede reiniciar el sistema sin afectar a las demás cajas.

---

## 9. Funciones reservadas para el administrador

Las siguientes acciones **solo las puede hacer el administrador**:

- Reiniciar la numeración al comienzo del día (volver al turno 000).
- Cambiar el nombre del establecimiento en la pantalla.
- Ajustar o silenciar el volumen de la alerta.
- Consultar el historial completo de turnos.
- Acceder al Panel Administrativo (botón en la pantalla de inicio).

> Si necesitas alguna de estas acciones, comunícate con el administrador. No intentes acceder al panel si no estás autorizada.

---

## Resumen rápido

| Acción | Cómo hacerlo |
|--------|-------------|
| Abrir el sistema | Navegar a `http://localhost:5173` |
| Seleccionar mi caja | Clic en el botón de tu caja asignada |
| Llamar siguiente turno | Tecla **F9** o botón en pantalla |
| Ver mi último turno | Número grande en tu pantalla |
| Verificar conexión | Indicador verde/rojo arriba a la derecha |
| Problema de conexión | Esperar y avisar al administrador |
| Error en el sistema | Anotar hora y turno, avisar al administrador |

---

*Sistema de Turnos GanaGana — Versión 1.0*
