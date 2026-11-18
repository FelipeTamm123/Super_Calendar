# Buenas prácticas de backend en 2026: cómo ordenarlo, qué cuidar y con qué lenguaje arrancar

**Respuesta corta:** para alguien que arranca desde cero en Argentina en 2026, lo más conveniente es aprender **TypeScript con Node.js** (o, como alternativa, **Python con FastAPI/Django**) y **PostgreSQL**. Con eso armás un **monolito ordenado en capas o por módulos**, con validación de datos, contraseñas hasheadas con Argon2id, consultas parametrizadas, tests y Docker. Los lenguajes "de moda" (Go, Rust) y los microservicios dejalos para más adelante. Lo que hace bueno a un backend no es el lenguaje que elegiste: es que esté bien organizado, que sea seguro y que se pueda testear.

## TL;DR

- **Cómo ordenarlo:** separá el código en tres capas (rutas/controladores → servicios con la lógica de negocio → repositorios que hablan con la base de datos) y agrupalo **por funcionalidad** (usuarios, pedidos, pagos). Empezá con un **monolito modular**. Martin Fowler observó que "casi todas las historias exitosas de microservicios empezaron con un monolito que creció demasiado y se partió".
- **Qué lenguaje:** JavaScript sigue siendo el lenguaje más usado del mundo por 12.º año consecutivo (62,0% en la encuesta de Stack Overflow 2026).\[1\] TypeScript pasó a ser el lenguaje n.º 1 en GitHub en agosto de 2025, y Node.js es la tecnología web más usada (46,4%).\[2\] En Argentina, la encuesta Sysarmy 2026.1 ubica a SQL, JavaScript, Python y TypeScript arriba de todo, y a Node.js como el framework/herramienta más popular.\[3\] Para conseguir trabajo, **TypeScript/Node.js, Python, Java y C#/.NET** son las apuestas más seguras.
- **Qué no podés saltearte:** las reglas de OWASP. Controlá permisos en cada recurso (el riesgo n.º 1 del OWASP Top 10:2025 es *Broken Access Control*),\[4\] usá consultas parametrizadas contra la inyección SQL, guardá contraseñas con Argon2id,\[5\] poné los secretos en variables de entorno,\[6\] usá HTTPS y limitá la cantidad de pedidos (rate limiting).

---

## 1. Cómo ordenar internamente un backend

### 1.1 La idea central: separación de responsabilidades

Pensá en un restaurante. El **mozo** toma el pedido y lo lleva a la mesa, pero no cocina. El **cocinero** sabe las recetas, pero no atiende clientes. El **depósito** guarda los ingredientes. Si el mozo se mete en la cocina o el cocinero sale a cobrar, todo se vuelve un caos. Un backend bien ordenado funciona igual:

| Capa | Analogía | Qué hace | Qué NO debería hacer |
|---|---|---|---|
| **Rutas / Controladores** | El mozo | Recibe el pedido HTTP, valida el formato, llama al servicio y devuelve la respuesta con el código de estado correcto | Tener reglas de negocio o hacer consultas SQL |
| **Servicios (lógica de negocio)** | El cocinero | Aplica las reglas: "no se puede comprar si no hay stock", "un usuario no puede tener dos cuentas con el mismo email" | Saber de HTTP (req/res) o de qué base de datos se usa |
| **Repositorios (acceso a datos)** | El depósito | Guarda y busca datos en la base (SQL, ORM) | Decidir reglas de negocio |

¿Por qué conviene? Porque podés **cambiar una parte sin romper las otras**. Por ejemplo, pasar de MySQL a PostgreSQL sin tocar la lógica, o testear las reglas de negocio sin levantar un servidor.

Ejemplo mínimo en TypeScript (Express):

```ts
// users.controller.ts  (el mozo)
router.post("/users", async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);   // valida el formato
    const user = await usersService.register(data);  // delega la lógica
    res.status(201).json(user);                      // 201 = creado
  } catch (err) { next(err); }                       // errores al manejador central
});

// users.service.ts  (el cocinero)
export async function register(data: NewUser) {
  if (await usersRepo.findByEmail(data.email)) {
    throw new ConflictError("El email ya está registrado"); // regla de negocio
  }
  const hash = await argon2.hash(data.password);
  return usersRepo.create({ ...data, password: hash });
}

// users.repository.ts  (el depósito)
export const findByEmail = (email: string) =>
  db.query("SELECT * FROM users WHERE email = $1", [email]); // consulta parametrizada
```

### 1.2 Arquitectura limpia / hexagonal, explicada simple

La **arquitectura hexagonal** (también llamada "puertos y adaptadores") y la **arquitectura limpia** llevan la idea anterior un paso más allá. **El corazón de tu aplicación, o sea las reglas de negocio, no depende de nada externo.** La base de datos, el framework web, el servicio de emails o la pasarela de pagos son "enchufes" que se conectan desde afuera.

Analogía: tu notebook tiene puertos USB (el **puerto** es la interfaz). No le importa si enchufás un mouse Logitech o uno genérico (el **adaptador** es la implementación). En código, tu servicio dice "necesito algo que sepa guardar usuarios" (una interfaz), y después le conectás un adaptador de PostgreSQL, uno de MongoDB o uno falso para los tests.

**Mi recomendación:** al principio no hace falta aplicarla al pie de la letra (con decenas de interfaces y carpetas), porque agrega mucha ceremonia. Lo que sí tenés que respetar desde el día uno es la **regla de dependencia**: la lógica de negocio no importa nada de Express, de Django ni del driver de la base. Si cumplís eso, ya tenés el 80% del beneficio.

### 1.3 Estructura de carpetas: por capas vs. por funcionalidad

**Opción A: por capas (técnica).** Es fácil de entender, pero se desordena cuando el proyecto crece, porque para tocar "pedidos" tenés que saltar entre 4 carpetas.

```
src/
├── controllers/   (users.controller.ts, orders.controller.ts)
├── services/      (users.service.ts, orders.service.ts)
├── repositories/  (users.repository.ts, orders.repository.ts)
├── models/
└── app.ts
```

**Opción B: por funcionalidad/módulos (recomendada).** Cada módulo tiene sus propias capas adentro. Es la base de un **monolito modular**.

```
src/
├── modules/
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   ├── users.schema.ts       (validación)
│   │   └── users.test.ts
│   ├── orders/
│   └── payments/
├── shared/        (errores, logger, middlewares, config)
├── config/        (lectura de variables de entorno)
├── db/            (conexión y migraciones)
└── main.ts
tests/             (tests de integración / e2e)
Dockerfile
.env.example       (lista de variables, SIN valores secretos)
```

Frameworks como **NestJS** (Node), **Django** (Python, con sus "apps"), **Spring Boot** (Java) y **Laravel** (PHP) ya te empujan a una estructura de este estilo. Esa es una de las razones por las que conviene usarlos en proyectos medianos o grandes.

### 1.4 Monolito modular vs. microservicios

