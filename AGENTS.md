# Espartinas CF – App de los equipos (instrucciones para el agente)

Responde y escribe la interfaz siempre en **español de España**. El usuario es un padre, no programador: explica los pasos manuales de forma sencilla.

## Qué es
Web app (móvil primero) para dos equipos de fútbol base del **Espartinas CF** (Espartinas, Sevilla):
- **Alevín** (2º año, Liga Educa / Education Football League) – juega Markel.
- **Benjamín** (1º año) – juega Martin.

Colores del club: azul (#1450B4), marino (#0A2A63). Primera equipación azul a rayas blancas; segunda roja (#D62839). Escudo oficial en `app/escudo-original.jpg` (ya incrustado en base64 en `app/index.html`).

## Requisitos funcionales (todos implementados en `app/index.html`)
1. Acceso con **clave del equipo** (una por equipo). Clave aparte de **delegado** para editar.
2. **Calendario** de partidos: fecha, hora, hora de llegada, rival, casa/fuera, campo, dirección, equipación.
3. Botón **Cómo llegar** → `https://www.google.com/maps/dir/?api=1&destination=<dirección>`.
4. **Clasificación de la liga**.
5. El delegado mete la **convocatoria** de cada partido y el **resultado**; cada gol se asigna con un desplegable entre los convocados → **ranking de goleadores** automático.
6. **Votaciones**: en cada partido jugado, cada **convocado** vota a **todos** sus compañeros **convocados** (no a sí mismo; si el partido no tiene convocatoria, toda la plantilla) con **3, 4 o 5 estrellas**, y pulsa «Enviar votación» (después no se puede cambiar). Los que descansan no votan ni reciben votos. Los votos son **secretos**: solo se ven sumas. El ranking del partido se ve al terminar de votar (el delegado siempre); el **MVP** es quien más puntos saca. Pestaña **Ranking** con el total acumulado y goleadores. Aviso si te faltan partidos por votar.
7. Cada niño **entra con su nombre y PIN**: la primera vez usa `0000` y elige su PIN de 4 cifras. El delegado puede reiniciarlo a `0000`.
8. Cada niño puede **subir su foto** (se recorta a 320×320 JPEG y se guarda en base64 en Firestore; no se usa Firebase Storage porque exige plan de pago).
9. Alojamiento **gratuito**.
10. **Cómo llegar** en cada partido (enlace de Maps que publica la liga → `mapa`; si no, dirección o campo; en casa `CONFIG.mapaCasa`, el enlace de Maps del campo del Espartinas).
11. **La previa** de cada partido sin jugar: frase para los niños según la clasificación del rival + frase de ánimo (función `previa()`).

## Arquitectura
- `app/index.html`: un único archivo HTML + CSS + JS sin build. Bloque `CONFIG` al principio del script (club, `firebase`, equipos con `clave`, `claveDelegado`, `ligaUrl`).
  - `CONFIG.firebase = null` → modo prueba con `localStorage` (clase `LocalStore`).
  - Con config de Firebase → Firestore en tiempo real (clase `FireStore`, SDK compat 10.12.2 desde jsDelivr).
  - Ambas clases exponen `watch(col, cb)`, `set(col, id, obj)` (reemplaza el documento), `del(col, id)`, `stop()`.
- `robot/robot.mjs`: Playwright (Node 20) abre la web de la Liga Educa (HTML servido por el servidor, sin API JSON), lee la clasificación y las páginas de cada jornada (`&num_day=N`, sacadas del desplegable) y escribe en Firestore vía REST (las reglas permiten escritura sin auth). Guarda copia en `robot/copia/` para depurar.
- `robot/liga.mjs`: la lógica sin navegador (`interpretar`, `partidosDeTablas`, `planPartidos`). Tests en `robot/test/` (`npm test`) con una copia real guardada en `robot/test/ejemplos/`.
  - Clasificación de la Liga Educa: cabecera `Pt Equipo P J G E P Dif` (la 1ª P = puntos, la 2ª = perdidos); no da GF/GC, solo diferencia.
  - Partidos: tablas «… Jornada: N (dd/mm/aaaa)» con filas `estado, campo, local, marcador «a - b», visitante` y «Próxima jornada» con `V-30, 18:00, «Local - Visitante»`.
- `.github/workflows/actualizar.yml`: ejecuta el robot a diario y fines de semana por la tarde.
- `firestore.rules`: reglas actuales (abiertas bajo `equipos/`).

## Modelo de datos (Firestore)
Ruta base: `equipos/{equipoId}` con `equipoId` = `alevin` | `benjamin`.
- `jugadores/{id}`: `{ nombre, dorsal, foto? (dataURL), pin? ("" o ausente = 0000 sin estrenar) }`
- `partidos/{id}`: `{ jornada (texto), fecha "YYYY-MM-DD", hora "HH:MM", citacion "HH:MM", rival, local: bool, campo, direccion, equipacion "azul"|"roja", notas, gf, gc ("" si no jugado), goles: { [jugadorId]: n }, convocados: [jugadorId], mapa? (url de Maps de la liga) }`
- `votos/{partidoId}_{votanteId}`: `{ partido, votante, notas: { [jugadorId]: 3|4|5 }, enviado: ms }`. Solo se escribe al pulsar «Enviar votación» (con todos los compañeros votados) y después no se puede cambiar; antes es un borrador en `localStorage` (`ecf-borrador-{equipo}-{jugador}-{partido}`).
- `liga/tabla`: `{ filas: [{ equipo, pos?, pj?, pg, pe, pp, gf?, gc?, dif?, pts? }], actualizado: ms, fuente?: url }` (si vienen `pj`/`pts`/`dif` la app los usa; si no, los calcula; si viene `pos` ordena por ella).
- Partidos del robot: id `liga-j{jornada}`, o el del delegado si ya había uno con esa jornada. Solo escribe `jornada, fecha, rival, local`, y `hora`/`campo`/`mapa`/`gf`/`gc` cuando la web los trae (`updateMask`). Nunca toca `goles, convocados, citacion, equipacion, notas, direccion`.
- El robot marca los enlaces a mapas de cada celda como `[[MAPA:url]]` y guarda el HTML de nuestras filas en `robot/copia/{equipo}-filas.html` (para comprobar cómo publica la liga la ubicación).

## Tareas pendientes (por orden)
1. ✅ **Validar el robot contra la web real** (hecho con las copias del 24/10/2026 de Benjamín y Alevín; los partidos sin jugar traen «Vie 30\n18:00» en la primera celda y «-» como marcador; si descansamos no hay fila). No se pudo acceder a educationleague.es al crearlo, así que la extracción es heurística (busca `<table>` con cabeceras tipo Equipo/PJ/G/E/P/GF/GC/Pts). Descarga la página real, revisa su estructura (puede cargar datos por JS o por una petición XHR/JSON: si existe un endpoint JSON, úsalo en lugar de leer el HTML) y ajusta `interpretar()`. Añade un test con un HTML guardado.
   - URL Benjamín: `https://www.educationleague.es/?id_lan=1&id_geo=8&id_spo=1&id_com_gro0=439&sea=2026&id_rac=1&id_age=75&id_com_gro1=465&id_com_sea=1831&id_com_sta=2254&id_sec=335`
   - URL Alevín: `https://www.educationleague.es/?id_lan=1&id_geo=8&id_spo=1&id_com_gro0=439&sea=2026&id_rac=1&id_age=77&id_com_gro1=466&id_com_sea=1832&id_com_sta=2271&id_sec=335`
2. ✅ **Calendario y resultados automáticos** desde la misma web: crear/actualizar `partidos` del Espartinas CF con ids deterministas (p. ej. `liga-j{jornada}`) actualizando solo los campos oficiales (`fecha`, `hora`, `rival`, `local`, `campo`, `direccion`, `gf`, `gc`, `jornada`) mediante `updateMask`, para **no pisar** lo que mete el delegado (`goles`, `citacion`, `equipacion`, `notas`).
3. ✅ (workflow `publicar.yml`; falta activar Pages en Settings) **Publicar la app gratis** con GitHub Pages desde la carpeta `app/` del mismo repositorio (o Netlify) y documentarlo.
4. Opcional: mejorar la seguridad (las claves están en el código; Firestore abierto). Algo sencillo y gratuito, sin obligar a las familias a crear cuentas.
5. Opcional: convertir en PWA (manifest + service worker) para instalar en el móvil.

## Reglas para cambios
- Mantener `app/index.html` como archivo único sin paso de compilación.
- No romper el modo prueba con `localStorage`.
- Estrellas solo 3–5. Textos de la interfaz en español, tono cercano.
- Accesible y responsive; modo claro y oscuro (variables CSS en `:root`).
- Antes de terminar: `node --check robot/robot.mjs` y abrir `app/index.html` en un navegador para comprobar que carga.
