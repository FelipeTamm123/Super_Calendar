# Super Calendar

App personal para organizar los estudios: subo apuntes, anoto dudas y la IA me arma qué estudiar y cuándo.
Las funcionalidades están descritas en [funcionalidades.md](funcionalidades.md).

## Reglas
1. Usa solo archivos de la carpeta
2. Utilizar el .venv
3. No compartir contraseñas

## Puesta en marcha

1. **Variables:** copiar `.env.example` a `.env` y completar. Para la IA hace falta `GEMINI_API_KEY`
   (sin ella la app anda, pero sin las funciones automáticas).
2. **Base de datos:** en Supabase > SQL Editor, ejecutar **en orden** (una sola vez cada una):
   - `db/migrations/0001_init.sql` (perfiles)
   - `db/migrations/0002_estudio.sql` (materias, horario, apuntes, preguntas, agenda y bucket de archivos;
     borra la tabla de ejemplo `items`)
   - `db/migrations/0003_modalidad_clases.sql` (clases virtuales/presenciales y link de videollamada)
   - `db/migrations/0004_sincronizar_calendario.sql` (link .ics y conexión con Google Calendar)
   - `db/migrations/0005_vigencia_horario.sql` (hasta cuándo vale el horario: las clases dejan de repetirse)
3. **Backend** (en el `.venv`):
   ```powershell
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   .venv\Scripts\python.exe -m uvicorn app.main:app --reload
   ```
   Documentación interactiva: http://localhost:8000/docs
4. **Frontend** (Node portable en `.tools\node`, no se instaló nada en el sistema):
   ```powershell
   $env:Path = "$PWD\.tools\node;$env:Path"
   cd web; npm install; npm run dev
   ```
   → abrir http://localhost:5173
5. **Tests:** `.venv\Scripts\python.exe -m pytest -q` · `cd web; npm test` · `npm run lint`

## Funcionalidades

| Funcionalidad | Pantalla | Cómo funciona |
|---|---|---|
| Subir apuntes (texto, foto o PDF) | **Apuntes** | La IA detecta materia y fecha (si no las indicás), transcribe fotos/PDF, resume, arma qué repasar y detecta temas pendientes. El archivo original queda en un bucket privado de Supabase Storage. |
| Calendario institucional con una foto | **Horario** | La IA lee la foto y arma un **borrador** (materias, días, horas, vigencia del cuatrimestre, si cada clase es presencial o virtual y el link de la videollamada, exámenes, feriados, entregas). Lo revisás/corregís y recién ahí se guarda. Subir otra foto reemplaza el horario. También se edita a mano. |
| Agenda automática | **Hoy** | Los repasos se agendan para el día anterior a la **próxima clase** de la materia (según tu horario, salteando feriados). "Hoy" muestra clases (con botón **Unirse** si son virtuales), repasos (incluye atrasados), preguntas agendadas y próximas fechas. |
| Preguntas al aire | Botón **+ Pregunta** (en todas las pantallas) y **Preguntas** | La IA detecta la materia y se agenda antes de la próxima clase. Se puede marcar como resuelta y anotar la respuesta. |
| Hoja de dudas por materia | **Materias** → materia | Preguntas sin resolver, temas por aprender y repasos pendientes. Se arma en el momento, así siempre está actualizada. Se puede **descargar** (.md) o **imprimir**. |
| Calendario + sincronización | **Calendario** | Calendario mensual con clases (botón Unirse si son virtuales), exámenes, feriados, repasos, preguntas y tus eventos de Google. Se sincroniza con Google, Apple u Outlook por **link .ics**, o con tu **cuenta de Google** (al instante, en un calendario aparte «Super Calendar»). |

La IA decide **qué** estudiar y **de qué materia** es algo; el **cuándo** lo calcula el backend a partir del
horario (lógica determinística en `app/shared/study_calendar.py`), así las fechas son predecibles.

## Backend (FastAPI + Supabase + Gemini)

```
app/
├── main.py              (arma la app, CORS, rutas /api/v1)
├── config.py            (lee y valida el .env al arrancar)
├── ai/                  (cliente de Gemini con salida estructurada + las 3 tareas de IA)
├── db/supabase.py       (clientes de PostgREST, Storage y Auth)
├── shared/              (errores RFC 9457, JWT/JWKS, paginación, fechas de estudio, subida de archivos)
└── modules/
    ├── auth/            (signup, login, refresh, logout, me)
    ├── profiles/        (perfil del usuario logueado)
    ├── subjects/        (materias + hoja de dudas)
    ├── schedule/        (horario, fechas importantes, importar desde foto)
    ├── notes/           (apuntes)
    ├── questions/       (preguntas al aire)
    └── agenda/          (qué estudiar hoy, repasos, temas pendientes)
db/migrations/           (SQL con tablas + políticas RLS)
tests/
```