- **Monolito:** una sola aplicación que se despliega entera. Es simple de desarrollar, de testear y de debuggear.
- **Monolito modular:** sigue siendo una sola aplicación, pero dividida en módulos con fronteras claras (como la opción B). Es el punto óptimo para la mayoría de los proyectos.
- **Microservicios:** cada módulo es una aplicación separada, con su propia base de datos, que se comunica por red (HTTP, gRPC, colas).

Martin Fowler, una de las referencias más citadas en arquitectura de software, lo resume así en su artículo *MonolithFirst* (2015): "casi todas las historias exitosas de microservicios empezaron con un monolito que se volvió demasiado grande y se partió", y "casi todos los casos de sistemas construidos como microservicios desde cero terminaron en serios problemas".\[7\] También habla del **"microservice premium"**, que es el costo extra de operar muchos servicios (despliegues, monitoreo, consistencia de datos entre servicios). Ese costo frena a un equipo chico y solo se justifica en sistemas complejos.\[7\]\[8\]

**Cuándo conviene cada uno:**

| Situación | Elección |
|---|---|
| Proyecto personal, startup, equipo de 1 a 10 personas | Monolito modular |
| Partes con necesidades de escala muy distintas (por ejemplo, procesamiento de video vs. login) | Extraer solo esa parte como servicio |
| Varios equipos grandes que se pisan al desplegar | Microservicios, migrando de a poco (patrón "strangler fig") |

---

## 2. Diseño de APIs

### 2.1 REST: rutas, métodos y códigos de estado

**Reglas de nombres:** usá **sustantivos en plural**, minúsculas y sin verbos (el verbo ya lo pone el método HTTP).

| Acción | Método + ruta | Código de éxito |
|---|---|---|
| Listar productos | `GET /api/v1/products` | 200 OK |
| Ver un producto | `GET /api/v1/products/42` | 200 OK |
| Crear producto | `POST /api/v1/products` | 201 Created |
| Reemplazar | `PUT /api/v1/products/42` | 200 OK |
| Modificar parcialmente | `PATCH /api/v1/products/42` | 200 OK |
| Borrar | `DELETE /api/v1/products/42` | 204 No Content |
| Recursos anidados | `GET /api/v1/users/7/orders` | 200 OK |

❌ Mal: `POST /api/crearProducto`, `GET /api/getUsers`.

**Códigos de error que tenés que conocer:**
- `400` Bad Request: el pedido está mal formado.
- `401` Unauthorized: no estás autenticado (no sé quién sos).
- `403` Forbidden: estás autenticado, pero no tenés permiso.
- `404` Not Found.
- `409` Conflict: por ejemplo, un email duplicado.
- `422` Unprocessable Content: los datos tienen el formato correcto pero no pasan la validación.
- `429` Too Many Requests: se superó el límite de pedidos.
- `500` Internal Server Error: falló algo del servidor. Nunca muestres detalles internos.

### 2.2 Versionado, paginación y filtros

- **Versionado:** lo más simple y común es poner la versión en la URL (`/api/v1/...`). Cuando hagas un cambio que rompa a los clientes (por ejemplo, renombrar un campo), creás `/v2` y mantenés `/v1` un tiempo.
- **Paginación:** **nunca** devuelvas "todos" los registros. Hay dos formas habituales:
  - *Offset:* `GET /products?page=2&limit=20`. Es simple, pero se vuelve lenta con tablas enormes.
  - *Cursor:* `GET /products?cursor=abc123&limit=20`. Es más eficiente y estable para feeds o listados grandes.
  - Poné siempre un **límite máximo** (por ejemplo, 100). OWASP lista "Unrestricted Resource Consumption" (consumo de recursos sin límites) como el riesgo API4 de su *API Security Top 10 (2023)*, y la paginación sin tope es una de sus causas típicas.\[9\]\[10\]\[11\]
- **Filtros y orden:** `GET /products?category=libros&sort=-price`.

### 2.3 Validación de datos

**Regla de oro: nunca confíes en lo que manda el cliente.** Validá en el borde (en el controlador), con un esquema declarativo:

- TypeScript: **Zod** (o los DTOs con class-validator en NestJS).
- Python: **Pydantic**, que viene integrado en FastAPI.
- Java: **Bean Validation** (`@NotNull`, `@Email`).
- C#: Data Annotations / FluentValidation.

Validá tipos, largos, formatos (email, fecha) y rangos. Usá listas blancas (lo que está permitido), no listas negras.

### 2.4 Formato de errores estándar

Existe un estándar oficial de la IETF: el **RFC 9457 "Problem Details for HTTP APIs"** (2023), que reemplaza al RFC 7807.\[12\]\[13\] Define un JSON con el tipo de contenido `application/problem+json` y campos como `type`, `title`, `status`, `detail` e `instance`:\[14\]

```json
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.miapp.com/errors/validation",
  "title": "Datos inválidos",
  "status": 422,
  "detail": "El campo email no tiene un formato válido",
  "errors": [{ "pointer": "/email", "detail": "formato inválido" }]
}
```

Spring Boot 3 y ASP.NET Core ya lo traen incorporado.\[14\] Usalo en vez de inventar `{ "success": false }`.

### 2.5 GraphQL y gRPC: cuándo usarlos

- **REST:** es la opción por defecto para el 90% de las APIs públicas y web. Es simple, se cachea bien y lo entiende todo el mundo.
- **GraphQL:** el cliente pide exactamente los campos que necesita en una sola consulta. Sirve cuando tenés muchos frontends (web, móvil) con necesidades distintas y datos muy relacionados. Tiene contras: es más complejo de cachear y de proteger (hay que limitar la profundidad y el costo de las consultas).
- **gRPC:** es comunicación binaria y muy rápida entre servicios internos, con contratos estrictos (Protocol Buffers). Es ideal para la comunicación entre microservicios, pero no para que un navegador lo consuma directamente.

---

## 3. Seguridad

### 3.1 El mapa de riesgos: OWASP Top 10:2025

OWASP (Open Worldwide Application Security Project) es la referencia mundial en seguridad web. Su **Top 10:2025** es:

1. **A01 Broken Access Control** (control de acceso roto). Ahora incluye SSRF.\[15\]
2. **A02 Security Misconfiguration** (configuración insegura). Subió del puesto 5 al 2.\[16\]
3. **A03 Software Supply Chain Failures** (fallas en la cadena de dependencias). Es una ampliación de la categoría de "componentes vulnerables".\[17\]
4. **A04 Cryptographic Failures** (fallas criptográficas).
5. **A05 Injection** (inyección SQL, de comandos, XSS).
6. **A06 Insecure Design** (diseño inseguro).
7. **A07 Authentication Failures** (fallas de autenticación).
8. **A08 Software or Data Integrity Failures** (fallas de integridad).
9. **A09 Security Logging and Alerting Failures** (logs y alertas insuficientes).
10. **A10 Mishandling of Exceptional Conditions** (mal manejo de errores). Es nueva en 2025.\[17\]

