# Frontend en 2026: qué aprender según tu objetivo, cómo empezar y cómo está el mercado (guía para principiantes)

**Respuesta corta: empezá por HTML + CSS + JavaScript, y después sumá TypeScript y React. Ese camino te sirve para casi cualquier objetivo y es el que más trabajo ofrece en 2026.** Solo conviene salirse de él si tu meta es muy específica, por ejemplo apps móviles nativas, videojuegos 3D o vender sitios a clientes sin programar. Las encuestas más grandes de 2025-2026 coinciden: JavaScript es el lenguaje más usado por duodécimo año seguido,\[1\] TypeScript pasó a ser el lenguaje número 1 en GitHub\[2\] y React sigue siendo el framework frontend más usado.\[3\] Pero el mercado para juniors está más difícil que hace unos años. Por eso importa menos "qué framework elegir" y más demostrar con proyectos propios que sabés construir, entender y corregir código, incluido el que escribe la IA.

## TL;DR

- **Lenguaje:** HTML, CSS y JavaScript son obligatorios; después aprendé TypeScript, que ya es el estándar profesional (40% de los encuestados del State of JS 2025 escribe solo en TypeScript, y apenas 6% solo en JavaScript).\[4\] Como framework, React es la apuesta más segura para conseguir trabajo (41,5% de uso en Stack Overflow 2026, contra 17,2% de Vue y 16,0% de Angular).\[3\]
- **Cómo empezar:** seguí un solo camino estructurado y gratuito (freeCodeCamp en español, The Odin Project o la ruta de roadmap.sh), construí proyectos propios desde la semana 1, subí todo a GitHub y usá la IA como tutor, no como piloto automático. Con 15-20 horas semanales, un nivel "empleable" junior suele llevar entre 9 y 15 meses.
- **Mercado:** hay trabajo, pero la puerta de entrada se angostó. Un estudio de Stanford (Brynjolfsson, Chandar y Chen) encontró que el empleo de desarrolladores de 22 a 25 años en EE. UU. cayó casi 20% desde su pico de fines de 2022 hasta julio de 2025, mientras en Argentina la mediana de un programador junior era de $1.539.000 brutos mensuales (encuesta Sysarmy 2026.1 analizada por OpenQube, datos a enero de 2026). La diferencia la hacen el portfolio, el inglés y saber trabajar con IA con criterio.

---

## Key Findings

1. **JavaScript sigue siendo la base de todo el frontend.** En la Encuesta de Desarrolladores de Stack Overflow 2026, con 30.903 respuestas de 169 países, JavaScript fue el lenguaje más usado por duodécimo año consecutivo (62%), seguido de SQL (58,4%), HTML/CSS (58,2%) y Python (58,0%). TypeScript quedó en 43,8%.\[5\]
2. **TypeScript "ganó".** Según el informe Octoverse 2025 de GitHub, en agosto de 2025 TypeScript superó a Python y a JavaScript y se convirtió en el lenguaje más usado de la plataforma, con 2.636.006 contribuidores mensuales (+66,6% en un año).\[6\] GitHub lo llamó el cambio de lenguaje más importante en más de una década.\[2\] Las conclusiones del State of JS 2025 lo resumen igual: "TypeScript has won".\[7\]
3. **React domina en uso; Svelte y Vue, en "cariño".** En Stack Overflow 2026, React tiene 41,5% de uso y Next.js 20,6%, Vue 17,2%, Angular 16,0%, Svelte 7,8%, Astro 6,2% y Nuxt 4,4%.\[3\] En la métrica de "admirado" (quienes lo usan y quieren seguir usándolo), Svelte lidera con 59,4%, contra 47,2% de Vue, 46,7% de React y 42,1% de Angular.\[8\]
4. **Las herramientas se estabilizaron, y eso es una buena noticia para quien empieza.** El State of JS 2025 muestra que un desarrollador promedio usó apenas 2,6 frameworks frontend en toda su carrera.\[9\] Vite es la herramienta de build con mayor satisfacción (98%).\[10\] En CSS, Tailwind es el framework más usado según el State of CSS 2025.\[11\]
5. **La IA ya es parte del trabajo diario.** Según el State of JS 2025 (Devographics), el 29% del código de los encuestados fue generado por IA a fines de 2025, contra 20% el año anterior. En Stack Overflow 2026, 73% de quienes usan asistentes de código los usan todos los días.\[12\] En Argentina, 98% de los encuestados por Sysarmy usa IA en su trabajo.\[13\]
6. **El mercado junior está más exigente.** El estudio "Canaries in the Coal Mine?" (Stanford Digital Economy Lab) encontró que el empleo de desarrolladores de software de 22 a 25 años cayó casi 20% entre su pico de fines de 2022 y julio de 2025 en EE. UU., y que los jóvenes de 22 a 25 años en los trabajos más expuestos a la IA sufrieron una caída relativa del empleo del 13% aun controlando por factores de cada empresa. Los trabajadores con más experiencia no sufrieron esa caída.

---

## Details

### 1. ¿Qué lenguaje o tecnología conviene según lo que quieras hacer?

