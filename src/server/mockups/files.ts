import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_REPORTED_REFS = 50;

function mockupsDir(dataDir: string) {
    return path.join(dataDir, 'mockups');
}

function fileFor(dataDir: string, sha256: string) {
    return path.join(mockupsDir(dataDir), `${sha256}.html`);
}

/** Stores the file under its SHA-256 (identical uploads share one file) and returns the hash. */
export async function storeMockupFile(dataDir: string, bytes: Uint8Array) {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await mkdir(mockupsDir(dataDir), { recursive: true });
    await writeFile(fileFor(dataDir, sha256), bytes, { flag: 'wx' }).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
    });
    return sha256;
}

export function readMockupFile(dataDir: string, sha256: string) {
    return readFile(fileFor(dataDir, sha256), 'utf8');
}

/** Deletes stored files that no version references any more. */
export async function deleteUnreferencedFiles(dataDir: string, referenced: Set<string>) {
    const names = await readdir(mockupsDir(dataDir)).catch(() => []);
    await Promise.all(
        names
            .filter((name) => name.endsWith('.html') && !referenced.has(name.slice(0, -5)))
            .map((name) => rm(path.join(mockupsDir(dataDir), name), { force: true })),
    );
}

/** Decodes an upload as UTF-8 HTML, or returns undefined when it is not. */
export function decodeHtml(bytes: Uint8Array) {
    try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return /<(!doctype\s+html|html|head|body)\b/i.test(text) ? text : undefined;
    } catch {
        return undefined;
    }
}

/** External http(s) or protocol-relative URLs loaded by attributes, CSS url() and @import. */
export function findExternalRefs(html: string) {
    const patterns = [
        /\b(?:src|href|poster|data|action)\s*=\s*["']?((?:https?:)?\/\/[^"'\s>]+)/gi,
        /url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi,
        /@import\s+["']((?:https?:)?\/\/[^"']+)/gi,
    ];
    const refs = new Set<string>();
    for (const pattern of patterns) {
        for (const match of html.matchAll(pattern)) {
            if (match[1]) refs.add(match[1]);
            if (refs.size >= MAX_REPORTED_REFS) return [...refs];
        }
    }
    return [...refs];
}