**Cómo se traduce al backend:**

| Riesgo | Qué hacer en la práctica |
|---|---|
| A01 Control de acceso | En **cada** endpoint, verificá que el usuario sea dueño del recurso. Si alguien pide `GET /orders/123`, comprobá que el pedido 123 sea suyo. En APIs esto se llama **BOLA**, y es el riesgo n.º 1 del OWASP API Security Top 10 (2023).\[11\]\[18\]\[19\] |
| A02 Configuración | Desactivá el modo debug en producción, no expongas trazas de errores, cambiá las contraseñas por defecto y configurá CORS y los headers de seguridad. |
| A03 Dependencias | Usá lockfiles (`package-lock.json`, `poetry.lock`), corré `npm audit`/Dependabot y no instales paquetes de dudosa procedencia. |
| A04 Criptografía | HTTPS en todos lados y contraseñas hasheadas (nunca encriptadas ni en texto plano). |
| A05 Inyección | Consultas parametrizadas u ORM, nunca concatenar strings.\[20\] |
| A07 Autenticación | Hash fuerte, límite de intentos de login y MFA para cuentas sensibles. |
| A09 Logs | Registrá logins fallidos y accesos denegados, y configurá alertas. |
| A10 Excepciones | Un manejador central de errores que "falle cerrado" (si algo explota, se deniega el acceso, no se permite). |

### 3.2 Autenticación (¿quién sos?) y autorización (¿qué podés hacer?)

- **Sesiones con cookie:** el servidor guarda la sesión (en la base o en Redis) y el navegador solo tiene un ID aleatorio en una cookie con los flags `HttpOnly`, `Secure` y `SameSite`. **Es la opción por defecto recomendable para una app web propia**, porque cerrar sesión o revocar un acceso es inmediato: se borra la sesión y listo.\[21\]\[22\]\[23\]
- **JWT (JSON Web Token):** es un token firmado que contiene los datos del usuario, así que el servidor no necesita buscar nada. Sirve para APIs consumidas por apps móviles, para comunicación entre servicios o para varios dominios. Su gran contra es que **no se puede revocar** antes de que venza. Si lo usás: que sea de vida corta (de 5 a 15 minutos), con *refresh token* rotativo, fijando el algoritmo de firma y **nunca guardado en `localStorage`**, porque cualquier script inyectado (XSS) lo puede robar. Guardalo en una cookie `HttpOnly`.\[22\]\[24\]\[25\]\[26\]
- **OAuth 2.0 / OpenID Connect:** es el estándar para "Iniciar sesión con Google/GitHub" o para delegar el login en un proveedor (Auth0, Keycloak, Cognito, Clerk). **Consejo:** no implementes OAuth a mano; usá una librería certificada o un proveedor.
- **Autorización:** como mínimo, usá roles (RBAC: admin, editor, usuario) y verificalos **en el servidor**, nunca solamente ocultando botones en el frontend.

### 3.3 Contraseñas: hashing

Según la *Password Storage Cheat Sheet* de OWASP:
- Usá **Argon2id** con una configuración mínima de **19 MiB de memoria, 2 iteraciones y 1 grado de paralelismo**.\[5\]
- **bcrypt** queda solo para sistemas heredados, con un *work factor* de 10 o más y un límite de 72 bytes por contraseña.\[5\]
- Las contraseñas se **hashean** (es irreversible), nunca se encriptan (es reversible) ni se guardan en texto plano.\[5\] Las librerías modernas agregan la "sal" automáticamente.

```python
from argon2 import PasswordHasher
ph = PasswordHasher()               # parámetros seguros por defecto
hash = ph.hash("mi_password")
ph.verify(hash, "mi_password")      # lanza excepción si no coincide
```

### 3.4 Variables de entorno y secretos

La metodología **The Twelve-Factor App** (la "biblia" de las apps desplegables en la nube) dice: guardá la configuración en **variables de entorno**, separada del código. Propone una prueba muy útil: **¿podrías publicar tu repositorio como open source ahora mismo sin exponer ninguna credencial?**\[6\] Si la respuesta es no, tenés secretos en el código.

En la práctica:
- Usá un archivo `.env` en desarrollo, **agregado a `.gitignore`**, y un `.env.example` (sin valores reales) dentro del repo.
- En producción, usá el gestor de secretos de tu plataforma (AWS Secrets Manager, GCP Secret Manager, Doppler, las variables de Render/Railway, etc.).
- Leé y validá las variables **una sola vez al arrancar** la app.\[27\] Si falta alguna, que la app no arranque.
- Si subiste una clave a Git por error, **rotala**: borrarla del repo no alcanza.

### 3.5 Inyección SQL

La *SQL Injection Prevention Cheat Sheet* de OWASP es clara: la defensa principal son las **consultas parametrizadas (prepared statements)**, y **no hay que escapar valores a mano**.\[20\]\[28\]

```js
// ❌ VULNERABLE: si email = "' OR '1'='1", devuelve todos los usuarios
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ SEGURO: el valor viaja separado del SQL
db.query("SELECT * FROM users WHERE email = $1", [email]);
```

Los ORMs parametrizan por defecto, pero ojo con sus métodos de "SQL crudo" (`raw`, `$queryRawUnsafe`, etc.). Además, el usuario de la base de datos que usa tu app debería tener **los mínimos permisos posibles**.\[29\]\[30\]

### 3.6 Rate limiting, CORS y HTTPS

- **Rate limiting:** limitá los pedidos por IP o por usuario (por ejemplo, 5 intentos de login por minuto o 100 pedidos por minuto en la API) y respondé `429`. Hay librerías para eso: `express-rate-limit` y `@fastify/rate-limit` en Node, `slowapi` en FastAPI y `django-ratelimit` en Django. También podés hacerlo en Nginx, Cloudflare o tu API gateway.
- **CORS:** es lo que permite (o no) que un frontend de **otro dominio** llame a tu API desde el navegador. Configurá una **lista explícita** de orígenes permitidos (`https://miapp.com`). **Nunca** uses `*` junto con credenciales. Ojo: CORS protege a los navegadores, no reemplaza la autenticación.
- **HTTPS:** es obligatorio en producción. Los certificados de Let's Encrypt son gratuitos, y casi todas las plataformas cloud los configuran solas. Agregá el header HSTS.
- **Headers de seguridad:** `helmet` en Express o sus equivalentes en otros frameworks.

---

## 4. Bases de datos

### 4.1 SQL vs. NoSQL

| | SQL (relacional) | NoSQL |
|---|---|---|
| Ejemplos | PostgreSQL, MySQL, SQLite, SQL Server | MongoDB (documentos), Redis (clave-valor), DynamoDB, Cassandra |
| Estructura | Tablas con esquema fijo y relaciones | Flexible (documentos JSON, pares clave-valor) |
| Fortaleza | Consistencia, transacciones, consultas complejas con JOINs | Escala horizontal masiva, esquemas cambiantes, casos específicos |
| Cuándo | **La mayoría de las apps** (e-commerce, finanzas, SaaS, gestión) | Caché, sesiones, logs, catálogos con estructura muy variable, tiempo real |

