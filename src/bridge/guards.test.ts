// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://loupe.test/s/tok/content" }
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeMessage } from '../shared/bridge-protocol.ts';
import { installGuards } from './guards.ts';

// Storage denied as in an opaque origin, before the guards look at it.
for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, {
        configurable: true,
        get() {
            throw new DOMException('The document is sandboxed', 'SecurityError');
        },
    });
}

// happy-dom has no dialogs; browsers do.
window.alert = () => undefined;

const post = vi.fn<(message: BridgeMessage) => void>();
// Installed once, as in a document: each permission is reported once.
const guards = installGuards(post);

beforeEach(() => {
    post.mockClear();
    document.body.innerHTML = '';
});

/** Clicks `html`'s first element, from inside the document; whether the browser may go on. */
function click(html: string, prevent = false) {
    document.body.innerHTML = html;
    const el = document.body.firstElementChild as HTMLElement;
    if (prevent) el.addEventListener('click', (event) => event.preventDefault());
    // Once the guards decided, the click goes no further: happy-dom would follow the link
    // through window.open, which the guards take for a popup opened by script.
    let allowed = false;
    const settle = (event: Event) => {
        allowed = !event.defaultPrevented;
        event.preventDefault();
    };
    window.addEventListener('click', settle, { once: true });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return allowed;
}

describe('installGuards', () => {
    it('keeps storage in memory when the sandbox denies it', () => {
        localStorage.setItem('cart', '2');
        sessionStorage.setItem('step', 'pay');
        expect([localStorage.getItem('cart'), localStorage.length, localStorage.key(0)]).toEqual([
            '2',
            1,
            'cart',
        ]);
        expect(sessionStorage.getItem('cart')).toBeNull();
        localStorage.clear();
        expect(localStorage.length).toBe(0);
    });

    it('hands links leaving the mockup to the app', () => {
        expect(click('<a href="https://example.com/pricing">Pricing</a>')).toBe(false);
        expect(click('<a href="mailto:sales@example.com">Mail</a>')).toBe(false);
        expect(click('<a href="#plans" target="_blank">Plans</a>')).toBe(false);
        expect(post.mock.calls).toEqual([
            [{ type: 'loupe:link', url: 'https://example.com/pricing' }],
            [{ type: 'loupe:link', url: 'mailto:sales@example.com' }],
            [{ type: 'loupe:link', url: 'http://loupe.test/s/tok/content#plans' }],
        ]);
    });

    it('lets the document scroll and reload itself, and leaves handled links alone', () => {
        expect(click('<a href="#plans">Plans</a>')).toBe(true);
        expect(click('<a href="?step=2">Next</a>')).toBe(true);
        expect(click('<a href="https://example.com/">Routed</a>', true)).toBe(false);
        expect(post).not.toHaveBeenCalled();
    });

    it('offers pages the mockup opens by script', () => {
        expect(window.open('/terms', '_blank')).toBeNull();
        const detached = document.createElement('a');
        detached.href = 'https://example.com/help';
        detached.click();
        expect(post.mock.calls).toEqual([
            [{ type: 'loupe:link', url: 'http://loupe.test/terms' }],
            [{ type: 'loupe:link', url: 'https://example.com/help' }],
        ]);
    });

    it('reports each permission the mockup uses once, and again on replay', () => {
        click('<a href="blob:report" download="report.html">Save</a>');
        click('<form><button>Send</button></form>');
        document.body.innerHTML = '<form><input name="q"></form>';
        document.querySelector('form')?.submit();
        window.alert('Saved');
        expect(post.mock.calls).toEqual([
            [{ type: 'loupe:attempt', permission: 'downloads' }],
            [{ type: 'loupe:attempt', permission: 'forms' }],
            [{ type: 'loupe:attempt', permission: 'modals' }],
        ]);

        post.mockClear();
        guards.replay();
        expect(post.mock.calls.map(([message]) => message)).toEqual([
            { type: 'loupe:attempt', permission: 'downloads' },
            { type: 'loupe:attempt', permission: 'forms' },
            { type: 'loupe:attempt', permission: 'modals' },
        ]);
    });

    it('stops submissions no script handled, which would end on an error page', () => {
        document.body.innerHTML = '<form><input name="q"></form>';
        const event = new Event('submit', { bubbles: true, cancelable: true });
        document.querySelector('form')?.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });
});
