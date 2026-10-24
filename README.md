# Espartinas CF – App de los equipos

App para las familias del Alevín y del Benjamín: partidos, cómo llegar, clasificación, goleadores, valoraciones con estrellas, MVP y fotos.

## Probar
Abre `app/index.html` en el navegador. Claves de prueba: `espartinas-alevin` / `espartinas-benjamin`. Clave de delegado: `delegado-alevin` / `delegado-benjamin` (pestaña «Yo»).

## Poner en marcha
1. **Firebase** (gratis): crea un proyecto, activa Firestore, pega `firestore.rules` en Reglas y copia la configuración de la app web en `CONFIG.firebase` de `app/index.html`.
2. **Publicar la app**: GitHub Pages desde la carpeta `app/`, o arrastra `app/index.html` a app.netlify.com/drop.
3. **Robot de la liga**: en GitHub → Settings → Secrets and variables → Actions crea `FIREBASE_PROJECT_ID` y `FIREBASE_API_KEY`. Luego Actions → «Actualizar clasificación» → Run workflow.

Las instrucciones técnicas para Codex están en `AGENTS.md`.
