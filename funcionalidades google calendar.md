# ZENI — Sincronizar con Google Calendar (y otros calendarios)

Objetivo: que los exámenes (y opcionalmente las horas de estudio) que tiene la app aparezcan solos en mi calendario.

Hay dos opciones. Conviene empezar por la **Opción 1** y sumar la **Opción 2** más adelante.

| | Opción 1: link .ics | Opción 2: API de Google |
|---|---|---|
| Dificultad | Fácil | Media |
| Calendarios | Todos (Google, Apple, Outlook) | Solo Google |
| Dirección | App → calendario | App ↔ calendario |
| Velocidad | Google actualiza cada algunas horas | Al instante |

---

## Opción 1: Link de calendario (.ics)

### Qué hace la app
1. Junta todos los exámenes guardados (materia, fecha, hora).
2. Arma un archivo `.ics`, que es el formato estándar de calendarios.
3. Lo publica en un link fijo y secreto, por ejemplo:
   `https://mi-app.com/calendario/abc123-secreto.ics`
4. Cada vez que se agrega o cambia un examen, el archivo se regenera.

### Cómo se ve un examen dentro del .ics

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ZENI//ES
BEGIN:VEVENT
UID:examen-matematica-2026-12-03@zeni
DTSTAMP:20261118T120000Z
DTSTART:20261203T110000Z
DTEND:20261203T130000Z
SUMMARY:Examen de Matemática
DESCRIPTION:Temas: funciones y derivadas
END:VEVENT
END:VCALENDAR
```

- `UID` tiene que ser único y **no cambiar** para cada examen; así el calendario sabe que es el mismo evento si lo editás.
- Las horas van en UTC (la Z del final). Argentina es UTC-3: 08:00 en Argentina = 11:00Z.

### Cómo suscribirse

- **Google Calendar** (desde la compu, en la web): *Otros calendarios* → **+** → *Desde URL* → pegar el link → *Añadir calendario*.
- **Apple Calendar**: *Archivo* → *Nueva suscripción a calendario* → pegar el link.
- **Outlook**: *Agregar calendario* → *Suscribirse desde la web* → pegar el link.

Una vez hecho en la compu, aparece también en el celular.

### Ojo
- Google refresca los calendarios suscritos cada varias horas, no al instante.
- El link tiene que ser secreto (difícil de adivinar), porque quien lo tenga puede ver tus exámenes.

---

## Opción 2: Conectar la cuenta de Google (API de Google Calendar)

### Paso 1: Preparar Google Cloud
1. Entrar a **console.cloud.google.com** y crear un proyecto nuevo (ej. "ZENI").
2. Ir a *APIs y servicios* → *Biblioteca* → buscar **Google Calendar API** → *Habilitar*.
3. Configurar la **pantalla de consentimiento OAuth**:
   - Tipo: *Externo*.
   - Poner nombre de la app y tu mail.
   - En *Usuarios de prueba*, agregar tu propia cuenta de Gmail (como la app es solo para vos, no hace falta publicarla).
4. Ir a *Credenciales* → *Crear credenciales* → **ID de cliente de OAuth**:
   - Elegir el tipo según tu app (web, escritorio, Android, etc.).
   - Guardar el **Client ID** y el **Client Secret**. No los subas a GitHub.

### Paso 2: Permiso que pide la app
- Usar el permiso (scope) más chico que alcance:
  - `https://www.googleapis.com/auth/calendar.events` → crear, editar y borrar eventos.
  - Si solo querés leer: `https://www.googleapis.com/auth/calendar.readonly`.

### Paso 3: Flujo dentro de la app
1. Botón **"Conectar con Google"**.
2. Se abre el login de Google y aceptás los permisos.
3. La app recibe un **token** y lo guarda; con eso ya puede usar tu calendario sin volver a pedir login.
4. Opcional: crear un calendario aparte llamado "ZENI" para no mezclar con tus eventos personales.

### Paso 4: Qué hace la app con la conexión
- **Examen nuevo** → crea el evento en Google Calendar y guarda el ID que devuelve Google.
- **Examen editado** → actualiza ese mismo evento usando el ID guardado.
- **Examen borrado** → borra el evento.
- **Leer tu calendario** → ver qué horas tenés ocupadas para no agendarte estudio encima.
- **Desde Google hacia la app** (opcional): revisar cada tanto si cambiaste algo en el calendario y traer los cambios.

### Librerías útiles
- Python: `google-api-python-client` + `google-auth-oauthlib`
- JavaScript/Node: `googleapis`

---

## Funcionalidades que suma a ZENI

- Los exámenes detectados en la foto del calendario institucional pasan solos a mi calendario.
- Opción de mandar también las **horas de estudio** y las **preguntas agendadas** como eventos.
- Recordatorios automáticos antes de cada examen (ej. 1 día antes y 2 horas antes).
- Botón para elegir con qué calendario sincronizar: link .ics (cualquiera) o cuenta de Google.