**Recomendación: empezá con PostgreSQL.** En la encuesta de Stack Overflow 2026 es la base de datos más usada (57,9%), muy por delante de MySQL (35,1%) y de MongoDB (19,0%).\[1\] Además, soporta columnas JSON (`jsonb`), así que cubre muchos casos "NoSQL", y con la extensión pgvector también sirve para búsquedas con IA. Redis (28,3%) es el complemento habitual para caché.\[1\]

### 4.2 ORMs y query builders

Un **ORM** te deja trabajar con la base usando objetos de tu lenguaje en vez de escribir SQL a mano.

- Node/TS: **Prisma**, **Drizzle**, TypeORM.
- Python: **SQLAlchemy**, el ORM de Django.
- Java: **Hibernate/JPA**.
- C#: **Entity Framework Core**.
- PHP: **Eloquent** (Laravel).
- Ruby: **ActiveRecord**.

**Consejo:** usá un ORM, pero **aprendé SQL igual**. Vas a necesitarlo para optimizar, para depurar y para entender qué hace el ORM por detrás. Cuidado con el **problema N+1**: hacer 1 consulta para traer 100 pedidos y después 100 consultas más, una por cada cliente. Se resuelve con *eager loading* o JOINs.

### 4.3 Migraciones

Las **migraciones** son archivos versionados que describen cada cambio en la estructura de la base ("agregar columna `phone` a `users`"). Viven en Git junto al código, así todos los entornos (tu PC, staging, producción) quedan iguales. Herramientas: Prisma Migrate, Alembic, las migraciones de Django, Flyway/Liquibase (Java), EF Migrations y las de Laravel.

**Reglas:**
- Nunca modifiques la base de producción a mano.
- Nunca edites una migración que ya se aplicó; creá una nueva.
- Para no romper la app en vivo, hacé los cambios en dos pasos: primero agregás la columna nueva y después, en otro despliegue, borrás la vieja.

### 4.4 Índices

Un **índice** es como el índice de un libro: en lugar de leer todas las páginas, vas directo a la que buscás. Creá índices en las columnas que usás seguido en `WHERE`, `JOIN` y `ORDER BY` (por ejemplo, `users.email` y las claves foráneas). Tienen un costo: hacen más lentas las escrituras y ocupan espacio, así que no indexes todo. Usá `EXPLAIN ANALYZE` (en PostgreSQL) para ver si una consulta usa el índice.

### 4.5 Transacciones

Una **transacción** agrupa varias operaciones que deben salir **todas bien o ninguna** (las propiedades ACID). El ejemplo clásico es una transferencia: restar de la cuenta A y sumar a la cuenta B. Si falla la segunda operación, la primera se deshace.

```ts
await prisma.$transaction(async (tx) => {
  await tx.account.update({ where: { id: a }, data: { balance: { decrement: 100 } } });
  await tx.account.update({ where: { id: b }, data: { balance: { increment: 100 } } });
});
```

**Otras buenas prácticas de base de datos:**
- Usá *connection pooling* (reutilizar conexiones).
- Hacé backups automáticos **y probá restaurarlos**.
- Usá restricciones en la propia base (`NOT NULL`, `UNIQUE` y claves foráneas) como última línea de defensa.
- Guardá las fechas en UTC.
- Usá tipos de dato correctos: el dinero va en `DECIMAL`, nunca en `FLOAT`.

---

## 5. Calidad y mantenimiento

### 5.1 Testing

La **pirámide de tests** la propuso Mike Cohn y la popularizó Martin Fowler con el artículo *The Practical Test Pyramid* (escrito por Ham Vocke). La idea es tener **muchos tests chicos y rápidos abajo y pocos tests grandes y lentos arriba**:\[31\]\[32\]\[33\]

```
        /\        E2E (pocos): flujo completo, como lo haría un usuario
       /  \       ej. registrarse → loguearse → comprar
      /----\
     / Integ.\    Integración (varios): endpoint + base de datos real
    /--------\    ej. POST /users guarda en Postgres y devuelve 201
   /  Unitarios \ Unitarios (muchos): una función o servicio aislado
  /--------------\ ej. register() rechaza emails duplicados
```

