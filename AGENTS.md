# AGENTS.md

Proyecto de aprendizaje: app de escritorio con **Electron** + **Electron Forge**. Sin bundler, sin TypeScript, sin framework de UI. JavaScript plano en **CommonJS** (`"type": "commonjs"`, entrypoint `main.js`).

## Comandos

- `npm start` — ejecuta la app en dev (Forge). Es la única forma de probar: no hay dev server ni build previo.
- `npm run package` / `npm run make` — empaqueta / genera instaladores en `out/`.
- `npm run publish` — publica en GitHub Releases. Requiere `GITHUB_TOKEN` y genera *drafts* (config en `forge.config.js`).
- No hay lint, typecheck ni tests. `npm test` es un stub que falla (`exit 1`); no lo uses como verificación.

## Arquitectura

- `main.js` — proceso principal: crea `BrowserWindow`, registra canales IPC (`ipcMain.handle('ping')`), llamadas a `updateElectronApp()` para auto-updates.
- `preload.js` — puente seguro con `contextBridge` + `ipcRenderer`. Única vía para que el renderer hable con main.
- `renderer.js` + `index.html` — UI. CSP estricta (`script-src 'self'`): nada de scripts inline ni CDN.
- **Flujo para nuevo canal IPC**: 1) `ipcMain.handle` en `main.js`, 2) función con `ipcRenderer.invoke` en `preload.js`, 3) consumir desde `renderer.js`. Renderer nunca accede a Node directamente.

## Gotchas

- `out/` es generado por Forge y está en `.gitignore`; no editar ni versionar.
- Seguridad por defecto: `nodeIntegration` desactivado, `contextIsolation` activado. No los cambies; sigue el patrón de preload.
- `forge.config.js`: `asar: true` + fuses (runAsNode y node CLI flags desactivados) — el main no puede ejecutarse fuera del asar empaquetado.
- Makers: Squirrel (Windows), zip (macOS), deb/rpm (Linux). `electron-squirrel-startup` debe seguir en `dependencies` para el instalador de Windows.
- `main.js:33-37` — en macOS la app no cierra al cerrar la última ventana (convención de plataforma).
- Publicar requiere token en `process.env.GITHUB_TOKEN`; nunca hardcodear credenciales (los campos de certificado de firma están comentados en `forge.config.js`).

## Convenciones del repo

- Código e identificadores en inglés; documentación (README, commits, comentarios) en español.
- README.md es la fuente de la guía de arquitectura (incluye plan futuro con SQLite y estructura `src/main|preload|renderer|shared|db`) — respétalo si se añaden capas.
