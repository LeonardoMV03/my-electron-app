const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { app } = require('electron/main');

const MAX_CONTENT_LENGTH = 500;

// La base vive en el directorio de datos del usuario, nunca en el código fuente.
// node:sqlite viene integrado en Node 24: no hay módulos nativos que recompilar.
// Se abre perezosamente la primera vez que se usa.
let db = null;

const migrate = (database) => {
    database.exec(`
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
};

const getDb = () => {
    if (!db) {
        const dbPath = path.join(app.getPath('userData'), 'app.db');
        db = new DatabaseSync(dbPath);
        db.exec('PRAGMA journal_mode = WAL');
        migrate(db);
    }
    return db;
};

const listNotes = () => {
    return getDb()
        .prepare('SELECT id, content, created_at FROM notes ORDER BY id DESC')
        .all();
};

const createNote = (content) => {
    const sanitized = String(content ?? '').trim().slice(0, MAX_CONTENT_LENGTH);
    if (!sanitized) {
        throw new Error('La nota no puede estar vacía');
    }
    const result = getDb()
        .prepare('INSERT INTO notes (content) VALUES (?)')
        .run(sanitized);
    return getDb()
        .prepare('SELECT id, content, created_at FROM notes WHERE id = ?')
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
