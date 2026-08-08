const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    ping: () => ipcRenderer.invoke('ping')
    // también podemos exponer variables, no solo funciones
});

// API segura: cada función envuelve un ipcRenderer.invoke concreto.
contextBridge.exposeInMainWorld('api', {
    count: {
        get: () => ipcRenderer.invoke('count:get'),
        inc: () => ipcRenderer.invoke('count:inc')
    },
    dialog: {
        openFile: () => ipcRenderer.invoke('dialog:open-file')
    },
    notify: (title, body) => ipcRenderer.invoke('notify:send', { title, body })
});