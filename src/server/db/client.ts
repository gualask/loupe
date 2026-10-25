import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';

const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));

export type Db = ReturnType<typeof openDb>;

/** Opens Loupe's database inside the data directory. */
export function openDataDb(dataDir: string) {
    return openDb(path.join(dataDir, 'loupe.db'));
}

/** Opens the SQLite database (`:memory:` for tests) and applies pending migrations. */
export function openDb(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    const client = new DatabaseSync(file, { enableForeignKeyConstraints: true });
    client.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    const db = drizzle({ client });
    migrate(db, { migrationsFolder });
    return db;
}
