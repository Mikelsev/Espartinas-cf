# Espartinas CF – App de los equipos

App para las familias del Alevín y del Benjamín: partidos, cómo llegar, clasificación, goleadores, valoraciones con estrellas, MVP y fotos.

## Probar
Abre `app/index.html` en el navegador. Las claves de los equipos están en el bloque `CONFIG` de `app/index.html`. Clave de delegado: `delegado-alevin` / `delegado-benjamin` (pestaña «Yo»).

## Poner en marcha
1. **Firebase** (gratis): crea un proyecto, activa Firestore, pega `firestore.rules` en Reglas y copia la configuración de la app web en `CONFIG.firebase` de `app/index.html`.
2. **Publicar la app** (gratis, con GitHub Pages): en GitHub → Settings → Pages, en «Source» elige **GitHub Actions**. Luego Actions → «Publicar la app» → Run workflow. La app queda en `https://mikelsev.github.io/Espartinas-cf/` y se vuelve a publicar sola cada vez que cambia algo en `app/`.
   - Ojo: el repositorio es público, así que las claves del bloque `CONFIG` se pueden leer. Cámbialas antes de repartirlas a las familias.
3. **Robot de la liga**: en GitHub → Settings → Secrets and variables → Actions crea `FIREBASE_PROJECT_ID` y `FIREBASE_API_KEY`. Luego Actions → «Actualizar clasificación» → Run workflow. El robot trae la clasificación, el calendario y los resultados de los dos equipos; el delegado solo tiene que añadir la hora de llegada, la equipación, la dirección de casa y los goles de cada niño.

Para probar el robot: `cd robot && npm install && npm test`.

Las instrucciones técnicas para Codex están en `AGENTS.md`.

## Simulador de campañas publicitarias (`simulador/`)
Herramienta aparte, inspirada en MiroFish, para probar un anuncio con una población sintética antes de lanzarlo. Se publica en `https://mikelsev.github.io/Espartinas-cf/simulador/`.

1. **Campaña**: escribe hasta 3 versiones del anuncio (texto e imagen) y qué quieres averiguar.
2. **Población**: elige grupos de edad y un perfil (municipio, renta, hijos, ocupación o sexo). Se crean personas ficticias con datos aproximados del INE y se reparten al azar en grupo de control y una versión cada una.
3. **Simulación**: cada persona ve el anuncio en su feed y reacciona; en las rondas siguientes lee lo que comentan sus contactos.
4. **Informe**: efecto frente al control por segmento, con intervalos de confianza y corrección por comparaciones múltiples, mapa de calor y un informe redactado por la IA.
5. **Entrevistas**: pregunta a cualquier persona simulada o al redactor.

Sin clave funciona en **modo prueba** (modelo estadístico sencillo, solo para conocer la herramienta). Para usar agentes de IA, pega una clave de la API de Anthropic en ⚙️ Ajustes; ponle un límite de gasto. Los resultados sirven para **comparar** versiones y segmentos, no para predecir ventas: calíbralo con campañas pasadas.
