const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { app } = require('electron/main');
const { runMigrations } = require('./migrations');

const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 500;

// La base vive en el directorio de datos del usuario, nunca en el código fuente.
// node:sqlite viene integrado en Node 24: no hay módulos nativos que recompilar.
// Se abre perezosamente la primera vez que se usa.
let db = null;

const getDb = () => {
    if (!db) {
        const dbPath = path.join(app.getPath('userData'), 'app.db');
        db = new DatabaseSync(dbPath);
        db.exec('PRAGMA journal_mode = WAL');
        runMigrations(db);
    }
    return db;
};

const listNotes = () => {
    return getDb()
        .prepare('SELECT id, title, content, created_at FROM notes ORDER BY id DESC')
        .all();
};

const createNote = ({ title, content }) => {
    const sanitizedTitle = String(title ?? '').trim().slice(0, MAX_TITLE_LENGTH);
    if (!sanitizedTitle) {
        throw new Error('La nota debe tener un título');
    }
    const sanitizedContent = String(content ?? '').trim().slice(0, MAX_CONTENT_LENGTH);
    const result = getDb()
        .prepare('INSERT INTO notes (title, content) VALUES (?, ?)')
        .run(sanitizedTitle, sanitizedContent);
    return getDb()
        .prepare('SELECT id, title, content, created_at FROM notes WHERE id = ?')
        .get(Number(result.lastInsertRowid));
};

const deleteNote = (id) => {
    const changes = getDb()
        .prepare('DELETE FROM notes WHERE id = ?')
        .run(Number(id)).changes;
    if (changes === 0) {
        throw new Error('La nota no existe');
    }
    return changes;
};

module.exports = { listNotes, createNote, deleteNote };