Primero, una aclaración importante: en el frontend web **no elegís un lenguaje, elegís un stack**. Los navegadores solo entienden HTML (estructura), CSS (diseño) y JavaScript (comportamiento). TypeScript es JavaScript con "tipos" que te avisan de errores antes de ejecutar. Los frameworks (React, Vue, Angular, Svelte) son herramientas construidas sobre JavaScript/TypeScript. Por eso, **HTML + CSS + JavaScript son el punto de partida en cualquier caso**.

#### Tabla rápida: "si querés X → usá Y"

| Si querés... | Usá principalmente | Alternativas | Dificultad para un principiante | Por qué |
|---|---|---|---|---|
| Página simple, sitio personal, portfolio, landing | HTML + CSS (+ un poco de JS) | Astro cuando quieras algo más moderno | ⭐ Baja | No necesitás framework. Aprendés las bases que usarás siempre |
| App web interactiva (dashboard, red social, e-commerce) | JavaScript → TypeScript + React | Vue (más amigable), Svelte (más simple) | ⭐⭐⭐ Media | React tiene más empleo, ejemplos y librerías |
| Proyecto grande en empresa | TypeScript + React/Next.js o Angular | Vue + Nuxt | ⭐⭐⭐⭐ Media-alta | Las empresas valoran estructura, tipos y equipos grandes |
| App móvil reutilizando lo que sabés de web | React Native (con Expo) | Ionic/Capacitor | ⭐⭐⭐ Media | Reusás JavaScript/TypeScript y React |
| App móvil con el mejor resultado multiplataforma, sin importar el lenguaje | Flutter (lenguaje Dart) | Kotlin (Android) / Swift (iOS) nativos | ⭐⭐⭐ Media | Muy popular, pero es otro ecosistema distinto de la web |
| App de escritorio | Electron (solo JS/TS) | Tauri (más liviano, pero usa Rust) | ⭐⭐⭐ Media | Electron es lo más fácil si ya sabés web |
| Juegos en el navegador 2D | JavaScript + Canvas → Phaser | PixiJS | ⭐⭐⭐ Media | Phaser es el framework 2D más completo para web |
| Gráficos 3D / experiencias 3D | Three.js | Babylon.js, React Three Fiber | ⭐⭐⭐⭐ Alta | Three.js es la librería 3D más usada en la web |
| Conseguir trabajo lo antes posible | HTML/CSS/JS → TypeScript → React (+ Next.js) + Git | Angular si tu zona tiene muchas ofertas de empresas grandes | ⭐⭐⭐ Media | Es lo que más piden las ofertas |
| Freelance / sitios para clientes | WordPress, Shopify, Webflow + HTML/CSS/JS | Astro, Framer, Wix | ⭐⭐ Baja-media | Muchos clientes ya usan o quieren estas plataformas |

#### A) Páginas simples, sitio personal, portfolio o landing pages
- **Qué usar:** HTML semántico + CSS moderno (Flexbox, Grid, diseño responsive) y algo de JavaScript para pequeñas interacciones (menú móvil, formulario).
- **Por qué:** es lo más fácil, no requiere instalar nada complejo y te enseña las bases que vas a usar siempre.
- **Siguiente paso:** cuando quieras sitios con blog o muchas páginas, **Astro** es una gran opción. En el State of JS 2025 lideró la satisfacción entre los meta-frameworks, con una ventaja de 39 puntos sobre Next.js.\[14\]
- **Para publicarlo gratis:** GitHub Pages, Netlify o Vercel, que figuran entre los hostings más usados en el State of JS 2025.\[15\]

#### B) Aplicaciones web interactivas (dashboards, redes sociales, e-commerce)
- **Qué usar:** JavaScript sólido → **TypeScript** → **React**. Cuando la app necesite varias páginas, buen SEO o servidor, sumá **Next.js**.
- **Por qué React:** es el más usado y el que más ofertas tiene. Además, es el que más ejemplos y respuestas encontrás en internet y el que más "entienden" las herramientas de IA.
- **Alternativas:**
  - **Vue:** muchos lo consideran el más amigable para principiantes, porque sus plantillas se parecen a HTML normal.\[16\] Tiene buena demanda en algunas empresas y en Asia/Europa.
  - **Svelte:** el más querido (59,4% de admiración en Stack Overflow 2026) y el más simple de leer, pero con muchas menos ofertas laborales (7,8% de uso).\[3\]\[8\]
  - **Angular:** más "cuadrado" y completo. Es común en bancos, gobiernos y grandes corporaciones.

**Comparación de frameworks (datos 2025-2026)**

| Framework | Uso (Stack Overflow 2026) | Admiración (SO 2026) | Uso entre devs JS (State of JS 2025) | Curva de aprendizaje | Ideal para |
|---|---|---|---|---|---|
| **React** | 41,5% | 46,7% | ~85% | Media (JSX, hooks) | Empleo, apps interactivas, ecosistema enorme |
| **Next.js** (sobre React) | 20,6% | 39,3% | — | Media-alta | Apps completas con SEO y servidor |
| **Vue** | 17,2% | 47,2% | ~52% | Baja-media | Aprender rápido, proyectos medianos |
| **Angular** | 16,0% | 42,1% | ~48-50% | Alta | Empresas grandes, proyectos corporativos |
| **Svelte** | 7,8% | 59,4% | ~27% | Baja | Proyectos personales, rendimiento |
| **Astro** | 6,2% | — | — | Baja | Sitios de contenido, blogs, landings |
| **Nuxt** (sobre Vue) | 4,4% | 47% | — | Media | Apps Vue con SEO y servidor |

