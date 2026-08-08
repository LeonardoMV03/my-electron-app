# AGENTS.md

Proyecto de aprendizaje: app de escritorio con **Electron** + **Electron Forge**. Sin bundler, sin TypeScript, sin framework de UI. JavaScript plano en **CommonJS** (`"type": "commonjs"`, entrypoint `src/main/index.js`).

## Comandos

- `npm start` — ejecuta la app en dev (Forge). Es la única forma de probar: no hay dev server ni build previo.
- `npm run package` / `npm run make` — empaqueta / genera instaladores en `out/`.
- `npm run publish` — publica en GitHub Releases. Requiere `GITHUB_TOKEN` y genera *drafts* (config en `forge.config.js`).
- No hay lint, typecheck ni tests. `npm test` es un stub que falla (`exit 1`); no lo uses como verificación.

## Arquitectura

- `src/main/index.js` — proceso principal: crea `BrowserWindow`, registra canales IPC (`registerIpcHandlers`), menú (`Menu`), tray, llamadas a `updateElectronApp()` para auto-updates.
- `src/preload/index.js` — puente seguro con `contextBridge` + `ipcRenderer`. Única vía para que el renderer hable con main. Expone `window.versions` y `window.api`.
- `src/renderer/` — UI (`index.html` + `renderer.js`). CSP estricta (`script-src 'self'`): nada de scripts inline ni CDN.
- `src/db/database.js` — acceso a SQLite (`better-sqlite3`), solo desde el proceso principal. DB en `app.getPath('userData')`.
- `src/shared/ipc.js` — constantes de canales IPC. Única fuente de verdad: main y preload las importan para evitar typos.
- **Flujo para nuevo canal IPC**: 1) constante en `src/shared/ipc.js`, 2) `ipcMain.handle` en `src/main/index.js`, 3) función con `ipcRenderer.invoke` en `src/preload/index.js`, 4) consumir desde `src/renderer/renderer.js`. Renderer nunca accede a Node directamente.

## Gotchas

- `out/` es generado por Forge y está en `.gitignore`; no editar ni versionar.
- Seguridad por defecto: `nodeIntegration` desactivado, `contextIsolation` activado. No los cambies; sigue el patrón de preload.
- `forge.config.js`: `asar: true` + fuses (runAsNode y node CLI flags desactivados) — el main no puede ejecutarse fuera del asar empaquetado.
- Makers: Squirrel (Windows), zip (macOS), deb/rpm (Linux). `electron-squirrel-startup` debe seguir en `dependencies` para el instalador de Windows.
- `src/main/index.js` — en macOS la app no cierra al cerrar la última ventana (convención de plataforma).
- Publicar requiere token en `process.env.GITHUB_TOKEN`; nunca hardcodear credenciales (los campos de certificado de firma están comentados en `forge.config.js`).
- `better-sqlite3` es un módulo nativo: Forge lo recompila automáticamente al empaquetar; no lo pruebes fuera de Electron salvo para comprobaciones de SQL.
- `.vscode/launch.json` — debug "Main + renderer" (compuesto): ejecuta Electron con `--remote-debugging-port=9222`.

## Convenciones del repo

- Código e identificadores en inglés; documentación (README, commits, comentarios) en español.
- README.md es la fuente de la guía de arquitectura (estructura `src/main|preload|renderer|shared|db` y plan con SQLite) — respétalo si se añaden capas.
- Los handlers IPC registrados dentro de `app.whenReady()` (o `registerIpcHandlers`) — nunca dentro del callback `activate`, que se ejecuta varias veces en macOS.
