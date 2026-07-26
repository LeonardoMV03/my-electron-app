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

## Guía de arquitectura, Electron y SQLite

Esta sección resume una forma sólida de trabajar con este proyecto cuando crezca. La idea es mantener la interfaz ligera, la lógica sensible en el proceso principal y la persistencia de datos en una capa separada.

### Arquitectura recomendada

La estructura más estable para una app Electron pequeña o mediana es separar responsabilidades por capas.

```text
main.js      -> ciclo de vida, ventanas, IPC, acceso a sistema
preload.js   -> puente seguro entre main y renderer
renderer.js  -> interfaz, eventos y consumo de datos
SQLite       -> persistencia local controlada desde main
```

#### Roles de cada capa

- `main.js`: crea la ventana, controla el cierre de la aplicación y administra operaciones privilegiadas.
- `preload.js`: expone una API mínima y segura al renderizador usando `contextBridge`.
- `renderer.js`: maneja la experiencia visual y llama a funciones expuestas por `preload.js`.
- SQLite: almacena datos locales como notas, tareas, clientes, configuraciones o historial.

### Cómo funciona Electron en este proyecto

Electron combina Node.js y Chromium. En este repositorio ya se ve el flujo básico:

1. Electron arranca en `main.js`.
2. `main.js` crea la ventana principal con `BrowserWindow`.
3. La ventana carga `index.html` como interfaz local.
4. `preload.js` expone una API limitada a `window`.
5. `renderer.js` consume esa API y actualiza el contenido.
6. El canal `ping` demuestra comunicación IPC entre procesos.

### Buenas prácticas para Electron

- Mantén `nodeIntegration` desactivado en el renderer.
- Usa `contextIsolation` activado y comunica el renderer solo por `preload.js`.
- Expón funciones específicas, no objetos con acceso amplio al sistema.
- Valida toda entrada que viaje por IPC.
- Reserva al proceso principal las tareas sensibles: archivos, base de datos, credenciales y accesos al sistema.
- Mantén una Content Security Policy estricta en la interfaz.

### Persistencia con SQLite

Este proyecto todavía no usa SQLite, pero es la opción más práctica para guardar datos locales en una app de escritorio.

#### Cuándo usar SQLite

- Cuando necesitas guardar datos sin depender de internet.
- Cuando la app debe funcionar rápido y con una sola base local.
- Cuando quieres consultas estructuradas y transacciones.

#### Dónde ubicar el acceso a datos

La recomendación es no abrir SQLite desde el renderizador. Lo más seguro es:

- abrir la base desde `main.js` o desde un módulo de acceso a datos que solo use el proceso principal;
- exponer operaciones concretas en `preload.js`;
- consumir esas operaciones desde `renderer.js` sin tocar la base directamente.

#### Flujo recomendado

1. La app inicia y el proceso principal abre o crea la base de datos.
2. Se ejecutan migraciones o creación de tablas si hace falta.
3. El renderizador pide datos mediante IPC.
4. El proceso principal lee o escribe en SQLite.
5. El resultado vuelve al renderizador para mostrarlo en la UI.

#### Qué guardar en SQLite

- Datos de negocio: tareas, registros, formularios, inventario, notas.
- Estados persistentes: configuración del usuario, ventanas, filtros y preferencias.
- Historial o auditoría si tu aplicación lo necesita.

#### Buenas prácticas con SQLite

- Usa una sola capa de acceso a datos.
- Centraliza las consultas para no duplicar lógica.
- Define migraciones desde el inicio.
- No construyas SQL concatenando texto sin validar.
- Mantén la base en una ruta de datos de usuario, no dentro del código fuente.

### Instalación y distribución

La instalación de una app Electron depende del sistema operativo objetivo. En este proyecto ya existe soporte con Electron Forge.

#### Flujo de desarrollo

1. Instala dependencias con `npm install`.
2. Ejecuta la app con `npm run start`.
3. Verifica el comportamiento de la ventana y el IPC.

#### Empaquetado

- `npm run package`: prepara la aplicación para distribución.
- `npm run make`: genera instaladores o binarios según la plataforma.
- `npm run publish`: publica los artefactos en GitHub Releases.

#### Instaladores por plataforma

- Windows: Squirrel.
- macOS: ZIP.
- Linux: DEB y RPM.

#### Publicación segura

La publicación usa GitHub Releases y requiere `GITHUB_TOKEN` en el entorno. No conviene dejar tokens hardcodeados en el repositorio.

### Estructura sugerida cuando crezca

Si el proyecto empieza a crecer, conviene organizarlo así:

```text
src/
├─ main/
├─ preload/
├─ renderer/
├─ shared/
└─ db/
```

- `main/`: ventanas, menús, IPC y lógica del sistema.
- `preload/`: API segura expuesta al renderer.
- `renderer/`: componentes visuales y estado de la interfaz.
- `shared/`: utilidades, tipos o validadores comunes.
- `db/`: conexión, consultas y migraciones de SQLite.

### Resumen práctico

- Electron te da la interfaz de escritorio.
- `preload.js` te protege de exponer demasiado.
- SQLite te resuelve la persistencia local.
- Electron Forge te resuelve empaquetado y publicación.
- Separar responsabilidades desde el inicio evita que la app se vuelva difícil de mantener.
