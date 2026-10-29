import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createDocumentCache } from './document-cache.ts';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('createDocumentCache', () => {
    it('prepares a document once, plain and gzip-encoded', async () => {
        const cache = createDocumentCache(1024 * 1024);
        const render = vi.fn(async () => '<p>Hi</p>');

        const [first, second] = await Promise.all([cache.get('a', render), cache.get('a', render)]);
        expect(await cache.get('a', render)).toBe(first);
        expect(second).toBe(first);
        expect(render).toHaveBeenCalledTimes(1);
        expect(text(first.body)).toBe('<p>Hi</p>');
        expect(text(gunzipSync(first.gzip))).toBe('<p>Hi</p>');
    });

    it('drops the least recently used documents beyond its size', async () => {
        // Room for two documents: 100 bytes plain plus their compressed form.
        const page = async () => 'x'.repeat(100);
        const size = (await createDocumentCache(1).get('size', page)).gzip.byteLength + 100;
        const cache = createDocumentCache(2 * size);
        const render = { a: vi.fn(page), b: vi.fn(page), c: vi.fn(page) };

        await cache.get('a', render.a);
        await cache.get('b', render.b);
        await cache.get('a', render.a); // a is now the most recent
        await cache.get('c', render.c); // b goes
        await cache.get('a', render.a);
        await cache.get('b', render.b);
        expect([render.a, render.b, render.c].map((r) => r.mock.calls.length)).toEqual([1, 2, 1]);
    });

    it('does not keep a document that failed to render', async () => {
        const cache = createDocumentCache(1024);
        await expect(cache.get('a', () => Promise.reject(new Error('gone')))).rejects.toThrow(
            'gone',
        );
        expect(text((await cache.get('a', async () => 'back')).body)).toBe('back');
    });
});
