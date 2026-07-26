# my-electron-app

Aplicación de escritorio construida con [Electron](https://www.electronjs.org/) y [Electron Forge](https://www.electronforge.io/).

## Descripción

Este proyecto es una app de ejemplo con una ventana principal que carga un archivo HTML local, expone información básica del entorno de ejecución y prueba comunicación entre el proceso principal y el renderizador mediante IPC.

## Estructura del proyecto

```text
my-electron-app/
├─ forge.config.js
├─ index.html
├─ main.js
├─ package.json
├─ preload.js
└─ renderer.js
```

### Archivos principales

- `main.js`: proceso principal de Electron. Crea la ventana, carga `index.html` y registra el canal IPC `ping`.
- `preload.js`: puente seguro entre el proceso principal y el renderizador. Expone `versions` en `window`.
- `renderer.js`: lógica del renderizador. Lee `versions` y pinta información en la interfaz.
- `index.html`: interfaz visual principal de la app.
- `forge.config.js`: configuración de Electron Forge, empaquetado, makers y publicación en GitHub.
- `package.json`: scripts, metadatos y dependencias.

## Funcionamiento

1. Al ejecutar la app, Electron inicia `main.js`.
2. `main.js` crea una ventana de `BrowserWindow` y carga `index.html`.
3. `preload.js` expone datos del entorno, como la versión de Node.js, Chrome y Electron.
4. `renderer.js` toma esos datos y los muestra en pantalla.
5. El canal IPC `ping` está preparado para probar comunicación entre procesos y devolver `pong`.

## Arquitectura

La app sigue la arquitectura típica de Electron con un proceso principal, un proceso de renderizado y un archivo de preload como puente seguro entre ambos.

```mermaid
flowchart LR
	A[main.js\nProceso principal] --> B[BrowserWindow]
	B --> C[index.html\nInterfaz]
	C --> D[renderer.js\nLógica visual]
	A --> E[ipcMain.handle('ping')]
	F[preload.js\nPuente seguro] --> D
	A --> F
	F --> G[window.versions]
	D --> G
	D --> E
	E --> H[pong]
```

### Flujo de comunicación

- `main.js` crea la ventana y registra la ruta IPC.
- `preload.js` expone solo las APIs necesarias en `window`.
- `renderer.js` consume esas APIs y actualiza la interfaz.
- `ipcMain.handle('ping')` devuelve `pong` cuando se invoca desde el renderizador.

## Scripts disponibles

- `npm run start`: arranca la aplicación en modo desarrollo.
- `npm run package`: genera el paquete de la app.
- `npm run make`: crea instaladores o distribuibles según la configuración de Forge.
- `npm run publish`: publica los distributables en GitHub Releases.

## Requisitos

- Node.js instalado.
- Dependencias instaladas con `npm install`.
- Para publicar en GitHub, se necesita la variable de entorno `GITHUB_TOKEN` con permisos para subir releases.

## Publicación

La configuración de publicación está en `forge.config.js` y apunta al repositorio GitHub del proyecto. Para publicar correctamente, define el token antes de ejecutar el comando:

```bash
set GITHUB_TOKEN=tu_token
npm run publish
```

En PowerShell:

```powershell
$env:GITHUB_TOKEN="tu_token"
npm run publish
```

## Notas técnicas

- La app usa `contextBridge` en el preload, que es la forma recomendada de exponer API al renderer.
- El archivo `index.html` incluye una política básica de seguridad con `Content-Security-Policy`.
- El proyecto está configurado como `commonjs` en `package.json`.
