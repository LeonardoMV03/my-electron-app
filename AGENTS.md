# AGENTS.md

Proyecto de aprendizaje: app de escritorio con **Electron** + **Electron Forge**. Sin bundler, sin TypeScript, sin framework de UI. JavaScript plano en **CommonJS** (`"type": "commonjs"`, entrypoint `src/main/index.js`).

## Comandos

- `npm start` — ejecuta la app en dev (Forge). Es la única forma de probar: no hay dev server ni build previo.
- `npm run package` / `npm run make` — empaqueta / genera instaladores en `out/`.
- `npm run publish` — publica en GitHub Releases. Requiere `GITHUB_TOKEN` y **publica el release directamente** (`draft: false` en `forge.config.js`); un bump de `version` en `package.json` es obligatorio para que las apps instaladas detecten el update.
- No hay lint, typecheck ni tests. `npm test` es un stub que falla (`exit 1`); no lo uses como verificación.

## Arquitectura

- `src/main/index.js` — proceso principal: crea `BrowserWindow`, registra canales IPC (`registerIpcHandlers`), menú (`Menu`), tray, llamadas a `updateElectronApp()` para auto-updates (solo si `app.isPackaged`).
- `src/preload/index.js` — puente seguro con `contextBridge` + `ipcRenderer`. Única vía para que el renderer hable con main. Expone `window.versions` y `window.api`.
- `src/renderer/` — UI (`index.html` + `renderer.js`). CSP estricta (`script-src 'self'`): nada de scripts inline ni CDN.
- `src/db/database.js` — acceso a SQLite con `node:sqlite` (integrado en Node 24, sin módulos nativos), solo desde el proceso principal. DB en `app.getPath('userData')`.
- `src/shared/ipc.js` — constantes de canales IPC. Única fuente de verdad: main y preload las importan para evitar typos.
- **Flujo para nuevo canal IPC**: 1) constante en `src/shared/ipc.js`, 2) `ipcMain.handle` en `src/main/index.js`, 3) función con `ipcRenderer.invoke` en `src/preload/index.js`, 4) consumir desde `src/renderer/renderer.js`. Renderer nunca accede a Node directamente.

## Gotchas

- `out/` es generado por Forge y está en `.gitignore`; no editar ni versionar.
- Seguridad por defecto: `nodeIntegration` desactivado, `contextIsolation` activado, pero **`sandbox: false`** en `src/main/index.js` — necesario porque el preload importa `src/shared/ipc` con `require` local (los preloads sandboxed solo permiten un subconjunto de builtins de Node y fallan silenciosamente con requires relativos). No quites esa línea sin eliminar antes el `require` del preload.
- `forge.config.js`: `asar: true` + fuses (runAsNode y node CLI flags desactivados) — el main no puede ejecutarse fuera del asar empaquetado.
- Makers: Squirrel (Windows), zip (macOS), deb/rpm (Linux). `electron-squirrel-startup` debe seguir en `dependencies` para el instalador de Windows.
- `src/main/index.js` — en macOS la app no cierra al cerrar la última ventana (convención de plataforma).
- Publicar requiere token en `process.env.GITHUB_TOKEN`; nunca hardcodear credenciales (los campos de certificado de firma están comentados en `forge.config.js`).
- `better-sqlite3` no tiene prebuilt para Electron 43 y requiere VS Build Tools para compilar; por eso el repo usa `node:sqlite` (integrado en Node, sin rebuild). No vuelvas a introducir módulos nativos sin verificar que exista prebuilt para la versión de Electron.
- `.vscode/launch.json` — debug "Main + renderer" (compuesto): ejecuta Electron con `--remote-debugging-port=9222`.

## Convenciones del repo

- Código e identificadores en inglés; documentación (README, commits, comentarios) en español.
- README.md es la fuente de la guía de arquitectura (estructura `src/main|preload|renderer|shared|db` y plan con SQLite) — respétalo si se añaden capas.
- Los handlers IPC registrados dentro de `app.whenReady()` (o `registerIpcHandlers`) — nunca dentro del callback `activate`, que se ejecuta varias veces en macOS.