*Nota sobre los datos:* las cifras del State of JS son mucho más altas porque solo responden personas del mundo JavaScript, mientras que Stack Overflow encuesta a todo tipo de programadores. Fijate en el **orden**, que es el mismo en las dos: React primero, luego Vue y Angular, y después Svelte.

#### C) JavaScript vs TypeScript: ¿cuál primero?

| | JavaScript | TypeScript |
|---|---|---|
| Qué es | El lenguaje que entiende el navegador | JavaScript + tipos (se "traduce" a JS) |
| Para empezar | ✅ Más simple, ves resultados al instante | ❌ Agrega conceptos extra al principio |
| En el trabajo | Necesario, pero cada vez menos "puro" | El estándar en empresas y proyectos nuevos |
| Con IA | Funciona | Funciona mejor: los tipos ayudan a detectar errores del código generado |

**Recomendación:** aprendé JavaScript primero (2-4 meses de base) y pasá a TypeScript **antes** o **junto con** React. No lo dejes para "algún día". Según el State of JS 2025, 40% de los encuestados ya escribe exclusivamente en TypeScript (eran 28% en 2022), y la falta de tipado estático es la queja número uno de quienes usan JavaScript.\[4\]\[17\]

#### D) Apps móviles con tecnologías frontend
- **React Native (con Expo):** la mejor opción si ya sabés React, porque reusás JavaScript/TypeScript y gran parte de tu forma de pensar.
- **Flutter (lenguaje Dart):** muy popular y con excelente rendimiento visual, pero tenés que aprender otro lenguaje y otro ecosistema. Los datos de popularidad Flutter vs React Native se contradicen según la fuente: Flutter suele liderar en estrellas de GitHub y preguntas de Stack Overflow, y React Native en tamaño de comunidad JavaScript.\[18\]\[19\] **Ninguno es una mala elección.**
- **Ionic/Capacitor:** convierte una app web en app móvil. Es lo más fácil, aunque menos "nativo".
- **Kotlin (Android) y Swift (iOS):** el camino nativo, con máximo rendimiento y acceso al teléfono. Es otra carrera, la de desarrollador mobile, no frontend web.
- **Consejo:** si tu objetivo principal es web y "algún día" mobile, elegí React → React Native. Si tu objetivo principal es mobile desde el día 1, evaluá Flutter.

#### E) Apps de escritorio
- **Electron:** usás solo HTML/CSS/JS. Con él se hicieron VS Code, Slack y Discord. Su contra es que pesa mucho, porque incluye un navegador entero: un instalador de unos 100 MB.\[20\]
- **Tauri:** mucho más liviano (instaladores de alrededor de 1 MB en pruebas recientes) y también puede generar apps móviles, pero la parte de "backend" de la app se escribe en **Rust**, un lenguaje más difícil.\[20\]
- **Consejo:** para un principiante, Electron. Tauri cuando ya te sientas cómodo y quieras aprender algo de Rust.

#### F) Videojuegos en el navegador y gráficos 3D
- **Empezá con Canvas + JavaScript puro** (juegos simples como Pong o Snake) para entender el "game loop".
- **2D:** **Phaser**, que lanzó su versión 4 en abril de 2026. Es el framework 2D más completo y con más comunidad.\[21\]\[22\]
- **3D:** **Three.js**, la librería 3D más usada de la web. En 2026 ya funciona con **WebGPU**, la nueva tecnología gráfica disponible en todos los navegadores principales, y vuelve sola a WebGL si el navegador no la soporta.\[21\]\[23\]\[24\]
- **Realidad:** es un camino hermoso para portfolio y creatividad, pero tiene **menos ofertas de trabajo** que el desarrollo de aplicaciones. Si tu sueño es hacer videojuegos "grandes", motores como Godot o Unity son otro camino.

#### G) Freelance y sitios para clientes
- **WordPress** sigue siendo gigante: según W3Techs, al 16 de noviembre de 2026 lo usa el 38,5% de todos los sitios web y el 57,5% de los sitios cuyo gestor de contenidos se conoce. Su participación viene bajando desde el 43,0% de enero de 2026 (según el resumen de datos históricos de W3Techs publicado por eSEOspace), pero sigue siendo, por lejos, la plataforma más usada.
- **Shopify** (tiendas online): es la segunda plataforma, con ~5,4% de todos los sitios, y la que más crece.\[25\]
- **Webflow / Framer:** diseño visual "sin código" (~0,8% de los sitios en el caso de Webflow).\[26\] Son ideales si te gusta el diseño.
- **Consejo:** saber HTML/CSS/JS te hace **mucho mejor** con estas herramientas, porque podés personalizar lo que otros no pueden. Una combinación muy rentable para freelance en Latinoamérica: **HTML/CSS/JS + WordPress o Shopify + nociones de diseño (Figma) y SEO.**

#### H) Proyectos grandes en empresas
- **TypeScript es casi obligatorio.**
- **React + Next.js** en startups y empresas de producto. **Angular** en corporaciones, bancos y consultoras grandes.
- También piden testing (Vitest y Playwright fueron las herramientas que más crecieron en el State of JS 2025), accesibilidad, rendimiento y Git en equipo.\[10\]

---

### 2. Consejos prácticos para principiantes

