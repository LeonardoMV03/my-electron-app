const information = document.getElementById('info')

information.innerText = `Esta aplicación está usando Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;

// --- Contador: el estado vive en main, el renderer solo pide y muestra ---
const countValue = document.getElementById('count-value');
const countButton = document.getElementById('count-button');

const refreshCount = async () => {
    countValue.innerText = await window.api.count.get();
};

countButton.addEventListener('click', async () => {
    await window.api.count.inc();
    refreshCount();
});

refreshCount();

// --- Selector de archivos: el diálogo nativo lo abre main ---
const fileButton = document.getElementById('file-button');
const filePath = document.getElementById('file-path');

fileButton.addEventListener('click', async () => {
    const selected = await window.api.dialog.openFile();
    filePath.innerText = selected ? `Archivo: ${selected}` : 'Ningún archivo seleccionado';
});

// --- Notificación nativa del sistema ---
const notifyButton = document.getElementById('notify-button');

notifyButton.addEventListener('click', () => {
    window.api.notify('Hola desde Electron', 'Esto es una notificación nativa del sistema.');
});

// --- Notas: la base la abre y gestiona el proceso principal ---
const noteInput = document.getElementById('note-input');
const noteAdd = document.getElementById('note-add');
const noteList = document.getElementById('note-list');

const renderNotes = async () => {
    const notes = await window.api.notes.list();
    noteList.replaceChildren();
    for (const note of notes) {
        const li = document.createElement('li');
        li.textContent = `${note.content} — ${note.created_at} `;

        const del = document.createElement('button');
        del.textContent = 'Eliminar';
        del.addEventListener('click', async () => {
            await window.api.notes.delete(note.id);
            renderNotes();
        });
        li.appendChild(del);
        noteList.appendChild(li);
    }
};

noteAdd.addEventListener('click', async () => {
    const content = noteInput.value.trim();
    if (!content) return;
    await window.api.notes.create(content);
    noteInput.value = '';
    renderNotes();
});

renderNotes();
