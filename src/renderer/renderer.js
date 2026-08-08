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
const noteForm = document.getElementById('note-form');
const noteTitle = document.getElementById('note-title');
const noteInput = document.getElementById('note-input');
const noteList = document.getElementById('note-list');

const renderNotes = async () => {
    const notes = await window.api.notes.list();
    noteList.replaceChildren();
    for (const note of notes) {
        const li = document.createElement('li');

        const title = document.createElement('strong');
        title.textContent = note.title || '(Sin título)';

        const details = document.createElement('span');
        const parts = [];
        if (note.content) {
            parts.push(note.content);
        }
        parts.push(note.created_at);
        details.textContent = ` — ${parts.join(' — ')}`;

        const del = document.createElement('button');
        del.textContent = 'Eliminar';
        del.addEventListener('click', async () => {
            await window.api.notes.delete(note.id);
            renderNotes();
        });

        li.append(title, details, del);
        noteList.appendChild(li);
    }
};

noteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await window.api.notes.create({
        title: noteTitle.value,
        content: noteInput.value
    });
    noteTitle.value = '';
    noteInput.value = '';
    renderNotes();
});

renderNotes();
