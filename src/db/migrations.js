// Migraciones de esquema versionadas con PRAGMA user_version.
// Cada paso es una función que recibe la conexión. Nunca editar una migración
// ya aplicada (los usuarios la tienen en su base): agregar pasos nuevos al
// final del array. runMigrations aplica solo los pendientes, dentro de una
// transacción, y sube user_version tras cada paso.

const V1 = (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

// V2: demostración de evolución de esquema sobre una base con datos.
// SQLite no permite ADD COLUMN NOT NULL sin DEFAULT en tablas con filas.
const V2 = (db) => db.exec(`
    ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''
`);

const MIGRATIONS = [V1, V2];

const runMigrations = (db) => {
    const current = db.prepare('PRAGMA user_version').get().user_version;
    db.exec('BEGIN');
    try {
        for (let version = current; version < MIGRATIONS.length; version++) {
            MIGRATIONS[version](db);
            // user_version no acepta parámetros ligados; el entero es propio, interpolación segura.
            db.exec(`PRAGMA user_version = ${version + 1}`);
        }
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
};

module.exports = { MIGRATIONS, runMigrations };
