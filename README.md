# my-electron-app — Guía práctica de Electron + Electron Forge

Aplicación de escritorio de aprendizaje construida con **Electron** y **Electron Forge**, en JavaScript plano (CommonJS), sin bundler, sin TypeScript y sin framework de UI. Este README explica **cómo se desarrollan aplicaciones de escritorio con estas tecnologías**, **por qué existe cada archivo y carpeta** y **cómo se comunican todas las partes** entre sí.

> Documentación en español, código e identificadores en inglés (convención del repo).

---

## Índice

1. [¿Qué es Electron?](#1-qué-es-electron)
2. [Arquitectura: los procesos que componen la app](#2-arquitectura-los-procesos-que-componen-la-app)
3. [Estructura del proyecto, archivo por archivo](#3-estructura-del-proyecto-archivo-por-archivo)
4. [IPC en detalle: cada canal, de principio a fin](#4-ipc-en-detalle-cada-canal-de-principio-a-fin)
5. [Persistencia local con SQLite](#5-persistencia-local-con-sqlite)
6. [Navegación entre vistas (hash routing)](#6-navegación-entre-vistas-hash-routing)
7. [Empaquetado, instaladores y publicación](#7-empaquetado-instaladores-y-publicación)
8. [Seguridad: cómo se protege una app de Electron](#8-seguridad-cómo-se-protege-una-app-de-electron)
9. [Receta: añadir una funcionalidad nueva](#9-receta-añadir-una-funcionalidad-nueva)
10. [Crear el proyecto desde cero](#10-crear-el-proyecto-desde-cero)
11. [Referencia rápida de comandos](#11-referencia-rápida-de-comandos)

---

## 1. ¿Qué es Electron?

**Electron** es un framework que permite construir aplicaciones de escritorio (Windows, macOS, Linux) usando tecnologías web: **HTML, CSS y JavaScript**. Lo que hace internamente es empaquetar dos motores en un solo binario:

- **Chromium** — el motor del navegador Chrome, que renderiza la interfaz (tu HTML/CSS/JS).
- **Node.js** — el runtime de JavaScript, que da acceso al sistema operativo (archivos, red, procesos, SQLite…).

Es el mismo stack que usan Visual Studio Code, Slack, Discord o WhatsApp Desktop.

**Electron Forge** es el *toolchain* oficial de Electron: se encarga del scaffolding inicial, de arrancar la app en desarrollo (`start`), de empaquetarla (`package`), de generar instaladores para cada sistema operativo (`make`) y de publicarla (`publish`). Sin Forge tendrías que configurar todo eso a mano.

**¿Por qué este repo no usa bundler ni framework de UI?** Para aprender los conceptos puros: proceso principal, renderer, preload, IPC y empaquetado. Todo es JavaScript plano en CommonJS (`"type": "commonjs"`), igual que Node clásico.

---

## 2. Arquitectura: los procesos que componen la app

Una app de Electron siempre tiene **dos tipos de procesos**, y entre ellos actúa un tercer archivo, el *preload*:

| Parte | Qué es | Qué puede hacer | Dónde vive |
|---|---|---|---|
| **Proceso principal** (`main`) | Un proceso de Node.js completo | Todo: ventanas, menús, tray, diálogos, notificaciones, archivos, base de datos, red | `src/main/index.js` |
| **Proceso de renderizado** (`renderer`) | Una página web en Chromium | Solo web: DOM, eventos, CSS. **Sin acceso directo a Node** | `src/renderer/` |
| **Preload** | Script que se ejecuta antes que la página en el renderer | Ejecuta `ipcRenderer` (comunicación) y **expone una API segura** al renderer con `contextBridge` | `src/preload/index.js` |

### El patrón de comunicación (lo más importante de Electron)

```
┌─────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│     RENDERER        │      │       PRELOAD        │      │        MAIN          │
│  (página web, UI)   │      │   (puente seguro)    │      │ (Node: ventanas, DB) │
│                     │      │                      │      │                      │
│  window.api.notes   │─────▶│  ipcRenderer.invoke( │─────▶│  ipcMain.handle(     │
│  .list()            │      │    NOTES_LIST)       │      │    NOTES_LIST, fn)   │
│                     │      │                      │      │                      │
│  const notes = ...  │◀─────│      (promesa)       │◀─────│  return notes.list() │
└─────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

Reglas de oro que sigue este proyecto:

1. **El renderer nunca toca Node directamente.** No puede, porque `nodeIntegration` está desactivado. Solo puede llamar a lo que el preload exponga como `window.api`.
2. **El estado importante vive en el proceso principal.** Ejemplo: el contador de la app. El renderer pide el valor (`count:get`), lo incrementa (`count:inc`) y vuelve a pedir el valor. El número en sí nunca se guarda en la página.
3. **Las operaciones privilegiadas solo las hace main.** Abrir diálogos nativos, mostrar notificaciones, leer/escribir la base de datos… El renderer envía un *mensaje* por IPC y main ejecuta la operación con privilegios de Node.
4. **Los nombres de canal son una única fuente de verdad** en `src/shared/ipc.js`, importada por main y preload, para evitar typos que rompen la comunicación silenciosamente.

---

## 3. Estructura del proyecto, archivo por archivo

```
my-electron-app/
├── package.json          # Manifiesto del proyecto: scripts, dependencias, entrypoint
├── forge.config.js       # Configuración de Electron Forge (empaquetado y publicación)
├── assets/               # Iconos de la app y del tray
├── src/                  # Todo el código fuente
│   ├── main/index.js     # Proceso principal
│   ├── preload/index.js  # Puente seguro renderer ↔ main
│   ├── renderer/         # UI con dos vistas: index.html + renderer.js (hash routing)
│   ├── shared/ipc.js     # Constantes de los canales IPC
│   └── db/               # Capa de datos (SQLite)
│       ├── database.js   # Apertura de la base y operaciones CRUD
│       └── migrations.js # Migraciones de esquema versionadas
├── out/                  # Generado por Forge (NO se edita ni se versiona)
├── .vscode/launch.json   # Configuración de depuración en VS Code
├── AGENTS.md             # Notas de arquitectura para asistentes de código
└── .gitignore            # Ignora node_modules/, out/, etc.
```

### 3.1 `package.json` — el manifiesto

```json
{
  "name": "my-electron-app",
  "version": "1.0.0",
  "main": "src/main/index.js",
  "type": "commonjs",
  "scripts": {
    "start": "electron-forge start",
    "test": "echo \"Error: no test specified\" && exit 1",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "publish": "electron-forge publish"
  }
}
```

- **`"main"`** — indica a Electron cuál es el archivo del proceso principal. Es obligatorio: Electron arranca ejecutando ese archivo.
- **`"type": "commonjs"`** — JavaScript clásico de Node con `require()` / `module.exports`. No hay bundler que transforme los módulos, así que todo debe ser CommonJS.
- **`"scripts"`** — los 4 comandos de Forge. `test` es un stub que falla a propósito (no hay tests en este proyecto).
- **`devDependencies`** vs **`dependencies`**:
  - `devDependencies`: herramientas de desarrollo que **no** se incluyen en la app final (`@electron-forge/*`, `electron`, `@electron/fuses`).
  - `dependencies`: librerías que la app necesita **en tiempo de ejecución** y se empaquetan: `electron-squirrel-startup` (requerido por el instalador de Windows Squirrel) y `update-electron-app` (auto-updates).

### 3.2 `forge.config.js` — empaquetado y publicación

```js
module.exports = {
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'LeonardoMV03', name: 'my-electron-app' },
        authToken: process.env.GITHUB_TOKEN,   // nunca hardcodear credenciales
        prerelease: false,
        draft: false,                          // publica el release directamente
      }
    }
  ],
  packagerConfig: {
    asar: true,          // empaqueta el código fuente en un archivo .asar
    icon: './assets/icon',
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { setupIcon: './assets/icon.ico' } },  // Windows
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },                            // macOS
    { name: '@electron-forge/maker-deb', config: {} },                                       // Linux (Debian)
    { name: '@electron-forge/maker-rpm', config: {} },                                       // Linux (RedHat)
  ],
  plugins: [
    new FusesPlugin({ ... })  // endurece el binario (ver sección 8)
  ],
};
```

- **`publishers`** — dónde se sube la app compilada (aquí: GitHub Releases). El token se lee del entorno (`process.env.GITHUB_TOKEN`), nunca se escribe en el archivo.
- **`packagerConfig`** — opciones del empaquetado: `asar: true` mete todo el código en un solo archivo `app.asar` (ofusca el código fuente y acelera la carga), e `icon` define el ícono del ejecutable.
- **`makers`** — los *makers* generan los instaladores por plataforma: Squirrel (Windows), zip (macOS), deb/rpm (Linux).
- **`plugins`** — aquí solo está el plugin de *fuses* (opciones de endurecimiento del binario, sección 8).

### 3.3 `assets/` — iconos

- `icon.ico` / `icon.png` — ícono de la aplicación (usado en el empaquetado y los instaladores).
- `tray-icon.png` — ícono del *system tray* (bandeja del sistema).

### 3.4 `src/main/index.js` — el proceso principal (el corazón)

Es el archivo que `package.json` declara como `main`. Todo arranca aquí. Sus responsabilidades:

1. **Crear la ventana** (`createWindow`):

```js
const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'index.js'),
        sandbox: false
    }
});
window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
```

   La ventana no es un div de una página web: es una **pestaña de Chromium real** con su propio proceso. `webPreferences.preload` le inyecta el preload, y `loadFile` carga la UI desde `index.html`.

2. **Registrar los handlers de IPC** (`registerIpcHandlers`): cada `ipcMain.handle(canal, función)` es la "cara de servidor" de un canal. Cuando el renderer hace `ipcRenderer.invoke(canal)`, esta función se ejecuta en el proceso principal y su valor de retorno viaja de vuelta.

3. **Menú nativo** (`createMenu`): con `Menu.buildFromTemplate` se define el menú de la aplicación (Archivo → Nueva ventana, Ver → Recargar/DevTools/zoom, Ayuda → Acerca de). Es un menú del sistema operativo, no HTML.

4. **System tray** (`createTray`): el ícono en la bandeja del sistema con su menú contextual (Mostrar/Ocultar ventana, Salir). La referencia al tray se guarda en una variable del módulo para que el **garbage collector no la destruya**.

5. **Ciclo de vida de la app**:

```js
app.whenReady().then(() => { ... });   // prepara todo cuando Electron termina de arrancar
app.on('activate', () => { ... });     // macOS: recrear ventana al activar la app
app.on('window-all-closed', () => {    // Windows/Linux: cerrar app al cerrar la última ventana
    if (process.platform !== 'darwin') app.quit();
});
```

   Nota: en macOS la convención es que la app siga viva aunque no haya ventanas; en Windows/Linux, cerrar la última ventana cierra la app. Por eso `window-all-closed` comprueba la plataforma.

6. **Auto-updates**: `updateElectronApp()` solo se ejecuta si `app.isPackaged` (es decir, solo en la app instalada, no en desarrollo).

### 3.5 `src/preload/index.js` — el puente seguro

```js
const { contextBridge, ipcRenderer } = require('electron');
const { PING, NOTES_LIST, ... } = require('../shared/ipc');

contextBridge.exposeInMainWorld('versions', { node: () => ..., chrome: () => ..., electron: () => ... });

contextBridge.exposeInMainWorld('api', {
    count: { get: () => ipcRenderer.invoke(COUNT_GET), inc: () => ipcRenderer.invoke(COUNT_INC) },
    dialog: { openFile: () => ipcRenderer.invoke(DIALOG_OPEN_FILE) },
    notify: (title, body) => ipcRenderer.invoke(NOTIFY_SEND, { title, body }),
    notes: {
        list: () => ipcRenderer.invoke(NOTES_LIST),
        create: (note) => ipcRenderer.invoke(NOTES_CREATE, note),
        delete: (id) => ipcRenderer.invoke(NOTES_DELETE, id)
    }
});
```

- `contextBridge.exposeInMainWorld` **expone** funciones al renderer como `window.versions` y `window.api`. El renderer solo puede usar exactamente esto, nada más del mundo Node/Electron.
- Cada función expuesta envuelve exactamente un `ipcRenderer.invoke(canal, datos)`. `invoke` devuelve una **promesa** que se resuelve con el valor que devuelva `ipcMain.handle`.

### 3.6 `src/shared/ipc.js` — los nombres de canal, en un solo sitio

```js
module.exports = {
    PING: 'ping',
    COUNT_GET: 'count:get',
    COUNT_INC: 'count:inc',
    DIALOG_OPEN_FILE: 'dialog:open-file',
    NOTIFY_SEND: 'notify:send',
    NOTES_LIST: 'notes:list',
    NOTES_CREATE: 'notes:create',
    NOTES_DELETE: 'notes:delete'
};
```

Este archivo es la **única fuente de verdad** de los nombres de canal. Si main y preload usaran strings sueltos, un typo (`'notes:lis'`) fallaría en silencio o con errores confusos. Importándolo desde ambos lados, el nombre solo puede estar bien.

### 3.7 `src/renderer/` — la interfaz (una página web de verdad)

- **`index.html`** — la UI, organizada en **dos vistas**: `#view-main` (demos: información, contador, archivo, notificación) y `#view-notes` (el CRUD de notas, oculta con `hidden` al inicio). Incluye una **CSP estricta** (`default-src 'self'; script-src 'self'`): la página solo puede cargar recursos propios, nada de scripts inline ni CDN. Es una práctica de seguridad (ver sección 8). Todo el JavaScript se carga con `<script src="./renderer.js">`.
- **`renderer.js`** — el "frontend": escucha eventos del DOM (clics, submit) y llama a `window.api.*`. **Nunca importa Node** y nunca hace `require`. También contiene el **router de vistas por hash** (`#notes` / `#home`, ver sección 6). Ejemplo del formulario de notas:

```js
noteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await window.api.notes.create({ title: noteTitle.value, content: noteInput.value });
    renderNotes();
});
```

### 3.8 `src/db/` — la capa de datos

- **`database.js`** — acceso a SQLite usando **`node:sqlite`**, el módulo integrado en Node 24 (sin módulos nativos que recompilar). La base se abre **perezosamente** (la primera vez que se usa) en `app.getPath('userData')`, el directorio de datos de la app del usuario, **nunca en la carpeta del código fuente**:

```js
const getDb = () => {
    if (!db) {
        const dbPath = path.join(app.getPath('userData'), 'app.db');
        db = new DatabaseSync(dbPath);
        db.exec('PRAGMA journal_mode = WAL');
        runMigrations(db);
    }
    return db;
};
```

  La **validación de negocio vive aquí**, en la capa de datos: `createNote` lanza `'La nota debe tener un título'` si el título va vacío. El `required` del HTML es solo comodidad de UX; la verdad la dice esta capa, porque es el único punto por donde pasan todos los caminos de escritura.

- **`migrations.js`** — evoluciona el esquema de forma segura usando `PRAGMA user_version`. Cada paso del array `MIGRATIONS` es una función que recibe la conexión. `runMigrations` aplica **solo los pendientes**, dentro de una transacción (`BEGIN`/`COMMIT`/`ROLLBACK`):

```js
const V1 = (db) => db.exec(`CREATE TABLE IF NOT EXISTS notes (...)`);
const V2 = (db) => db.exec(`ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''`);
const MIGRATIONS = [V1, V2];
```

  Regla de oro: **nunca editar una migración ya aplicada** (los usuarios ya la tienen en su base). Para cambiar el esquema, se agrega una función nueva al final del array. La V2 demuestra evolución con datos existentes: SQLite no permite `ADD COLUMN NOT NULL` sin `DEFAULT` en tablas con filas, por eso `title` nace con `''` y las notas legacy se muestran como "(Sin título)".

### 3.9 `out/`, `.vscode/`, `.gitignore`

- **`out/`** — carpeta generada por Forge (`package`/`make`): ahí aparecen la app empaquetada y los instaladores. Está en `.gitignore`: **nunca se edita ni se versiona**.
- **`.vscode/launch.json`** — dos configuraciones de debug: "Main" (lanza Electron con `--remote-debugging-port=9222`) y "Renderer" (se conecta al puerto 9222 para depurar la UI), combinadas en el compound **"Main + renderer"**. Es la forma de depurar ambos procesos a la vez.
- **`.gitignore`** — ignora `node_modules/`, `out/`, logs, `.env` y ruido de cada SO.

---

## 4. IPC en detalle: cada canal, de principio a fin

Hay 8 canales. El patrón es idéntico en todos: **constante en `shared/ipc.js` → `ipcMain.handle` en main → función en el preload → uso en el renderer**.

| Canal | Renderer (`window.api...`) | Preload | Main (`ipcMain.handle`) | Devuelve |
|---|---|---|---|---|
| `ping` | `versions.ping()` | `invoke(PING)` | `() => 'pong'` | string |
| `count:get` | `api.count.get()` | `invoke(COUNT_GET)` | `() => count` | número |
| `count:inc` | `api.count.inc()` | `invoke(COUNT_INC)` | `() => ++count` | número |
| `dialog:open-file` | `api.dialog.openFile()` | `invoke(DIALOG_OPEN_FILE)` | `dialog.showOpenDialog(...)` | ruta o `null` |
| `notify:send` | `api.notify(title, body)` | `invoke(NOTIFY_SEND, {title, body})` | `new Notification({...}).show()` | `true`/`false` |
| `notes:list` | `api.notes.list()` | `invoke(NOTES_LIST)` | `() => notes.listNotes()` | array de notas |
| `notes:create` | `api.notes.create(note)` | `invoke(NOTES_CREATE, note)` | `(e, note) => notes.createNote(note)` | nota creada |
| `notes:delete` | `api.notes.delete(id)` | `invoke(NOTES_DELETE, id)` | `(e, id) => notes.deleteNote(id)` | nº de filas |

**Ejemplo completo — el contador:**

1. `shared/ipc.js`: `COUNT_GET: 'count:get'`
2. `main/index.js`: `ipcMain.handle(COUNT_GET, () => count)` — el estado `let count = 0` **vive en main**.
3. `preload/index.js`: `count: { get: () => ipcRenderer.invoke(COUNT_GET) }` — expuesto como `window.api.count.get()`.
4. `renderer.js`: `countValue.innerText = await window.api.count.get()`.

Si el estado viviera en el renderer y se recargara la página (Ctrl+R), se perdería. Viviendo en main, sobrevive a los recargados, a varias ventanas y solo el proceso con privilegios lo muta.

**Diálogos nativos:** `dialog.showOpenDialog` solo puede llamarse desde el proceso principal. El renderer manda un "quiero elegir un archivo" y main abre el diálogo del sistema operativo. El renderer ni siquiera sabe cómo se abrió: solo recibe la ruta.

**Notas (CRUD completo):** el renderer envía `{ title, content }` (o un `id`), main delega en `notes.createNote(note)` / `notes.deleteNote(id)` de la capa de datos, y la respuesta (la nota creada o las filas afectadas) vuelve por la promesa del `invoke`.

---

## 5. Persistencia local con SQLite

La app guarda datos en una base SQLite local, siempre **desde el proceso principal** (el renderer jamás toca la base).

- **¿Por qué `node:sqlite` y no `better-sqlite3`?** El proyecto probó `better-sqlite3`, pero no tiene binarios precompilados para Electron 43 y requiere VS Build Tools para compilar desde el código. `node:sqlite` está **integrado en Node 24** (que Electron 43 embarca), así que no hay módulos nativos que recompilar. Este repo no introduce módulos nativos sin antes verificar que existan prebuilt para la versión de Electron.
- **Ubicación:** la base `app.db` vive en `app.getPath('userData')` (p. ej. `%APPDATA%\my-electron-app\` en Windows), porque ahí es donde la app tiene permiso de escritura en todas las plataformas. No se guarda junto al código: el código puede estar en un `.asar` de solo lectura.
- **WAL** (`PRAGMA journal_mode = WAL`): modo de journaling que permite lecturas concurrentes y es más resistente a corrupciones.
- **Migraciones versionadas:** con `PRAGMA user_version` (sección 3.8). Abrir la base por primera vez ejecuta todas las migraciones; abrirla por quinta vez ejecuta solo las que falten. Así los usuarios con bases viejas se actualizan sin perder datos.

---

## 6. Navegación entre vistas (hash routing)

La app tiene **dos vistas dentro de la misma ventana**: la **vista principal** (`#view-main`, con los demos: contador, selector de archivos, notificaciones) y la **vista de notas** (`#view-notes`, con el CRUD de SQLite). Un botón en la vista principal navega a notas, y otro botón vuelve al inicio. Es la misma idea de una app web SPA, aplicada a una ventana de Electron.

### ¿Por qué se hace en el renderer y no con IPC?

Navegar entre vistas es un asunto **puramente de UI**: no abre archivos, no toca la base de datos, no necesita privilegios de Node. Por eso **no usa ningún canal IPC nuevo** — `src/shared/ipc.js`, `src/main/index.js` y el preload quedan intactos. El renderer puede cambiar su propio DOM sin molestar al proceso principal.

La regla de decisión es la del resto del proyecto: **IPC solo cuando el proceso principal debe hacer algo privilegiado** (crear una ventana real, escribir en la DB, abrir un diálogo…). Si la navegación solo muestra u oculta secciones de la misma página, es DOM puro y se resuelve en el renderer.

### Cómo se implementa

La navegación usa el **hash de la URL** (`window.location.hash`), el mismo truco de los SPAs clásicos: cambiar el hash **no recarga la página**, solo dispara el evento `hashchange`. El hash hace las veces de "ruta": `#notes` = vista de notas, cualquier otro valor (o ninguno) = vista principal.

**Paso 1 — HTML: dos secciones, una oculta al inicio** (`src/renderer/index.html`):

```html
<section id="view-main">
  ...demos (contador, archivo, notificación)...
  <button id="go-notes">Ir a la vista de notas</button>
</section>

<section id="view-notes" hidden>
  ...formulario y lista de notas...
  <button id="go-home">Volver al inicio</button>
</section>
```

El atributo `hidden` oculta la vista de notas al cargar. El router decide qué vista se ve según el hash.

**Paso 2 — Router por hash** (`src/renderer/renderer.js`):

```js
const viewMain = document.getElementById('view-main');
const viewNotes = document.getElementById('view-notes');

const showView = (name) => {
    viewMain.hidden = name !== 'main';
    viewNotes.hidden = name !== 'notes';
};

window.addEventListener('hashchange', () => {
    showView(window.location.hash === '#notes' ? 'notes' : 'main');
});

document.getElementById('go-notes').addEventListener('click', () => {
    window.location.hash = '#notes';
});

document.getElementById('go-home').addEventListener('click', () => {
    window.location.hash = '#home';
});

showView(window.location.hash === '#notes' ? 'notes' : 'main');
```

**El flujo completo, paso a paso:**

1. El usuario hace clic en **"Ir a la vista de notas"**.
2. El handler del botón asigna `window.location.hash = '#notes'`. (Nada más: asignar el hash no recarga la página.)
3. El navegador dispara el evento `hashchange`.
4. El listener compara el hash: `'#notes'` → `showView('notes')`.
5. `showView` pone `hidden` en la vista principal y lo quita de la de notas → el usuario ve el CRUD.
6. "Volver al inicio" asigna `'#home'` → `hashchange` → `showView('main')` → se invierte la visibilidad.

La última línea (`showView(...)` al final) es la **inicialización**: al arrancar la app se lee el hash actual y se muestra la vista correspondiente (si alguien arrancara con `#notes` en la URL, abriría directamente en notas). Sin esa línea, la página siempre empezaría en la vista principal aunque el hash dijera lo contrario.

### Lo que NO cambia con la navegación

Las vistas son **secciones de la misma página**, no páginas nuevas, así que todo lo demás sigue funcionando idéntico en ambas:

- **El preload y `window.api` están disponibles en las dos vistas** — el renderer no se recarga, no hay "segundo preload".
- **El estado del contador sigue viviendo en main** — sobrevive a la navegación porque las vistas son DOM, no procesos.
- **Los 8 canales IPC siguen intactos** — el CRUD de notas funciona igual desde la vista de notas (sección 4).
- **La CSP no cambia** — el router es JavaScript propio, cumple `script-src 'self'` (sección 8).

### Alternativas y cuándo usarían cada una

| Enfoque | Qué es | Cuándo usarlo |
|---|---|---|
| **Hash routing (este repo)** | Una página, varias secciones mostradas/ocultadas por hash | Vistas de la misma "pantalla" que comparten estado y contexto. Es la más simple y no toca main. |
| **Dos archivos HTML** (`notes.html` + `loadFile`/`href`) | Recarga completa de la página al navegar | Cuando una vista no necesita el estado de la otra y quieres URLs/archivos separados. Perdería el estado de UI al volver. |
| **Segunda `BrowserWindow`** | Ventana del SO real, creada por main | Ventanas de detalle o documentación independientes de la principal. Requiere **canal IPC nuevo** (main crea la ventana) y el renderer no controla su ciclo de vida. |

---

## 7. Empaquetado, instaladores y publicación

| Comando | Qué hace |
|---|---|
| `npm start` | Arranca la app en desarrollo (Forge lanza Electron con tu código). **Es la única forma de probar**: no hay dev server ni build previo. |
| `npm run package` | Genera la app empaquetada (carpeta `out/my-electron-app-win32-x64/`, por ejemplo): binario + `app.asar` con el código. |
| `npm run make` | Además de empaquetar, genera los instaladores de los makers configurados (Squirrel `.exe` en Windows, zip en macOS, deb/rpm en Linux). |
| `npm run publish` | Sube la app y el instalador a GitHub Releases como release. Requiere `GITHUB_TOKEN` y **publica el release directamente** (`draft: false` en `forge.config.js`). |

Puntos importantes:

- **`asar: true`**: el código fuente va dentro de un archivo `app.asar`. Combinado con el fuse `OnlyLoadAppFromAsar`, la app **solo** se ejecuta desde el asar empaquetado: el `main` no puede ejecutarse suelto. Eso, junto a los fuses que desactivan `RunAsNode` y los CLI flags de Node, impide que alguien manipule el binario para ejecutar código arbitrario.
- **`electron-squirrel-startup`** debe seguir en `dependencies`: el instalador Squirrel de Windows lo necesita en el arranque.
- **Auto-updates:** `update-electron-app` revisa GitHub Releases al arrancar. Para que las apps instaladas detecten una actualización, **es obligatorio un bump de `version` en `package.json`** al publicar (Squirrel compara versiones); un release sin bump se ignora.
- **Publicar requiere `process.env.GITHUB_TOKEN`** — nunca se hardcodea en el código (los campos de certificado de firma están comentados en `forge.config.js` por esa misma razón).

---

## 8. Seguridad: cómo se protege una app de Electron

Este repo aplica las buenas prácticas de seguridad de Electron:

1. **`nodeIntegration: false`** (por defecto) — la página no tiene acceso a `require` ni a los módulos de Node. Un XSS en la página no puede leer archivos ni la base.
2. **`contextIsolation: true`** (por defecto) — el mundo del preload está aislado del mundo de la página. El renderer solo ve lo que `contextBridge` expone explícitamente (`window.versions`, `window.api`), aunque tuviera código malicioso.
3. **Preload mínimo** — el preload no expone `ipcRenderer` crudo: expone **funciones específicas** por canal, de modo que el renderer no puede invocar canales que no están en la API.
4. **CSP estricta** en `index.html` (`default-src 'self'; script-src 'self'`) — nada de scripts inline ni de CDN; los únicos recursos son los propios.
5. **Fuses** en `forge.config.js` — endurecen el binario empaquetado: desactivan ejecutar la app como Node (`RunAsNode`), variables de entorno de opciones de Node, argumentos CLI de inspect, y activan validación de integridad del asar y carga solo desde el asar.

### La excepción: `sandbox: false`

```js
webPreferences: {
    preload: path.join(__dirname, '..', 'preload', 'index.js'),
    sandbox: false
}
```

El sandbox de Chromium en el preload solo permite un subconjunto de builtins de Node, y **falla silenciosamente** con `require` de archivos locales. Como el preload hace `require('../shared/ipc')`, este proyecto desactiva el sandbox. **No se debe quitar** esa línea sin eliminar antes ese `require` (p. ej. pasando los nombres de canal por una constante compartida de otra forma), porque rompería toda la comunicación en la app empaquetada.

---

## 9. Receta: añadir una funcionalidad nueva

Cualquier feature nueva (listar productos, guardar ajustes, abrir un diálogo…) sigue **siempre** el mismo flujo de 4 pasos:

1. **`src/shared/ipc.js`** — agregar la constante: `PRODUCTS_LIST: 'products:list'`.
2. **`src/main/index.js`** — registrar el handler dentro de `registerIpcHandlers` (nunca dentro del callback `activate`, que se ejecuta varias veces en macOS):

   ```js
   ipcMain.handle(PRODUCTS_LIST, () => products.listProducts());
   ```

3. **`src/preload/index.js`** — exponer la función segura:

   ```js
   products: { list: () => ipcRenderer.invoke(PRODUCTS_LIST) }
   ```

4. **`src/renderer/renderer.js`** — consumirla: `const items = await window.api.products.list();`

   La **excepción** que confirma la regla es la navegación entre vistas (sección 6): como solo muestra/oculta secciones de la misma página, no es una operación privilegiada y **no necesita canal IPC**. El canal solo se agrega cuando main debe ejecutar algo (persistir, abrir ventana/diálogo, sistema…).

Si la feature toca la base de datos: agregar la función CRUD en `src/db/database.js` y, si cambia el esquema, una migración nueva al final de `MIGRATIONS` en `migrations.js` (nunca editar las aplicadas). El renderer solo llama a `window.api.*`; todo el acceso a la DB ocurre en el proceso principal.

---

## 10. Crear el proyecto desde cero

Resumen de cómo se llegó a este estado, para replicarlo en un proyecto nuevo:

```bash
# 1. Proyecto npm e instalación de Electron
npm init -y
npm install --save-dev electron

# 2. Integrar Electron Forge (convierte el proyecto a un proyecto Forge)
npx electron-forge import

# 3. Verificar que arranca
npm start
```

Con `electron-forge import` se genera `forge.config.js`, se instalan los makers por plataforma y se agregan los scripts `start`/`package`/`make`/`publish` a `package.json`. Luego el proceso es:

1. **Escribir `src/main/index.js`** con `app.whenReady()` → `createWindow()`, y los `ipcMain.handle` de tus canales.
2. **Escribir `src/preload/index.js`** con `contextBridge.exposeInMainWorld` (aquí apareció la necesidad de `sandbox: false`).
3. **Escribir la UI** en `src/renderer/` con su CSP y su `renderer.js` que consume `window.api`.
4. **Añadir capas** conforme se necesiten: `src/shared/ipc.js` para los canales, `src/db/` para persistencia.
5. **Configurar `forge.config.js`**: makers por SO, `asar: true`, fuses, publisher de GitHub con `authToken: process.env.GITHUB_TOKEN`.
6. **Publicar**: bump de `version` en `package.json`, `npm run publish` con el token, y las apps instaladas se auto-actualizan vía `update-electron-app`.

La evolución del repo siguió estas fases (visible en el historial de git): Fase 1 canales IPC básicos → Fase 2 menú + tray → Fase 3 SQLite → Fase 4 iconos + release directo + `node:sqlite` → Fase 5 reestructura a `src/` con capas → migraciones versionadas → formulario de notas con título obligatorio → navegación entre vistas por hash.

---

## 11. Referencia rápida de comandos

```bash
npm start                      # arrancar la app en desarrollo (única forma de probar)
npm run package                # app empaquetada en out/
npm run make                   # instaladores (Squirrel/zip/deb/rpm) en out/
npm run publish                # release en GitHub Releases (requiere GITHUB_TOKEN + bump de versión)
```

- No hay lint, typecheck ni tests (`npm test` es un stub que falla a propósito).
- Para depurar: F5 en VS Code con el compound **"Main + renderer"** (`.vscode/launch.json`).
- La base de datos está en `app.getPath('userData')` (p. ej. `%APPDATA%\my-electron-app\app.db` en Windows).