#### Errores comunes (y cómo evitarlos)
1. **Saltar a React sin saber JavaScript.** Es el error número uno. Si no entendés funciones, arrays, objetos, eventos y `fetch`, React te va a parecer magia y te vas a frustrar.
2. **Cambiar de lenguaje o curso cada dos semanas.** Elegí un camino y terminalo. Lo que aprendés en un lenguaje (variables, funciones, lógica) se transfiere, pero empezar de cero una y otra vez no.\[27\]
3. **Subestimar CSS.** Muchos lo ven "fácil" y después no saben centrar un elemento ni hacer un diseño responsive. Dedicale tiempo de verdad.
4. **Copiar código sin entenderlo**, sea de un tutorial o de una IA.
5. **No usar Git desde el principio.** Aprendé lo básico (`add`, `commit`, `push`) en el primer mes.
6. **Estudiar solo, sin feedback.** Una comunidad acelera muchísimo.

#### Cómo salir del "tutorial hell"
El "tutorial hell" es ver curso tras curso sin poder construir nada solo. Para salir:
- **Regla 1:1:** por cada hora de tutorial, una hora construyendo algo **sin** el tutorial.
- **Modificá lo que aprendés:** si el curso hace una lista de tareas, agregale filtros, modo oscuro o guardado en el navegador.
- **Proyectos con requisitos, no con instrucciones:** freeCodeCamp, The Odin Project y la sección de proyectos de roadmap.sh te dan un enunciado, no un paso a paso.\[28\]
- **Atascate a propósito:** buscar en MDN, leer el error y probar es exactamente el trabajo real.

#### Proyectos propios, portfolio y GitHub
- Tu **portfolio** es tu CV real como junior. Mejor 3-4 proyectos terminados, publicados online y bien explicados que 20 clones a medias.
- Cada proyecto en **GitHub** debería tener un README con qué hace, qué tecnologías usa, una captura y un link a la versión online.
- Al menos un proyecto debería **consumir una API** (datos reales) y otro debería resolver un problema de alguien real: un comercio de tu barrio, un club o una ONG.

#### Cómo usar la IA para aprender sin depender de ella
La IA ya es parte del trabajo: en Stack Overflow 2026, los agentes más usados fueron Claude Code (65,5% de quienes usan agentes) y GitHub Copilot (58,7%). La clave es **usarla como profesor, no como el que hace la tarea**:
- ✅ **Sí:** pedile que te **explique** un error o un concepto "como a un principiante", que te dé **pistas** en vez de la solución, que **revise** tu código y te diga qué mejorar, y que te arme ejercicios.
- ❌ **No (al principio):** pedirle que haga el proyecto entero. Si no podés explicar línea por línea lo que generó, todavía no lo aprendiste.
- **Regla práctica:** durante los primeros 3-4 meses, desactivá el autocompletado de IA en el editor. Usá el chat para preguntar, pero escribí vos el código.
- **Por qué importa:** las empresas ya no necesitan a alguien que solo "traduzca un diseño a código", porque eso lo hace la IA.\[29\] Necesitan a alguien que **entienda, revise y corrija** lo que la IA genera.\[30\]

#### Inglés técnico
- La documentación, los errores, la mayoría de las ofertas remotas y las respuestas más actualizadas están en inglés.
- No necesitás hablar perfecto para empezar. Sí necesitás **leer** documentación. Empezá leyendo MDN en inglés con el traductor al lado y subí la dificultad de a poco.
- Para trabajo remoto con empresas del exterior, el inglés suele ser **el factor que más multiplica el sueldo**.

#### Comunidad
- Comunidades en español: los Discord de MoureDev (más de 100.000 miembros) y de midudev; los foros de freeCodeCamp; el Discord de The Odin Project (en inglés).\[31\]\[32\]
- Participá: preguntá, respondé dudas de otros que estén un paso atrás y compartí tus proyectos.

---

### 3. La mejor manera de empezar: hoja de ruta paso a paso

**Estimación realista:** las guías de 2026 suelen hablar de 6-9 meses estudiando 3-4 horas por día para llegar a nivel de entrevista junior.\[33\] Si estudiás y trabajás o cursás (10-15 h/semana), contá con **12-18 meses**. Son estimaciones orientativas: lo que mide tu avance son los proyectos terminados, no el calendario.

| Etapa | Qué aprender | Tiempo aprox. (15-20 h/semana) | Proyecto para cerrar la etapa |
|---|---|---|---|
| **0. Preparación** | Cómo funciona la web (navegador, servidor, dominio), instalar VS Code, usar la consola del navegador | 1 semana | — |
| **1. HTML** | Etiquetas semánticas, formularios, accesibilidad básica | 2-3 semanas | CV de una página en HTML |
| **2. CSS** | Selectores, modelo de caja, Flexbox, Grid, responsive (mobile first) | 4-6 semanas | Landing page responsive + portfolio v1 |
| **3. Git y GitHub** | `init`, `add`, `commit`, `push`, ramas básicas; publicar en GitHub Pages | 1 semana (y después siempre) | Portfolio publicado online |
| **4. JavaScript** | Variables, funciones, arrays, objetos, DOM, eventos, `fetch`, async/await | 2-4 meses | Lista de tareas, calculadora, quiz, app del clima con API\[34\] |
| **5. Herramientas** | npm, Vite, DevTools del navegador; Tailwind opcional | 2-3 semanas | Rehacer un proyecto con Vite |
| **6. TypeScript** | Tipos básicos, interfaces, tipar funciones | 3-4 semanas | Pasar la app del clima a TypeScript |
| **7. React** | Componentes, props, estado, hooks, formularios, rutas | 2-3 meses | Mini e-commerce o dashboard con API |
| **8. Profesionalizar** | Next.js o Astro, testing básico (Vitest), accesibilidad, rendimiento | 1-2 meses | Proyecto "estrella" para el portfolio |
| **9. Búsqueda laboral** | README, LinkedIn, CV, práctica de entrevistas, inglés | Continuo | Portfolio final con 3-4 proyectos sólidos |

