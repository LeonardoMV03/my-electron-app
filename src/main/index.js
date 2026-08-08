const { app, BrowserWindow, ipcMain, dialog, Notification, Menu, Tray, nativeImage } = require('electron/main');
const path = require('node:path');
const { updateElectronApp } = require('update-electron-app');
const notes = require('../db/database');
const { PING, COUNT_GET, COUNT_INC, DIALOG_OPEN_FILE, NOTIFY_SEND, NOTES_LIST, NOTES_CREATE, NOTES_DELETE } = require('../shared/ipc');

// El estado del contador vive en el proceso principal, nunca en el renderer.
let count = 0;

// Referencia al tray en el scope del módulo para evitar el garbage collector.
let tray = null;

const createWindow = () => {
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
            // sandbox: false permite require local en el preload (necesario para
            // importar src/shared/ipc). contextIsolation sigue activo: el renderer
            // solo ve lo que expone contextBridge.
            sandbox: false
        }
    });

    window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
};

const getMainWindow = () => BrowserWindow.getAllWindows()[0];

const toggleMainWindow = () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isVisible()) {
        win.hide();
    } else {
        win.show();
        win.focus();
    }
};

const createMenu = () => {
    const template = [
        ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
        {
            label: 'Archivo',
            submenu: [
                {
                    label: 'Nueva ventana',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => createWindow()
                },
                { type: 'separator' },
                process.platform === 'darwin' ? { role: 'close' } : { role: 'quit', label: 'Salir' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { role: 'reload', label: 'Recargar' },
                { role: 'toggleDevTools', label: 'DevTools' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Tamaño real' },
                { role: 'zoomIn', label: 'Acercar' },
                { role: 'zoomOut', label: 'Alejar' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Acerca de',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Acerca de',
                            message: 'my-electron-app',
                            detail: 'Aplicación de ejemplo para aprender Electron y Electron Forge.'
                        });
                    }
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createTray = () => {
    const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray-icon.png'));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('my-electron-app');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Mostrar / Ocultar ventana', click: () => toggleMainWindow() },
        { type: 'separator' },
        { label: 'Salir', click: () => app.quit() }
    ]));
    tray.on('click', () => toggleMainWindow());
};

const registerIpcHandlers = () => {
    ipcMain.handle(PING, () => 'pong');

    // Contador: el estado se guarda en main y cada llamada lo muta.
    ipcMain.handle(COUNT_GET, () => count);
    ipcMain.handle(COUNT_INC, () => ++count);

    // Diálogos nativos: solo el proceso principal puede abrirlos.
    ipcMain.handle(DIALOG_OPEN_FILE, async () => {
        const result = await dialog.showOpenDialog({
            title: 'Elige un archivo',
            properties: ['openFile']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    // Notificaciones nativas del sistema.
    ipcMain.handle(NOTIFY_SEND, (event, { title, body }) => {
        if (!Notification.isSupported()) {
            return false;
        }
        new Notification({
            title: String(title || ''),
            body: String(body || '')
        }).show();
        return true;
    });

    // Notas: persistencia local en SQLite, siempre desde el proceso principal.
    ipcMain.handle(NOTES_LIST, () => notes.listNotes());
    ipcMain.handle(NOTES_CREATE, (event, content) => notes.createNote(content));
    ipcMain.handle(NOTES_DELETE, (event, id) => notes.deleteNote(id));
};

app.whenReady().then(() => {
    // Auto-updates solo en la app empaquetada: en dev solo generaría ruido.
    if (app.isPackaged) {
        updateElectronApp();
    }

    registerIpcHandlers();
    createMenu();
    createTray();
    createWindow();

    // En macOS la app no cierra al cerrar la última ventana (convención de plataforma).
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// En Windows y Linux, cerrar la última ventana cierra la app.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