**IA:** usa el SDK oficial de Google `google-genai` con el modelo `gemini-3.5-flash-lite` (configurable con `AI_MODEL`),
respuestas en JSON validadas con un schema Pydantic. Los errores de la IA se devuelven como errores HTTP claros (429 si está ocupada, 503 si no
está configurada, etc.).

### Endpoints (todos bajo `/api/v1`, con `Authorization: Bearer <token>` salvo auth)

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/status` | ¿La IA está configurada? |
| POST | `/auth/signup` · `/auth/login` · `/auth/refresh` · `/auth/logout` · GET `/auth/me` | Sesión |
| GET / PATCH | `/profiles/me` | Perfil |
| GET / POST | `/subjects` | Materias (con próxima clase y contadores) |
| PATCH / DELETE | `/subjects/{id}` | Editar / borrar materia |
| GET | `/subjects/{id}/sheet` | Hoja de dudas |
| GET / PUT | `/schedule` | Ver / reemplazar horario y fechas importantes |
| POST | `/schedule/import` (multipart `file`) | La IA lee una foto/PDF → borrador (no guarda) |
| GET / POST | `/notes` (POST multipart: `text`, `file`, `subject_id`, `class_date`, `title`) | Apuntes |
| GET / DELETE | `/notes/{id}` · GET `/notes/{id}/file` | Detalle, link temporal al archivo |
| GET / POST | `/questions` | Preguntas al aire |
| PATCH / DELETE | `/questions/{id}` | Resolver, responder, mover |
| GET | `/agenda?date=` | Qué estudiar hoy |
| GET / POST · PATCH / DELETE | `/study-tasks` · `/study-tasks/{id}` | Repasos |
| POST · PATCH / DELETE | `/pending-topics` · `/pending-topics/{id}` | Temas pendientes |

### Seguridad
- El JWT se verifica localmente con las claves públicas de Supabase (JWKS, ES256).
- Las consultas usan el token del usuario, así Postgres aplica RLS: nadie ve filas ajenas. Un trigger impide
  colgar datos de una materia ajena.
- Los archivos van a un bucket **privado**; cada usuario solo accede a su carpeta y se ven con links que vencen en 5 minutos.
- Los archivos subidos se validan por tamaño (10 MB) y por su contenido real, no por la extensión.
- La `SUPABASE_SECRET_KEY` saltea RLS: solo se usa en `admin_db()` para tareas internas.
- Refresh token en cookie `HttpOnly`; access token solo en memoria del navegador.

## Frontend (React + TypeScript + Vite) — carpeta `web/`

Stack: React 19 + TypeScript, React Router, TanStack Query, Tailwind CSS, Vitest + Testing Library.

```
web/src/
├── lib/                 (api.ts: cliente HTTP · queries.ts: hooks de datos · types.ts · dates.ts)
├── components/          (UI reutilizable, Layout con "+ Pregunta", guards de rutas)
└── features/
    ├── auth/            (login, registro)
    ├── today/           (Hoy: qué estudiar)
    ├── notes/           (subir apuntes, lista, detalle)
    ├── questions/       (preguntas al aire)
    ├── schedule/        (horario + importar foto + editor de revisión)
    ├── subjects/        (materias + hoja de dudas)
    └── profile/         (perfil)
```

En desarrollo Vite reenvía `/api/*` a `http://127.0.0.1:8000`, así front y back comparten origen (sin CORS).

## Conectar Google Calendar (opcional)

El **link .ics** funciona sin configurar nada (ver la pantalla Calendario). Para la conexión directa con la
cuenta de Google:

1. Entrar a **console.cloud.google.com** y crear un proyecto (ej. "Super Calendar").
2. *APIs y servicios* → *Biblioteca* → **Google Calendar API** → *Habilitar*.
3. *Pantalla de consentimiento OAuth*: tipo **Externo**, nombre de la app y tu mail. En *Usuarios de prueba*
   agregá tu cuenta de Gmail (no hace falta publicar la app).
4. *Credenciales* → *Crear credenciales* → **ID de cliente de OAuth** → tipo **Aplicación web**, con
   *URI de redireccionamiento autorizado*: `http://localhost:5173/calendario/google/callback`.
5. Poner en el `.env` (no subirlos a git) y reiniciar el backend:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
6. En la app: **Calendario** → *Conectar con Google*.

Permisos que pide (los mínimos): crear y manejar **solo** el calendario «Super Calendar»
(`calendar.app.created`) y **leer** tus eventos para mostrarlos (`calendar.events.readonly`). El refresh token
se guarda cifrado. Al desconectar se borra el calendario «Super Calendar» y se revoca el permiso.

**Link .ics desde Google:** Google lee el link desde internet, así que con la app en `localhost` no puede
suscribirse; hace falta publicarla (y poner `PUBLIC_API_URL`) o usar un túnel. Mientras tanto, *Descargar .ics*
permite importarlo a mano.