#### Ideas de primeros proyectos (de más fácil a más difícil)
1. **CV en HTML** (solo HTML)
2. **Página de un comercio ficticio** con varias secciones (HTML + CSS)
3. **Landing page responsive** de un producto (Flexbox/Grid)
4. **Portfolio personal** publicado online
5. **Calculadora** o **contador** (primer JavaScript)
6. **Lista de tareas** que guarde datos en el navegador (`localStorage`)
7. **Quiz** de preguntas con puntaje
8. **App del clima** que consuma una API real
9. **Buscador de películas o Pokémon** con filtros (API + manejo de errores)
10. **Juego simple** (Piedra-papel-tijera, Snake, memotest)
11. **Dashboard** con gráficos (React + TypeScript)
12. **Mini e-commerce** con carrito (React + rutas + estado)
13. **Proyecto real para alguien real** (el que más valor tiene en una entrevista)

#### Recursos gratuitos recomendados

| Recurso | Qué ofrece | ¿En español? | Para qué usarlo |
|---|---|---|---|
| **MDN Web Docs** (Mozilla) | La documentación de referencia de HTML, CSS y JS | Sí, parcial (lo más completo, en inglés) | Consulta diaria, "el diccionario" |
| **freeCodeCamp** | Currículo interactivo gratuito con certificaciones; la nueva certificación de Diseño Web Responsive (con examen final) se lanzó en diciembre de 2025\[35\] | Sí, buena parte | Camino estructurado de punta a punta |
| **The Odin Project** | Currículo gratuito basado en proyectos (fundamentos + JavaScript/React) | No (inglés) | Aprender a construir solo, sin "mano en mano" |
| **roadmap.sh** | Rutas interactivas (incluye una "Frontend Beginner") e ideas de proyectos | No (inglés, fácil de traducir) | Saber qué aprender y en qué orden\[36\]\[37\] |
| **midudev** (YouTube/Twitch) | Cursos gratis de HTML, JavaScript, React, TypeScript, Tailwind y un bootcamp FullStack gratuito | Sí | Cursos en video de calidad y comunidad\[38\] |
| **MoureDev (Brais Moure)** | Cursos gratis de JavaScript, Git/GitHub, Python; guía PDF "Ruta de estudio programadores junior 2026" | Sí | Fundamentos, Git y visión del sector\[39\]\[40\] |
| **Codo a Codo** (Ciudad de Buenos Aires) | Formación Full Stack gratuita de 20 semanas con certificado oficial\[41\] | Sí | Cursada con docentes y fechas; se anota por convocatoria |
| **Argentina Programa 4.0** | Cursos gratuitos de programación y testing\[42\] | Sí | **Ojo:** al momento de esta investigación el sitio oficial indicaba que no había vacantes disponibles y ofrecía un formulario para avisar cuando se abran\[42\] |

**Mi combinación recomendada:** freeCodeCamp (estructura) + videos de midudev o MoureDev (explicaciones en español) + MDN (consulta) + roadmap.sh (mapa) + una comunidad de Discord.

---

### 4. Estado del mercado laboral frontend (2025-2026)

#### Panorama general
- **El trabajo existe, pero cambió de forma.** El blog oficial de Stack Overflow describió así la encuesta 2026: antes de 2020 "podías tropezarte con una oferta de trabajo"; hoy hay perfiles de LinkedIn con "Open to Work" durante meses.\[12\]
- **La entrada es lo más difícil.** El estudio de Stanford "Canaries in the Coal Mine?" (Brynjolfsson, Chandar y Chen), con datos de nóminas de millones de trabajadores en EE. UU., encontró que el empleo de desarrolladores de 22 a 25 años cayó casi 20% desde su pico de fines de 2022 hasta julio de 2025.\[43\]\[44\] En la actualización de agosto de 2026, el empleo de jóvenes en ocupaciones muy expuestas a la IA estaba 19% por debajo de lo esperado, y los trabajadores con experiencia no mostraban esa brecha.\[45\] *Matiz:* los propios autores aclaran que la caída en software probablemente **no se explica solo por la IA**, porque también influyeron el fin del boom post-pandemia y las tasas de interés.\[43\]
- **Más gente trabajando por su cuenta.** En Stack Overflow 2026, quienes dicen trabajar en una "organización de una persona" saltaron de 4% a 10%. Y solo 18% de los desarrolladores va a la oficina todos los días, así que el trabajo remoto sigue siendo la norma.\[12\]
- **Lo que esto significa para vos:** el perfil "junior que solo maqueta diseños" es el más reemplazable.\[29\] El perfil "junior que entiende lo que hace, revisa código de IA, sabe TypeScript/React, accesibilidad y se comunica bien" sigue consiguiendo trabajo.

