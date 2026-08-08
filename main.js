const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron/main');
const path = require('node:path');
const { updateElectronApp } = require('update-electron-app');

updateElectronApp();

// El estado del contador vive en el proceso principal, nunca en el renderer.
let count = 0;

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
