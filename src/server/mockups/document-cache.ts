import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

const gzipAsync = promisify(gzip);

/** A mockup document ready to send: the page with the bridge inlined, plain and gzip-encoded. */
type PreparedDocument = { body: Uint8Array<ArrayBuffer>; gzip: Uint8Array<ArrayBuffer> };

/** A cached document; its size is known once it is prepared. */
type Entry = { document: Promise<PreparedDocument>; bytes?: number };

/**
 * The most recently served documents, up to `maxBytes` in all. A document depends only on its
 * stored file and the bridge, both fixed under one key, so an entry never goes stale. Preparing
 * one reads a file of up to the upload limit and compresses it: a request arriving meanwhile
 * waits for it instead of preparing it again.
 */
export function createDocumentCache(maxBytes: number) {
    // Least recently used first.
    const entries = new Map<string, Entry>();
    let total = 0;

    function evict() {
        for (const [key, entry] of entries) {
            if (total <= maxBytes) return;
            if (entry.bytes === undefined) continue;
            entries.delete(key);
            total -= entry.bytes;
        }
    }

    return {
        /** The document under `key`, made from the page `render` returns when not cached. */
        get(key: string, render: () => Promise<string>) {
            const cached = entries.get(key);
            if (cached) {
                entries.delete(key);
                entries.set(key, cached);
                return cached.document;
            }
            const entry: Entry = {
                document: render().then(async (html) => {
                    const body = new TextEncoder().encode(html);
                    return { body, gzip: new Uint8Array(await gzipAsync(body)) };
                }),
            };
            entries.set(key, entry);
            entry.document.then(
                ({ body, gzip }) => {
                    entry.bytes = body.byteLength + gzip.byteLength;
                    total += entry.bytes;
                    evict();
                },
                // Not kept, so the next request tries again; this one gets the error.
                () => entries.delete(key),
            );
            return entry.document;
        },
    };
}
