// Única fuente de verdad para los nombres de canales IPC.
// Importarlo en main y en preload evita typos que rompen la comunicación.
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
