const { contextBridge, ipcRenderer } = require('electron');
const { PING, COUNT_GET, COUNT_INC, DIALOG_OPEN_FILE, NOTIFY_SEND, NOTES_LIST, NOTES_CREATE, NOTES_DELETE } = require('../shared/ipc');

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    ping: () => ipcRenderer.invoke(PING)
    // también podemos exponer variables, no solo funciones
});

// API segura: cada función envuelve un ipcRenderer.invoke concreto.
contextBridge.exposeInMainWorld('api', {
    count: {
        get: () => ipcRenderer.invoke(COUNT_GET),
        inc: () => ipcRenderer.invoke(COUNT_INC)
    },
    dialog: {
        openFile: () => ipcRenderer.invoke(DIALOG_OPEN_FILE)
    },
    notify: (title, body) => ipcRenderer.invoke(NOTIFY_SEND, { title, body }),
    notes: {
        list: () => ipcRenderer.invoke(NOTES_LIST),
        create: (note) => ipcRenderer.invoke(NOTES_CREATE, note),
        delete: (id) => ipcRenderer.invoke(NOTES_DELETE, id)
    }
});
