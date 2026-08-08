const { app, BrowserWindow, ipcMain, dialog, Notification, Menu, Tray, nativeImage } = require('electron/main');
const path = require('node:path');
const { updateElectronApp } = require('update-electron-app');
const notes = require('./db/database');

updateElectronApp();

// El estado del contador vive en el proceso principal, nunca en el renderer.
let count = 0;

// Referencia al tray en el scope del módulo para evitar el garbage collector.
let tray = null;

const createWindow = () => {
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    window.loadFile('index.html');
}

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
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('my-electron-app');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Mostrar / Ocultar ventana', click: () => toggleMainWindow() },
        { type: 'separator' },
        { label: 'Salir', click: () => app.quit() }
    ]));
    tray.on('click', () => toggleMainWindow());
};


app.whenReady().then(() => {
    ipcMain.handle('ping', () => 'pong');

    // Contador: el estado se guarda en main y cada llamada lo muta.
    ipcMain.handle('count:get', () => count);
    ipcMain.handle('count:inc', () => ++count);

    // Diálogos nativos: solo el proceso principal puede abrirlos.
    ipcMain.handle('dialog:open-file', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Elige un archivo',
            properties: ['openFile']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    // Notificaciones nativas del sistema.
    ipcMain.handle('notify:send', (event, { title, body }) => {
        if (!Notification.isSupported()) {
            return false;
        }
        new Notification({
            title: String(title || ''),
            body: String(body || '')
        }).show();
        return true;
    });

    createWindow();

    // for MacOS
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0){
    // Notas: persistencia local en SQLite, siempre desde el proceso principal.
    ipcMain.handle('notes:list', () => notes.listNotes());
    ipcMain.handle('notes:create', (event, content) => notes.createNote(content));
    ipcMain.handle('notes:delete', (event, id) => notes.deleteNote(id));

    createMenu();
    createTray();
    createWindow();
        }
    });
});

// Closed the process in windows/linux
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin'){
        app.quit();
    }
});
