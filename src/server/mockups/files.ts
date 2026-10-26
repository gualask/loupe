import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

function mockupsDir(dataDir: string) {
    return path.join(dataDir, 'mockups');
}

function fileFor(dataDir: string, sha256: string) {
    return path.join(mockupsDir(dataDir), `${sha256}.html`);
}

// Storing and cleaning up take turns: a clean-up running between a file's write and the insert
// of the version referencing it would delete the new file. Loupe is a single process, so an
// in-memory queue is enough.
let turn: Promise<unknown> = Promise.resolve();
function inTurn<T>(task: () => Promise<T>) {
    const run = turn.then(task);
    turn = run.catch(() => undefined);
    return run;
}

/**
 * Stores the file under its SHA-256 (identical uploads share one file), then runs `register`
 * with the hash, e.g. to insert the version referencing it, before any clean-up can run.
 */
export function storeMockupFile<T>(
    dataDir: string,
    bytes: Uint8Array,
    register: (sha256: string) => T,
) {
    return inTurn(async () => {
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        await mkdir(mockupsDir(dataDir), { recursive: true });
        await writeFile(fileFor(dataDir, sha256), bytes, { flag: 'wx' }).catch((error) => {
            if (error.code !== 'EEXIST') throw error;
        });
        return register(sha256);
    });
}

export function readMockupFile(dataDir: string, sha256: string) {
    return readFile(fileFor(dataDir, sha256), 'utf8');
}

/** Deletes stored files that no version references any more, as `referenced` lists them. */
export function deleteUnreferencedFiles(dataDir: string, referenced: () => Set<string>) {
    return inTurn(async () => {
        const names = await readdir(mockupsDir(dataDir)).catch(() => []);
        const keep = referenced();
        await Promise.all(
            names
                .filter((name) => name.endsWith('.html') && !keep.has(name.slice(0, -5)))
                .map((name) => rm(path.join(mockupsDir(dataDir), name), { force: true })),
        );
    });
}