#### Sueldos en Argentina (Sysarmy/OpenQube, encuesta 2026.1)
La encuesta de sueldos de Sysarmy es la referencia más usada del sector IT argentino. Su edición 2026.1 consideró 4.939 respuestas válidas, con datos de sueldo bruto mensual a enero de 2026.\[13\]\[46\]\[47\]

| Seniority (programadores, todas las especialidades) | Mediana bruta mensual |
|---|---|
| Junior (0-2 años) | ~$1.539.000 |
| Semi-senior (2-5 años) | ~$2.502.000 |
| Senior (5+ años) | ~$3.500.000 |
| Todo IT (todos los puestos) | ~$3.254.000 |

Otros datos de la misma encuesta:
- **68%** cobra 100% en pesos y **15%** cobra 100% en dólares. Con sueldo dolarizado, las medianas semi-senior y senior suben bastante (≈$3,2M y ≈$5,3M según el análisis de Coderhouse).\[13\]\[47\]
- **98%** usa IA en su trabajo.\[13\]
- Quienes tienen **título universitario cobran ~25% más**.\[13\]
- En los últimos 6 meses los sueldos subieron 13% en pesos, pero **bajaron 5% ajustados por inflación**.\[48\]

*Limitación:* la encuesta publicada no separa una mediana específica de "frontend". Una encuesta colaborativa más chica (Salancy) da para frontend junior ~$2,1M y semi-senior ~$3,6M,\[49\] pero tiene muestras pequeñas y sin fecha clara, así que tomala solo como referencia.

#### Trabajo remoto en dólares (Latinoamérica)
- La **mediana global** para "Developer, front-end" en Stack Overflow 2026 ronda los **USD 70.000 anuales**,\[50\] pero ese número está muy inflado por EE. UU. y Europa.
- Las empresas de contratación de talento latinoamericano estiman para frontend remoto rangos de **USD 2.300-3.500/mes (junior)**, **3.500-5.200 (semi-senior)** y **5.200-6.800 (senior)**, con una mediana regional de ~USD 4.000/mes.\[51\]\[52\] **Advertencia:** son empresas con interés comercial, sus muestras son chicas y otras fuentes dan valores hasta un 50% menores.\[53\]\[54\] Un desarrollador argentino que cobra en dólares para una empresa local suele ganar bastante menos que esos números.
- Lo que más mueve la aguja hacia esos sueldos es el **inglés** y la **experiencia demostrable**, más que el framework.

#### Habilidades más pedidas en 2026
1. **JavaScript sólido + TypeScript**
2. **React** (y Next.js); Angular en corporaciones
3. **CSS moderno y responsive**; Tailwind es el framework CSS más usado según el State of CSS 2025\[11\]
4. **Git/GitHub** y trabajo en equipo
5. **Consumo de APIs**, manejo de estado y de errores
6. **Accesibilidad y rendimiento** (Core Web Vitals)
7. **Testing básico** (Vitest, Playwright)
8. **Uso criterioso de IA**: saber pedir, revisar y corregir
9. **Inglés** y comunicación

---

## Recommendations

**Si no sabés todavía qué querés hacer (lo más probable al empezar), seguí este plan concreto:**

1. **Meses 1-2:** HTML + CSS con freeCodeCamp (en español) y el curso de HTML de midudev. Aprendé Git en la semana 3-4 con el curso de MoureDev. **Entregable:** tu portfolio v1 publicado en GitHub Pages.
2. **Meses 3-6:** JavaScript a fondo (freeCodeCamp + curso de JavaScript de MoureDev o midudev + MDN). **Entregables:** lista de tareas, quiz y app del clima con API.
3. **Meses 7-8:** TypeScript + Vite.
4. **Meses 9-12:** React y, después, Next.js o Astro. **Entregable:** un proyecto "estrella" (dashboard o mini e-commerce) y un proyecto para alguien real.
5. **Desde el día 1:** 20-30 minutos diarios de inglés técnico, una comunidad de Discord y la IA como tutor, no como piloto automático.
6. **Mirá las convocatorias** de Codo a Codo y de Argentina Programa 4.0 si buscás cursada con docentes y certificado oficial gratuito.

**Si ya tenés un objetivo claro:**
- **Freelance rápido:** HTML/CSS/JS + WordPress o Shopify + Figma básico. Podés tomar los primeros clientes chicos en 4-6 meses.
- **Mobile:** HTML/CSS/JS → React → React Native con Expo. Flutter si querés ir directo a mobile.
- **Juegos/3D:** JavaScript → Canvas → Phaser (2D) o Three.js (3D), como proyectos de portfolio llamativos.
- **Empresa grande:** el camino principal, con TypeScript fuerte; sumá Angular si las ofertas de tu ciudad lo piden.

**En una frase:** HTML → CSS → Git → JavaScript → TypeScript → React, construyendo un proyecto en cada etapa. No es la ruta "de moda", es la ruta que más puertas abre en 2026.

---

## Caveats