- **Herramientas:** Vitest/Jest + Supertest (Node), pytest (Python), JUnit + Mockito (Java), xUnit (C#). **Testcontainers** sirve para levantar un Postgres real en Docker durante los tests de integración.
- Estructurá cada test con el patrón **Arrange–Act–Assert**: preparar, ejecutar y verificar.\[34\]
- Para backends, los **tests de integración de la API** suelen dar la mejor relación entre esfuerzo y confianza.

### 5.2 Manejo de errores

- Usá un **manejador central de errores** (un middleware) en lugar de un `try/catch` con respuestas distintas en cada endpoint.
- Distinguí los **errores esperables** (validación, recurso no encontrado o sin permiso: 4xx, con un mensaje claro) de los **inesperados** (bugs o caídas de la base: 500 con un mensaje genérico para el cliente y todos los detalles en el log).
- Nunca devuelvas *stack traces* al cliente. Es exactamente lo que penaliza la nueva categoría A10:2025 de OWASP.

### 5.3 Logging, monitoreo y observabilidad

- **Logs estructurados en JSON**, con niveles (`debug`, `info`, `warn`, `error`) y un **ID de request** para seguir un pedido de punta a punta. Librerías: Pino (Node), structlog/logging (Python), Logback (Java), Serilog (.NET).
- **Nunca loguees** contraseñas, tokens, números de tarjeta ni datos personales sensibles.
- **Observabilidad** se apoya en tres pilares: **logs** (qué pasó), **métricas** (cuántos pedidos, latencia, tasa de errores) y **trazas** (el recorrido de un pedido a través de los servicios). El estándar abierto para recolectarlos es **OpenTelemetry**, un proyecto de la CNCF, y después los podés mandar a Grafana, Prometheus, Datadog, etc.\[35\]\[36\]\[37\]\[38\]
- **Monitoreo mínimo para empezar:** un endpoint `/health`, alertas cuando sube la tasa de errores 5xx y un servicio de tracking de errores como Sentry.

### 5.4 Documentación: OpenAPI/Swagger

**OpenAPI** (antes llamado Swagger) es el formato estándar para describir una API REST: rutas, parámetros, respuestas y errores. Con eso se genera una página interactiva donde se puede probar la API. **FastAPI** la genera automáticamente desde tu código; NestJS, Spring (springdoc) y ASP.NET Core lo hacen con muy poca configuración. Sumale un `README.md` que explique cómo levantar el proyecto en 5 minutos.

### 5.5 Git

- Hacé commits chicos y frecuentes, con mensajes claros. La convención *Conventional Commits* es muy usada: `feat: agrega login con Google`, `fix: corrige paginación`.
- Trabajá en **ramas** (`feature/login`) e integrá con **Pull Requests** revisados por otra persona.
- Mantené `main` siempre desplegable. El flujo *trunk-based* o GitHub Flow es más simple que Git Flow para equipos chicos.
- Nunca subas `.env`, `node_modules` ni credenciales.

### 5.6 CI/CD

- **CI (integración continua):** en cada push o PR se corren automáticamente el linter, los tests y la compilación. Si algo falla, no se mergea. Herramientas: GitHub Actions (la más accesible para empezar), GitLab CI.
- **CD (despliegue continuo):** cuando se mergea a `main`, se construye la imagen Docker y se despliega sola en staging o producción.

```yaml
# .github/workflows/ci.yml (simplificado)
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

### 5.7 Código limpio

- **Nombres descriptivos:** `calculateOrderTotal()` en vez de `calc()`.
- **Funciones chicas** que hagan una sola cosa.
- **DRY sin exagerar:** no repitas lógica de negocio, pero tampoco abstraigas antes de tiempo.
- **Tipado:** TypeScript estricto, type hints en Python.
- **Formateador y linter automáticos:** Prettier/ESLint o Biome, Ruff/Black, Checkstyle. Así no se discute el estilo en los code reviews.
- Los **principios SOLID** valen la pena estudiarlos una vez que tengas algo de experiencia.

---

## 6. Rendimiento y escalabilidad

### 6.1 Caché con Redis

La **caché** guarda en memoria el resultado de algo costoso para no recalcularlo. Analogía: tener a mano en la heladera lo que más usás, en vez de ir al supermercado cada vez.

- **Patrón *cache-aside*:** buscás en Redis; si no está, lo buscás en la base, lo guardás en Redis con un vencimiento (TTL) y lo devolvés.
- **Qué cachear:** datos que se leen mucho y cambian poco (catálogos, configuraciones, rankings).
- **El problema difícil es invalidar:** cuando el dato cambia, tenés que borrar o actualizar la caché.
- Redis también se usa para sesiones, rate limiting y colas.
- **Primero medí, después cacheá.** Muchas veces un índice en la base resuelve el problema sin agregar Redis.

### 6.2 Colas y tareas en segundo plano

Si algo tarda (mandar un email, generar un PDF, procesar una imagen, llamar a una API externa lenta), **no hagas esperar al usuario**. Respondés "recibido" y mandás la tarea a una **cola**, que un *worker* procesa por separado.

- Node: **BullMQ** (sobre Redis).
- Python: **Celery**, RQ.
- Java/Spring y .NET: RabbitMQ, Kafka, Hangfire (.NET).
- En la nube: SQS (AWS), Pub/Sub (GCP).

Diseñá las tareas para que sean **idempotentes**: si se ejecutan dos veces, que el resultado sea el mismo. Configurá también reintentos con espera creciente.

### 6.3 Escalado horizontal

- **Vertical:** ponerle más CPU o RAM al mismo servidor. Es simple, pero tiene un techo.
- **Horizontal:** correr varias copias de tu app detrás de un **balanceador de carga**.

Para escalar horizontalmente, tu app tiene que ser **sin estado (stateless)**, como pide Twelve-Factor. Eso significa no guardar sesiones ni archivos en la memoria o en el disco del servidor; van a Redis, a la base de datos o a un almacenamiento de objetos (S3, R2). Muchas veces la base de datos es el cuello de botella real, y ahí entran las réplicas de lectura, los índices y la caché.

### 6.4 Contenedores (Docker)

**Docker** empaqueta tu app con todo lo que necesita (runtime, dependencias) en una **imagen** que corre igual en tu PC y en producción. Así se termina el "en mi máquina funciona".

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node                       # no correr como root
CMD ["node", "dist/main.js"]
```

Con **Docker Compose** levantás en local tu app + PostgreSQL + Redis con un solo comando. **Kubernetes** orquesta muchos contenedores en producción, pero para empezar es excesivo.

### 6.5 Despliegue en la nube

| Nivel | Opciones | Para quién |
|---|---|---|
| **PaaS simple** | Render, Railway, Fly.io, Heroku | Para empezar: subís el repo o la imagen y listo. Varios tienen planes gratuitos o muy baratos. |
| **Bases gestionadas** | Neon, Supabase (Postgres), Upstash (Redis) | No administrás servidores de base de datos. |
| **Contenedores gestionados** | AWS App Runner/ECS, Google Cloud Run, Azure Container Apps | Proyectos que crecen. |
| **Nube completa** | AWS, Google Cloud, Azure | Empresas. AWS es la más pedida en ofertas laborales. |
| **Serverless** | AWS Lambda, Cloudflare Workers, Vercel Functions | Tráfico irregular y funciones chicas. |

Para un portfolio, alcanza con un PaaS + Postgres gestionado + dominio con HTTPS. Para tu CV, aprender lo básico de AWS (o de alguna certificación cloud) suma mucho.

---

## 7. Los mejores lenguajes y frameworks backend en 2026

### 7.1 Qué dicen los datos

**A nivel mundial:**
- **Stack Overflow Developer Survey 2026** (n = 14.099 en la pregunta de lenguajes). Uso: JavaScript 62,0% (n.º 1 por 12.º año seguido), SQL 58,4%, Python 58,0%, TypeScript 43,8%, Java 27,6%, C# 27,1%, Rust 18,0%, PHP 17,7%, Go 16,5%, Kotlin 10,8% y Ruby 5,8%.\[39\]
- **Frameworks web, misma encuesta** (n = 10.281): Node.js 46,4%, ASP.NET Core 19,9%, FastAPI 18,5%, Express 15,6%, Spring Boot 12,8%, Flask 12,5%, Django 11,3%, Laravel 7,6%, NestJS 5,8%, Ruby on Rails 5,7% y Fastify 3,5%.\[40\]
- **Stack Overflow 2025:** Python creció 7 puntos en un año, impulsado por la IA y el backend.\[41\] El salto de FastAPI (+5 puntos) fue "uno de los cambios más significativos en el espacio de frameworks web".\[42\] Rust volvió a ser el lenguaje más "admirado" (72%), pero ojo: eso mide cuánto les gusta a quienes ya lo usan, no cuánto se usa.\[43\]\[44\]\[45\]
- **GitHub Octoverse 2025:** en agosto de 2025, **TypeScript superó a Python y JavaScript** como el lenguaje más usado en GitHub por contribuyentes mensuales (2.636.006, +66% interanual).\[46\] GitHub lo llamó el cambio de lenguajes más significativo en más de una década.\[47\]
- **JetBrains State of Developer Ecosystem 2025** (24.534 desarrolladores): TypeScript, Rust y Go encabezan su índice de lenguajes "con más futuro". PHP, Ruby y Objective-C están en declive de largo plazo. Go (11%) y Rust (10%) son los lenguajes que más desarrolladores quieren adoptar.\[48\]

**En Argentina y Latinoamérica:**
- **Encuesta de sueldos Sysarmy 2026.1** (participaron 5.074 personas y se consideraron 4.939 respuestas, el 97% del total, según el blog de Sysarmy; relevadas entre diciembre de 2025 y febrero de 2026, análisis de OpenQube). Lenguajes más usados, en orden: SQL, JavaScript, Python, HTML, TypeScript, CSS, Bash, Java, PHP y .NET. Frameworks y herramientas: Node.js, React, Next.js, Bootstrap, .NET Core, Angular, jQuery, Spring, WordPress y Django.
- **Sueldos de programadores** (mediana bruta mensual en pesos, enero de 2026): junior $1.538.500, semi-senior $2.501.629 y senior $3.500.000. Los que cobran en dólares ganan bastante más: según el boletín del Departamento de Computación de la UBA, la mediana semi-senior es de $3.200.000 entre quienes tienen sueldo dolarizado y de $2.500.000 entre quienes cobran en pesos. Ojo: según el resumen de Maximiliano Firtman sobre la misma encuesta, en los últimos 6 meses los sueldos subieron 13% en pesos y 7% en dólares, pero bajaron 5% en pesos ajustados por inflación (IPC).
- En la edición anterior (Sysarmy 2025.1), **Go** fue el lenguaje mejor pago.\[49\] No pude confirmar si se mantiene en 2026.1.
- Johanna Dzikowsky, de Adecco Argentina, le dijo a iProfesional en marzo de 2025 que los lenguajes "con mayor demanda en el mercado laboral argentino en este momento son Java, Python y Node.js", y una especialista de Accenture coincidió. A nivel regional, la plataforma Get on Board indica que "Java, Python y Node.js anclan de forma constante la demanda en roles de servidor".\[50\]

**Lectura de los datos:** el backend en Argentina se mueve sobre todo en **Node/TypeScript, Java (Spring), .NET y Python**. PHP sigue teniendo mucho trabajo de mantenimiento, sobre todo en agencias y WordPress. Go paga bien, pero tiene menos puestos junior.

### 7.2 Comparativa por lenguaje

| Lenguaje / frameworks | Ventajas | Desventajas | Ideal para | Curva | Demanda (global / AR) |
|---|---|---|---|---|---|
| **TypeScript / JavaScript**: Node.js, Express, **NestJS**, Fastify | Mismo lenguaje en frontend y backend; ecosistema npm enorme; muy bueno para E/S (APIs, tiempo real); tipado con TS | El ecosistema cambia rápido; no rinde para cálculo pesado (CPU); Express "pelado" no impone orden | APIs REST/GraphQL, apps en tiempo real (chat), startups, full stack | Baja-media | Muy alta / muy alta (Node.js es el n.º 1 en Sysarmy) |
| **Python**: **FastAPI**, Django, Flask | Sintaxis muy legible; dominante en IA y datos; Django trae todo (admin, ORM, auth); FastAPI es moderno y documenta solo | Más lento que Go/Java/C# en CPU; el tipado es opcional | APIs con IA/ML, datos, MVPs rápidos, backoffices (Django) | **Baja** | Muy alta / alta |
| **Java**: **Spring Boot** | Muy robusto y maduro; enorme en bancos, seguros y grandes empresas; excelente rendimiento | Más verboso; Spring tiene mucha "magia" y conceptos | Sistemas empresariales, fintech, banca | Media-alta | Alta / **muy alta en corporativos** |
| **C#**: ASP.NET Core (.NET) | Muy rápido; excelente tooling; lenguaje moderno; multiplataforma | Ecosistema más ligado a Microsoft/Azure | Empresas, sistemas corporativos, SaaS, gobierno | Media | Alta / alta (.NET Core en el top 5 de Sysarmy) |
| **Go**: net/http, Gin, Echo, Fiber | Simple (pocas palabras clave); compila a un binario; concurrencia excelente; pocos recursos | Ecosistema web menos "baterías incluidas"; manejo de errores repetitivo | Microservicios, infraestructura, cloud (Docker y Kubernetes están hechos en Go), alto tráfico\[51\]\[52\] | Media-baja | Media en crecimiento / media, y bien paga |
| **PHP**: **Laravel**, Symfony | Laravel es muy productivo; hosting barato en todos lados; WordPress | Mala fama histórica; uso en declive (JetBrains) | Webs, e-commerce, agencias, CMS | Baja | Media / media (mucho mantenimiento) |
| **Rust**: Axum, Actix | Máximo rendimiento con seguridad de memoria; el más "admirado" (72%)\[51\]\[53\] | Curva muy empinada; pocos puestos junior\[54\] | Sistemas críticos de rendimiento, infraestructura | **Alta** | Baja-media / baja |
| **Kotlin**: Spring Boot, Ktor | Un Java más moderno y conciso; compatible con todo el ecosistema Java | Más chico que Java en backend | Equipos Java que se modernizan, backends para apps Android | Media | Media / baja-media |
| **Ruby**: Ruby on Rails | Muy productivo para prototipos ("convención sobre configuración") | Uso en declive; rendimiento modesto | MVPs de startups, productos existentes (GitHub y Shopify nacieron en Rails) | Baja-media | Baja-media / baja |

### 7.3 Mi recomendación según tu objetivo

- **Querés trabajo lo antes posible y ya sabés algo de JavaScript del frontend:** **TypeScript + Node.js**. Empezá con Express o Fastify para entender lo básico y pasá a **NestJS** para aprender arquitectura ordenada (módulos, controladores, servicios, inyección de dependencias), que además se parece a Spring y a .NET.
- **Te interesan los datos o la IA, o querés el lenguaje más amigable:** **Python + FastAPI**, y Django si querés algo "con todo incluido".
- **Apuntás a bancos, grandes empresas o consultoras:** **Java + Spring Boot** o **C# + .NET**. La curva es más dura, pero hay mucha demanda estable.
- **Segundo lenguaje, más adelante:** **Go**, por su buen sueldo y porque es el lenguaje de la infraestructura cloud.
- **Rust:** no es para empezar. Dejalo como especialización.\[54\]

---

## 8. Por dónde empezar: hoja de ruta para principiantes

**Stack sugerido:** TypeScript + Node.js (Express → NestJS) + PostgreSQL + Prisma/Drizzle + Docker + GitHub Actions. (Si elegís Python, el equivalente es FastAPI + SQLAlchemy + Alembic + pytest.)

| Etapa | Duración orientativa | Qué aprender | Proyecto para practicar |
|---|---|---|---|
| **0. Bases** | 3-6 semanas | Lógica de programación, JavaScript → TypeScript, terminal, **Git y GitHub** | Scripts chicos subidos a GitHub |
| **1. Cómo funciona la web** | 1-2 semanas | HTTP (métodos, códigos, headers), JSON, DNS, qué es una API REST; usar Postman, Insomnia o Bruno | Consumir una API pública |
| **2. Primer backend** | 3-4 semanas | Node.js + Express: rutas, middlewares, validación con Zod, manejo central de errores, variables de entorno | API de tareas (CRUD) en memoria |
| **3. Bases de datos** | 4-6 semanas | **SQL de verdad** (SELECT, JOIN, GROUP BY), PostgreSQL, ORM, migraciones, índices, transacciones | La misma API, persistida en Postgres |
| **4. Arquitectura** | 2-3 semanas | Capas (controlador/servicio/repositorio), estructura por módulos; pasar a NestJS | Refactorizar el proyecto |
| **5. Seguridad** | 3-4 semanas | Registro y login, Argon2id, sesiones vs. JWT, roles, OWASP Top 10, rate limiting, CORS | API con usuarios y permisos |
| **6. Calidad** | 3-4 semanas | Tests unitarios y de integración, OpenAPI/Swagger, logs estructurados, linters | Llegar a una cobertura razonable y documentar |
| **7. Despliegue** | 2-3 semanas | Docker, Docker Compose, GitHub Actions (CI), deploy en Render/Railway/Fly.io con HTTPS | API pública en internet |
| **8. Escala (intermedio)** | Continuo | Redis (caché), colas (BullMQ), paginación por cursor, nociones de AWS, observabilidad | Proyecto con tareas en segundo plano (por ejemplo, envío de emails) |
| **9. Después** | Continuo | Segundo lenguaje (Go, Java o C#), patrones de diseño, system design, microservicios | Contribuir a open source |

**Proyecto de portfolio recomendado:** una API de e-commerce o de reservas (turnos para un consultorio, una cancha de fútbol 5) con usuarios, roles, productos o turnos, pedidos con transacciones, paginación, tests, documentación en Swagger, Docker y desplegada con un dominio. Eso demuestra casi todo lo que piden en una entrevista junior.

**Consejos prácticos:**
- Usá la IA como tutor, no como reemplazo. Según la encuesta Sysarmy 2026.1, el 98% de quienes trabajan en IT en Argentina ya usa IA en su trabajo (el 13% poco, el 42% un poco más y el 43% mucho), así que la diferencia la marca **entender** lo que el código hace (seguridad, diseño, bases de datos).
- Leé documentación oficial: los docs de FastAPI, NestJS y PostgreSQL son excelentes.
- El inglés técnico multiplica tus oportunidades: los puestos dolarizados pagan bastante más que los en pesos.\[55\]

---

## 9. Resumen final: las prácticas que más importan

1. **Separá responsabilidades:** controlador → servicio → repositorio, con carpetas por módulo/funcionalidad.
2. **Monolito modular primero;** microservicios solo cuando el tamaño del sistema o del equipo lo justifiquen.
3. **APIs REST predecibles:** sustantivos en plural, métodos y códigos HTTP correctos, `/v1`, paginación con límite máximo y errores en formato RFC 9457.
4. **Validá todo lo que entra** con esquemas (Zod, Pydantic, Bean Validation).
5. **Autorizá en cada recurso** (que el usuario sea dueño de lo que pide). Es el riesgo n.º 1 de OWASP.\[11\]
6. **Contraseñas con Argon2id,** nunca en texto plano ni encriptadas.
7. **Consultas parametrizadas u ORM;** nunca concatenes SQL.\[30\]
8. **Secretos en variables de entorno o en un gestor de secretos;** `.env` fuera de Git.
9. **HTTPS, rate limiting, CORS con lista explícita** y headers de seguridad.
10. **PostgreSQL + migraciones + índices donde hace falta + transacciones** para operaciones que van juntas.
11. **Tests automatizados** (muchos unitarios y de integración, pocos E2E) que corran en **CI** en cada PR.
12. **Errores centralizados, logs estructurados sin datos sensibles** y monitoreo (OpenTelemetry/Sentry).
13. **Documentá con OpenAPI** y un buen README.
14. **Docker + despliegue automatizado;** app sin estado para poder escalar horizontalmente.
15. **Caché y colas** cuando lo indiquen las mediciones, no antes.

## Caveats

- **Las encuestas tienen sesgos:** Stack Overflow, JetBrains y Sysarmy son autoselectivas. Stack Overflow 2026 tuvo una muestra menor que ediciones anteriores, y "admirado" no es lo mismo que "usado" ni que "demandado".\[44\]
- **Datos de Argentina:** el orden de los lenguajes y frameworks de Sysarmy 2026.1 viene del análisis de OpenQube, citado por fuentes secundarias. No pude acceder a los porcentajes exactos por lenguaje ni a la tabla de sueldos por lenguaje de esa edición. Que Go sea el mejor pago está confirmado para 2025.1, no para 2026.1. Los datos de demanda en LATAM (Get on Board, Adecco) son cualitativos.
- **Sueldos en pesos:** con la inflación argentina pierden vigencia rápido. Tomalos como referencia relativa entre seniorities, no como valores absolutos.
- **Duraciones de la hoja de ruta:** son orientativas, para alguien que dedica unas 10-15 horas por semana.
- **Seguridad:** las recomendaciones (por ejemplo, los parámetros de Argon2id) se actualizan. Revisá las *Cheat Sheets* de OWASP antes de implementar algo en producción.

## Fuentes

1. [Technology 2026 | Stack Overflow Developer Survey](https://survey.stackoverflow.co/2026/technology)
2. [Octoverse: A new developer joins GitHub every second as AI leads TypeScript to #1 - The GitHub Blog](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/)
3. [Maximiliano Firtman on X: "🔴SUELDOS PROGRAMADORES 2026 🇦🇷 💰\$3.254.000 (todos los puestos y seniority de IT) 📉En los últimos 6 meses subió 13% en pesos, 7% en dólares pero bajó 5% en pesos ajustado por IPC (menos poder adquisitivo) 🙍‍♀️19,9% mujeres 🌈0,5% no binario - hay brecha salarial en los puestos senior, no en los junior. 🤖El 98% usa IA en su trabajo: el 13% poco, el 42% un poco más y el 43% mucho. Sueldo sólo programadores: —Junior: \$1.539.000 —Semi-sr: \$2.502.000 —Senior: \$3.500.000 🎓Los que tienen título universitario cobran un 25% más que los que no. 🤝El 71% es planta permanente, 16% "contractor", 7% tercerizado, 4% freelance, 1% cooperativa o sociedad 💵El 68% tiene su sueldo 100% en pesos, el 15% 100% en dólares 🚧El 87% cambiaría de trabajo, y un cuarto de ellos está en búsqueda activa. Fuente: encuesta @sysarmy, análisis de @openqube Basado en mediana de sueldo bruto a enero 2026. Algunos números están redondeados." / X](https://x.com/maxifirtman/status/2029577326652977241)
4. [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
5. [Password Storage - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
6. [Store config in the environment](https://12factor.net/config)
7. [Martin Fowler's Blog, page 34](https://www.goodreads.com/author/show/25215.Martin_Fowler/blog?page=34)
8. [Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)
9. [OWASP API Security Top 10 (2023) — Explained with Examples and Mitigations](https://medium.com/@mukundsv333/owasp-api-security-top-10-2023-explained-with-examples-and-mitigations-f7759801b532)
10. [OWASP Top 10 API Security Risks](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
11. [OWASP API Top 10 2023: Full List & Defenses](https://safeguard.sh/resources/blog/owasp-api-top-10-2023)
12. [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
13. [JSON API Error Handling: RFC 9457 Problem Details and Error Response Formats — Jsonic](https://jsonic.io/guides/json-api-error-handling)
14. [Stop Returning {success:false}: RFC 9457 Problem Details for Modern APIs - LearnHubly Blog](https://www.learnhubly.com/blog/rfc-9457-problem-details-api-error-responses)
15. [OWASP Top 10 - OWASP Developer Guide](https://devguide.owasp.org/en/02-foundations/05-top-ten/)
16. [OWASP Top 10 2025: All 10 Vulnerabilities Explained & How to Fix Them](https://www.reflectiz.com/blog/owasp-top-ten-2025/)
17. [Introduction - OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/)
18. [OWASP API Security Top 10: 2023 Update Explained](https://www.practical-devsecops.com/owasp-api-security-top-10/)
19. [Test the OWASP API Top 10: Examples & Checklist](https://www.apyguard.com/resources/blog/owasp-api-security-top-10)
20. [SQL Injection Prevention - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
21. [JWT vs Session Cookies: Choosing an Authentication Approach](https://usetoolsuite.com/blog/jwt-vs-session-cookies/)
22. [JWT vs Session Cookies — Which to Use](https://www.delimiter.live/guides/jwt-vs-session-cookies)
23. [JWT vs Session Cookies for Web App Login - TechCompare](https://www.techcompare.app/jwt-decoder/jwt-vs-session-cookies)
24. [JWT vs Session Cookies in 2026: Security, APIs & SPAs](https://bytepane.com/blog/jwt-vs-session-cookies-authentication/)
25. [JWT Authentication: Storage, Rotation, Revocation](https://wise-hustlers.com/blog/jwt-authentication-best-practices?lang=en)
26. [JWT vs Session Cookies: Revocation Is the Real Trade-off](https://www.utilix.tech/blog/jwt-vs-session-cookies-tradeoffs)
27. [allenap.me](https://allenap.me/posts/12-factor-app-config-in-the-environment-is-bad-advice)
28. [SQL Injection Prevention](https://deepwiki.com/OWASP/CheatSheetSeries/4.1-sql-injection-prevention)
29. [SQL Injection Cheat Sheet (2026): Payloads, Bypasses, Defenses](https://www.vulnsy.com/cheat-sheets/sql-injection)
30. [SQL Injection Cheat Sheet](https://cybersecurity101.net/cheatsheets/sql-injection/)
31. [Long Live The Test Pyramid — Smashing Magazine](https://www.smashingmagazine.com/2023/09/long-live-test-pyramid/)
32. [The Practical Test Pyramid](https://www.goodreads.com/author_blog_posts/16400790-the-practical-test-pyramid)
33. [Pyramid or Crab? Find a testing strategy that fits | Articles | web.dev](https://web.dev/articles/ta-strategies)
34. [The Testing Pyramid: A Comprehensive Guide - TestRail](https://www.testrail.com/blog/testing-pyramid/)
35. [Why OpenTelemetry Is Now the Foundation for AI Observability](https://tfir.io/opentelemetry-graduation-ai-observability-cncf/)
36. [Gain insights into cloud native applications with the OpenTelemetry Certified Associate (OTCA)](https://www.cncf.io/blog/2024/11/15/gain-insights-into-cloud-native-applications-with-the-opentelemetry-certified-associate-otca/)
37. [OpenTelemetry becomes a CNCF incubating project](https://www.cncf.io/blog/2021/08/26/opentelemetry-becomes-a-cncf-incubating-project/)
38. [OpenTelemetry Guide: Unified Observability for Traces, Metrics, and Logs](https://kx.cloudingenium.com/en/opentelemetry-unified-observability-traces-metrics-logs-guide)
39. [Technology data 2026 | Stack Overflow Developer Survey](https://survey.stackoverflow.co/2026/technology/data)
40. [Web frameworks and technologies — Technology data 2026](https://survey.stackoverflow.co/2026/technology/data/web-framework)
41. [2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/)
42. [Technology](https://survey.stackoverflow.co/2025/technology)
43. [Top Programming Languages 2026: Developer Usage Rankings And Data](https://commandlinux.com/statistics/top-programming-languages/)
44. [Programming Language Market Share 2026: Seven Indexes Compared](https://safeguard.sh/resources/blog/programming-language-market-share-every-index-compared)
45. [60+ Web Development Statistics & Trends (2026) - Colorlib](https://colorlib.com/wp/web-development-statistics/)
46. [TypeScript Tops GitHub Octoverse as AI Era Reshapes Language Choices -- Visual Studio Magazine](https://visualstudiomagazine.com/articles/2025/10/31/typescript-tops-github-octoverse-as-ai-era-reshapes-language-choices.aspx)
47. [TypeScript is the Most-Used Language on GitHub — Here’s Why](https://www.codecademy.com/resources/blog/typescript-most-used-language-on-github)
48. [TypeScript on the rise, PHP matures](https://www.heise.de/en/news/TypeScript-on-the-rise-PHP-matures-JetBrains-shows-ecosystem-change-10771317.html)
49. [Las carreras IT con mejores sueldos hoy y los lenguajes y tecnologías mejor pagas y más demandadas](https://www.iprofesional.com/management/423797-quienes-son-los-talentos-it-mejor-pagos-y-que-carrera-estudiaron)
50. [¿Qué habilidades son más demandadas en roles tech en Latinoamérica?](http://www.getonbrd.com.mx/help/que-habilidades-son-mas-demandadas-en-roles-tech-en-latam)
51. [Top Programming Languages in 2026: Rankings & Salaries](https://distantjob.com/blog/programming-languages-rank/)
52. [Rust vs Go 2026: Pick Go Unless 'Most Things' Is Wrong for You](https://rustvsgo.com/)
53. [Rust VS Go in 2026: The Systems vs Services Split Is Finally Clear — Which One Should You Actually Learn? - Java Code Geeks](https://www.javacodegeeks.com/2026/05/rust-vs-go-in-2026-the-systems-vs-services-split-is-finally-clear-which-one-should-you-actually-learn.html)
54. [5 Programming Languages That Pay \$150k+ in 2026 (Not What You Think)](https://leonstaff.com/blogs/most-in-demand-programming-skills-2026/)
55. [Sueldos tech: la carrera por la IA se cobra puestos mientras crece la brecha entre salarios en pesos y en dólares](https://entretenimientoscordoba.com.ar/2026/03/11/sueldos-tech-la-carrera-por-la-ia-se-cobra-puestos-mientras-crece-la-brecha-entre-salarios-en-pesos-y-en-dolares/)
