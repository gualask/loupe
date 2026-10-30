// Keeps mockups working inside the sandbox, and tells the app what they used that needs a
// permission (docs/SPEC.md §4.2). Installed before any mockup code runs.
import type { BridgeMessage } from '../shared/bridge-protocol.ts';
import type { MockupPermission } from '../shared/mockup-permissions.ts';

type Post = (message: BridgeMessage) => void;

/** Storage lasting as long as the document, for when the sandbox denies the real one. */
class MemoryStorage {
    #items = new Map<string, string>();
    get length() {
        return this.#items.size;
    }
    key(index: number) {
        return [...this.#items.keys()][index] ?? null;
    }
    getItem(key: string) {
        return this.#items.get(String(key)) ?? null;
    }
    setItem(key: string, value: string) {
        this.#items.set(String(key), String(value));
    }
    removeItem(key: string) {
        this.#items.delete(String(key));
    }
    clear() {
        this.#items.clear();
    }
}

/** `document.cookie` lasting as long as the document: names and values, attributes ignored. */
function memoryCookies() {
    const jar = new Map<string, string>();
    return {
        get: () => [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
        set(cookie: string) {
            const [pair = '', ...attributes] = String(cookie).split(';');
            const equals = pair.indexOf('=');
            const name = equals < 0 ? '' : pair.slice(0, equals).trim();
            const expired = attributes.some((attribute) => {
                const [key = '', value = ''] = attribute.split(/=(.*)/);
                if (/^\s*max-age\s*$/i.test(key)) return Number(value) <= 0;
                return /^\s*expires\s*$/i.test(key) && Date.parse(value) < Date.now();
            });
            if (expired) jar.delete(name);
            else jar.set(name, pair.slice(equals + 1).trim());
        },
    };
}

/** Defines `name` on `target` when reading it throws, as storage does in an opaque origin. */
function replaceIfDenied(target: object, name: string, descriptor: PropertyDescriptor) {
    try {
        void (target as Record<string, unknown>)[name];
    } catch {
        Object.defineProperty(target, name, { configurable: true, ...descriptor });
    }
}

/** Runs `before` ahead of each call of method `name`, which goes on only if it returns true. */
function wrap(target: object, name: string, before: (self: unknown, args: unknown[]) => boolean) {
    const methods = target as Record<string, unknown>;
    const original = methods[name];
    if (typeof original !== 'function') return;
    methods[name] = function (this: unknown, ...args: unknown[]) {
        return before(this, args) ? original.apply(this, args) : null;
    };
}

/** An <a> or <area>, in HTML or SVG, that leads somewhere. */
const isLink = (node: EventTarget): node is Element =>
    node instanceof Element &&
    (node.localName === 'a' || node.localName === 'area') &&
    (node.hasAttribute('href') || node.hasAttribute('xlink:href'));

const isSubmitter = (node: EventTarget) =>
    (node instanceof HTMLButtonElement && node.type === 'submit') ||
    (node instanceof HTMLInputElement && (node.type === 'submit' || node.type === 'image'));

// Fields where Enter does not submit the form they are in.
const NO_IMPLICIT_SUBMIT = /^(button|checkbox|color|file|radio|range|reset|submit|image)$/;

/** Where following `link` would go, when it leaves this document; undefined when it stays. */
function leavingUrl(link: Element) {
    if (link.hasAttribute('download')) return undefined;
    const href = link.getAttribute('href') ?? link.getAttribute('xlink:href');
    if (href === null) return undefined;
    let url: URL;
    try {
        url = new URL(href, document.baseURI);
    } catch {
        return undefined;
    }
    if (url.protocol === 'javascript:') return undefined;
    const target = (link.getAttribute('target') ?? '').toLowerCase();
    // Another fragment or query of this document reloads or scrolls it, inside the frame.
    const here = url.origin === location.origin && url.pathname === location.pathname;
    return here && (target === '' || target === '_self') ? undefined : url.href;
}

/**
 * Replaces storage the sandbox denies with storage in memory, stops links and forms from
 * replacing the document with an error page, and reports each permission the mockup uses.
 * Returns `replay`, which reports them again, for an app that started listening late.
 */
export function installGuards(post: Post) {
    const attempted = new Set<MockupPermission>();
    function attempt(permission: MockupPermission) {
        if (attempted.has(permission)) return;
        attempted.add(permission);
        post({ type: 'loupe:attempt', permission });
    }

    /**
     * Whether the browser may follow `link`: false when it leaves the mockup, which the app then
     * offers to open in a new tab.
     */
    function staysInFrame(link: Element) {
        if (link.hasAttribute('download')) {
            attempt('downloads');
            return true;
        }
        const url = leavingUrl(link);
        if (url) post({ type: 'loupe:link', url });
        return !url;
    }

    replaceIfDenied(window, 'localStorage', { value: new MemoryStorage() });
    replaceIfDenied(window, 'sessionStorage', { value: new MemoryStorage() });
    const cookies = memoryCookies();
    replaceIfDenied(document, 'cookie', { get: cookies.get, set: cookies.set });

    /** Reports `permission` on each call of the methods `names` of `target`, then makes it. */
    function reportCalls(
        target: object | undefined,
        names: string[],
        permission: MockupPermission,
    ) {
        if (!target) return;
        for (const name of names) {
            wrap(target, name, () => {
                attempt(permission);
                return true;
            });
        }
    }

    reportCalls(window, ['alert', 'confirm', 'prompt', 'print'], 'modals');
    // Missing outside secure contexts, such as Loupe served over plain http.
    reportCalls(navigator.clipboard, ['write', 'writeText'], 'clipboard');
    reportCalls(HTMLFormElement.prototype, ['requestSubmit'], 'forms');
    // A popup would be blocked: the app offers the page instead.
    wrap(window, 'open', (_self, [url]) => {
        try {
            if (url) post({ type: 'loupe:link', url: new URL(String(url), document.baseURI).href });
        } catch {
            // Not a URL: there is nothing to offer.
        }
        return false;
    });
    // submit() skips the submit event and navigates, which form-action 'none' turns into an
    // error page; the mockup's script never gets to handle it.
    wrap(HTMLFormElement.prototype, 'submit', () => {
        attempt('forms');
        return false;
    });
    // Links clicked by script without being in the document: the listener below misses them.
    wrap(HTMLAnchorElement.prototype, 'click', (self) => {
        const link = self as HTMLAnchorElement;
        return link.isConnected || staysInFrame(link);
    });

    // Listening on window, after the mockup's own handlers on its elements and document: what
    // they prevented, such as a router's links, is theirs.
    addEventListener('click', (event) => {
        if (event.defaultPrevented) return;
        const path = event.composedPath();
        const link = path.find(isLink);
        if (link && !staysInFrame(link)) event.preventDefault();
        else if (path.some(isSubmitter)) attempt('forms');
    });
    addEventListener('keydown', (event) => {
        if (event.defaultPrevented || event.key !== 'Enter' || event.isComposing) return;
        const field = event.composedPath()[0];
        if (
            field instanceof HTMLInputElement &&
            field.form &&
            !NO_IMPLICIT_SUBMIT.test(field.type)
        ) {
            attempt('forms');
        }
    });
    // A submission nobody handled would hit form-action 'none' and show an error page.
    addEventListener('submit', (event) => {
        if (!event.defaultPrevented) event.preventDefault();
    });
    document.addEventListener('securitypolicyviolation', (event) => {
        if (event.blockedURI === 'eval' || event.blockedURI === 'wasm-eval') attempt('eval');
        else if (/^(https?|wss?):/.test(event.blockedURI)) attempt('external');
    });

    return {
        replay() {
            for (const permission of attempted) post({ type: 'loupe:attempt', permission });
        },
    };
}
