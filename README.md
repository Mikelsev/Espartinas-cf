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
