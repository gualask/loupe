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

const EXTERNAL_URL = /^(?:https?:)?\/\//i;
const TAG = /<([a-z][\w:-]*)\b([^>]*)>/gi;
const ATTRIBUTE =
    /(?:^|\s)(src|srcset|poster|data|href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
// Elements whose href loads a resource; on <a> and <area> it only navigates.
const LOADING_HREF = new Set(['link', 'image', 'use', 'feimage', 'script']);
const CSS_URLS = [
    /url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi,
    /@import\s+["']((?:https?:)?\/\/[^"']+)/gi,
];

/** URLs an attribute makes the browser load; links and form actions only navigate. */
function loadedUrls(tag: string, name: string, value: string) {
    if (name === 'srcset')
        return value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0] ?? '');
    if (name.endsWith('href')) return LOADING_HREF.has(tag) ? [value] : [];
    if (name === 'data') return tag === 'object' ? [value] : [];
    return [value];
}

/** External http(s) or protocol-relative resources loaded by elements, CSS url() and @import. */
export function findExternalRefs(html: string) {
    const refs = new Set<string>();
    for (const [, tag = '', attributes = ''] of html.matchAll(TAG)) {
        for (const [, name = '', ...values] of attributes.matchAll(ATTRIBUTE)) {
            const value = values.find((v) => v !== undefined) ?? '';
            for (const url of loadedUrls(tag.toLowerCase(), name.toLowerCase(), value.trim())) {
                if (EXTERNAL_URL.test(url)) refs.add(url);
            }
        }
    }
    for (const pattern of CSS_URLS) {
        for (const [, url] of html.matchAll(pattern)) if (url) refs.add(url);
    }
    return [...refs].slice(0, MAX_REPORTED_REFS);
}
