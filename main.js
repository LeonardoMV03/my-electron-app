const { app, BrowserWindow, ipcMain } = require('electron/main');
const path = require('node:path');
const { updateElectronApp } = require('update-electron-app');

updateElectronApp();

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