- **Las encuestas tienen sesgos.** Stack Overflow 2026 tuvo menos participantes que 2025 (30.903 respuestas contra más de 49.000), y el State of JS lo responden sobre todo personas muy metidas en JavaScript. Por eso sus porcentajes difieren mucho, aunque el orden de popularidad coincide.
- **Datos de Flutter vs React Native contradictorios:** distintas fuentes dan resultados opuestos según la métrica. No tomes ninguna cifra única como definitiva.
- **Sueldos:** las cifras de Sysarmy son de enero de 2026 y, con la inflación, ya perdieron poder adquisitivo. Las cifras en dólares de empresas de contratación son orientativas y tienen interés comercial. La cifra global de Stack Overflow 2026 para frontend se tomó de un extracto de su página de datos y no se pudo verificar en detalle.
- **El estudio de Stanford** usa datos de EE. UU. y no de Latinoamérica, y sus autores advierten que la IA no explica toda la caída del empleo junior.
- **Programas gubernamentales:** Argentina Programa 4.0 y Codo a Codo abren por convocatorias que cambian. Verificá en sus sitios oficiales antes de planificar.
- **Los tiempos de aprendizaje son estimaciones:** dependen de tus horas reales de práctica, de tu constancia y de cuántos proyectos construyas por tu cuenta.

## Fuentes

