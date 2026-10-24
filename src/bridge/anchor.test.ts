// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { computeAnchor, resolveAnchor } from './anchor.ts';

function pick(selector: string) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`no element for ${selector}`);
    return computeAnchor(el, 0, 0);
}

beforeEach(() => {
    document.body.innerHTML = `
        <header><strong id="logo">Acme</strong><nav><a>Product</a><a>Pricing</a></nav></header>
        <main>
            <section><h2>Plans</h2><button data-testid="buy">Buy now</button></section>
            <section><p>First</p><p>Second   paragraph</p></section>
        </main>
        <footer><nav><a>Product</a><a>Pricing</a></nav></footer>`;
});

describe('computeAnchor', () => {
    it('prefers a unique id, then a test attribute', () => {
        expect(pick('#logo').selector).toBe('#logo');
        expect(pick('[data-testid="buy"]').selector).toBe('[data-testid="buy"]');
    });

    it('falls back to the shortest unique nth-of-type path', () => {
        const anchor = pick('main p:nth-of-type(2)');
        expect(anchor.selector).toBe('p:nth-of-type(2)');
        expect(anchor.text).toBe('Second paragraph');
        expect(pick('header a:nth-of-type(2)').selector).toBe('header > nav > a:nth-of-type(2)');
    });

    it('roots the path at an ancestor with an id', () => {
        document.querySelector('footer')?.setAttribute('id', 'site');
        expect(pick('footer a:nth-of-type(2)').selector).toBe('#site > nav > a:nth-of-type(2)');
    });

    it('resolves its own anchor back to the same element', () => {
        for (const el of document.body.querySelectorAll('*')) {
            expect(resolveAnchor(computeAnchor(el, 0, 0))).toBe(el);
        }
    });
});

describe('resolveAnchor', () => {
    const base = {
        offset: { x: 0, y: 0 },
        point: { x: 0, y: 0 },
        viewport: { width: 1, height: 1 },
    };

    it('finds moved elements by their text', () => {
        const anchor = pick('main section:nth-of-type(2) p:nth-of-type(2)');
        // A new paragraph shifts the stored nth-of-type path onto the wrong element.
        document.querySelector('main section:nth-of-type(2)')?.prepend(document.createElement('p'));
        expect(resolveAnchor(anchor)?.textContent).toBe('Second   paragraph');
    });

    it('keeps the selector match when the text changed everywhere', () => {
        const el = resolveAnchor({ ...base, selector: '#logo', text: 'Old name' });
        expect(el).toBe(document.querySelector('#logo'));
    });

    it('reports orphans when nothing matches', () => {
        expect(resolveAnchor({ ...base, selector: '#missing', text: 'Nowhere' })).toBeUndefined();
        expect(resolveAnchor({ ...base, selector: 'div:::bad' })).toBeUndefined();
    });
});