1. [Stack Overflow’s 2026 Developer Survey Reveals Positive Sentiment Towards AI — but Trust Remains Conditional - Press release - Stack Overflow](https://stackoverflow.co/company/press/archive/stack-overflow-annual-developer-survey-ai-trust-conditional)
2. [Octoverse: A new developer joins GitHub every second as AI leads TypeScript to #1 - The GitHub Blog](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/)
3. [Technology data 2026 | Stack Overflow Developer Survey](https://survey.stackoverflow.co/2026/technology/data)
4. [state of js survey 2025](https://www.infoq.com/news/2026/03/state-of-js-survey-2025)
5. [Programming Language Statistics 2026: November Rankings](https://rockstardeveloperuniversity.com/programming-language-statistics/)
6. [TypeScript Tops GitHub Octoverse as AI Era Reshapes Language Choices -- Visual Studio Magazine](https://visualstudiomagazine.com/articles/2025/10/31/typescript-tops-github-octoverse-as-ai-era-reshapes-language-choices.aspx)
7. [State of JavaScript 2025: Conclusion](https://2025.stateofjs.com/en-US/conclusion/)
8. [Web frameworks and technologies — Technology data 2026](https://survey.stackoverflow.co/2026/technology/data/da-webframe)
9. [State of JavaScript 2025: Key Takeaways for Dev Teams](https://strapi.io/blog/state-of-javascript-2025-key-takeaways)
10. [State of JavaScript 2025: Awards](https://2025.stateofjs.com/en-US/awards/)
11. [Best Tailwind CSS Courses 2026: 8 Compared](https://scrimba.com/articles/best-tailwind-css-courses-2026/)
12. [The results of the 2026 Developer Survey are here! - Stack Overflow](https://stackoverflow.blog/2026/10/06/the-results-of-the-2026-developer-survey-are-here/)
13. [Maximiliano Firtman on X: "🔴SUELDOS PROGRAMADORES 2026 🇦🇷 💰\$3.254.000 (todos los puestos y seniority de IT) 📉En los últimos 6 meses subió 13% en pesos, 7% en dólares pero bajó 5% en pesos ajustado por IPC (menos poder adquisitivo) 🙍‍♀️19,9% mujeres 🌈0,5% no binario - hay brecha salarial en los puestos senior, no en los junior. 🤖El 98% usa IA en su trabajo: el 13% poco, el 42% un poco más y el 43% mucho. Sueldo sólo programadores: —Junior: \$1.539.000 —Semi-sr: \$2.502.000 —Senior: \$3.500.000 🎓Los que tienen título universitario cobran un 25% más que los que no. 🤝El 71% es planta permanente, 16% "contractor", 7% tercerizado, 4% freelance, 1% cooperativa o sociedad 💵El 68% tiene su sueldo 100% en pesos, el 15% 100% en dólares 🚧El 87% cambiaría de trabajo, y un cuarto de ellos está en búsqueda activa. Fuente: encuesta @sysarmy, análisis de @openqube Basado en mediana de sueldo bruto a enero 2026. Algunos números están redondeados." / X](https://x.com/maxifirtman/status/2029577326652977241)
14. [Review of Top JavaScript Frontend Frameworks](https://strapi.io/blog/comprehensive-review-of-top-javascript-frontend-frameworks)
15. [State of JavaScript 2025: Other Tools](https://2025.stateofjs.com/en-US/other-tools/)
16. [Top 12 Frontend Technologies to Use in 2026: Expert Advice](https://roadmap.sh/frontend/technologies)
17. [State of JavaScript 2025: What the Survey Results Mean for Your Development](https://reptile.haus/journal/state-of-javascript-2025-what-the-survey-results-mean-for-your-development-team/)
18. [Flutter vs React Native Statistics 2026: Adoption, GitHub, Jobs, Downloads and Developer Survey Data - Quash](https://quashbugs.com/blog/flutter-vs-react-native-statistics)
19. [Flutter vs React Native vs Capacitor vs Tauri 2026: Complete Framework Comparison Guide](https://www.oflight.co.jp/en/columns/flutter-rn-capacitor-tauri-overview-2026)
20. [Electron alternatives 2026: Tauri, Wails, Flutter and 8 more](https://dawloom.com/blog/electron-alternatives/)
21. [Top JavaScript Game Engines & Libraries (2026)](https://codersera.com/blog/top-javascript-game-engines-and-libraries/)
22. [Phaser (game framework)](<https://en.wikipedia.org/wiki/Phaser_(game_framework)>)
23. [Three.js Latest Version: r187 Changelog & 2026 Releases](https://www.utsubo.com/blog/threejs-2026-what-changed)
24. [WebGPU](https://en.wikipedia.org/wiki/WebGPU)
25. [CMS Market Share 2026: 80+ Statistics, Trends & Data - Colorlib](https://colorlib.com/wp/cms-market-share/)
26. [WordPress Statistics 2026: Share Falls to 40.2% (Sep Data)](https://axis-intelligence.com/wordpress-statistics/)
27. [Cómo aprender a programar gratis en 2026: la ruta y los cursos que recomiendo - DEV Community](https://dev.to/unaivv/como-aprender-a-programar-gratis-en-2026-la-ruta-y-los-cursos-que-recomiendo-275k)
28. [Frontend Projects](https://roadmap.sh/frontend/projects)
29. [Is frontend development dying? An honest 2026 verdict](https://www.netguru.com/blog/is-frontend-development-dying)
30. [Is Front-End Development Dead in 2026? Trends, Demand & Career Outlook](https://www.junkiescoder.com/blog/front-end-web-development-in-2026)
31. [MoureDev by Brais Moure - YouTube](https://www.youtube.com/channel/UCxPD7bsocoAMq8Dj18kmGyQ)
32. [MoureDev by Brais Moure - YouTube](<https://www.youtube.com/MoureDevApps)>)
33. [Frontend Developer Roadmap 2026: Skills & Projects](https://www.codebegun.com/career/frontend-developer-roadmap-2026)
34. [Complete Frontend Developer Roadmap for Beginners in 2026](https://readytodev.pro/blog/complete-frontend-developer-roadmap)
35. [Responsive Web Design Certification - freeCodeCamp Contributors - The freeCodeCamp Forum](https://forum.freecodecamp.org/t/responsive-web-design-certification/769100)
36. [GitHub - nilbuild/developer-roadmap: Interactive roadmaps, guides and other educational content to help developers grow in their careers. · GitHub](https://github.com/kamranahmedse/developer-roadmap)
37. [roadmap.sh: Free Developer Learning Roadmaps and Roadmap Pro](https://bestproductivityresources.com/resources/roadmap-sh)
38. [midudev - YouTube](https://www.youtube.com/c/midudev?sub_confirmation=1)
39. [mouredev (Brais Moure) · GitHub](https://github.com/mouredev)
40. [Guías y recursos gratis en PDF](https://mouredev.pro/recursos)
41. [Abrió la inscripción de Codo a Codo, la formación gratuita de programadores](https://buenosaires.gob.ar/educacion/noticias/inscribite-en-codo-codo-40-y-capacitate-en-programacion)
42. [Solicitar inscripción a una capacitación de Argentina Programa 4.0](https://www.argentina.gob.ar/servicio/solicitar-inscripcion-una-capacitacion-de-argentina-programa-40)
43. [A Primer on “Canaries in the Coal Mine? Six Facts About the Recent Employment Effects of Artificial Intelligence”](https://bharatchandar.substack.com/p/a-primer-on-canaries-in-the-coal)
44. [The Canary in the Classroom](https://hollisrobbinsanecdotal.substack.com/p/the-canary-in-the-classroom)
45. [Canaries in the Coal Mine? Six Facts about the Recent Employment Effects of Artificial Intelligence](https://digitaleconomy.stanford.edu/app/uploads/2026/08/Canaries_August2026.pdf)
46. [El blog de quienes dan soporte - Sysarmy](https://sysarmy.com/blog/posts/resultados-de-la-encuesta-de-sueldos-2026-1/)
47. [Perfiles tech más demandados en Argentina y sueldos | Coderhouse](https://www.coderhouse.com/coderlibrary/perfiles-tecnologicos-mas-demandados-argentina)
48. [Maximiliano Firtman on X: "🔴SUELDOS PROGRAMADORES 2026 🇦🇷 💰\$3.254.000 (todos los puestos y seniority de IT) 📉En los últimos 6 meses subió 13% en pesos, 7% en dólares pero bajó 5% en pesos ajustado por IPC (menos poder adquisitivo) 🙍‍♀️19,9% mujeres 🌈0,5% no binario - hay brecha salarial en los puestos" / X](https://x.com/maxifirtman/status/2029577326652977241?lang=en)
49. [Salancy - Encuesta de Salarios IT en Argentina](https://salarios.gonzalopozzo.com/)
50. [Work data 2026](https://survey.stackoverflow.co/2026/work/data)
51. [LATAM Talent Intelligence Report 2026 — Salary Data](https://www.hireslink.com/resources/latam-talent-intelligence-2026)
52. [LATAM Salary Guide by Role and Seniority \[2026\]](https://www.hireslink.com/blog/latam-salary-guide-role-seniority-2026)
53. [Frontend Engineer Salary in Argentina 2026](https://www.hireslink.com/latam-salaries/frontend-engineer/argentina)
54. [Frontend Developer en LATAM 2026: Salarios \$600-20K USD, React/TypeScript/Next.js, Roadmap Carrera](https://jobstera.com/articles/es/frontend-developer-latam-2025)
