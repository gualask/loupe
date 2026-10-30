// Turns an uploaded mockup into the document served inside the sandboxed iframe.
// See docs/SPEC.md §4.1 and §4.2; these headers are a security boundary.

import { type MockupPermissions, mockupSandbox } from '../../shared/mockup-permissions.ts';
import type { Config } from '../config.ts';

/**
 * What the document may load and run. Self-contained by default: nothing from the network, no
 * requests, no eval. Each permission opens only its own part.
 */
function resourcePolicy({ external, eval: evaluate }: MockupPermissions) {
    const https = external ? ' https:' : '';
    const evalSources = evaluate ? " 'unsafe-eval' 'wasm-unsafe-eval'" : '';
    return [
        "default-src 'none'",
        `script-src 'unsafe-inline'${evalSources} data: blob:${https}`,
        `style-src 'unsafe-inline' data:${https}`,
        `img-src data: blob:${https}`,
        `font-src data:${https}`,
        `media-src data: blob:${https}`,
        // https: does not cover wss: (CSP level 3), so WebSockets are named apart.
        external ? 'connect-src https: wss:' : "connect-src 'none'",
        ...(external ? ['frame-src https:'] : []),
        // Even with allow-forms a submission goes nowhere: the mockup's own script handles it.
        "form-action 'none'",
    ];
}

export function mockupHeaders({ mockupPermissions, publicUrl }: Config) {
    // Only the app frames mockups. 'self' is the document's URL, but browsers have resolved it
    // differently in sandboxed documents, so the app's origin is named too.
    const framing = `frame-ancestors 'self' ${publicUrl}`;
    const policy = [
        // Without allow-same-origin the document gets an opaque origin.
        `sandbox ${mockupSandbox(mockupPermissions)}`,
        ...resourcePolicy(mockupPermissions),
        framing,
    ];
    return {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': policy.join('; '),
        // The iframe grants clipboard writes only when allowed; this holds even if it did not.
        ...(mockupPermissions.clipboard ? {} : { 'Permissions-Policy': 'clipboard-write=()' }),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'private, no-cache',
    };
}

/** Inlines the bridge script as the first element of <head>, so it runs before mockup code. */
export function injectBridge(html: string, bridgeScript: string) {
    if (!bridgeScript) return html;
    // A literal "</script" inside the bundle would end the inline script early.
    const tag = `<script>${bridgeScript.replaceAll('</script', '<\\/script')}</script>`;
    // Insert after the first opening tag found, never before the doctype (that would force
    // quirks mode).
    for (const pattern of [/<head\b[^>]*>/i, /<html\b[^>]*>/i, /<!doctype[^>]*>/i]) {
        const match = pattern.exec(html);
        if (match) {
            const end = match.index + match[0].length;
            return html.slice(0, end) + tag + html.slice(end);
        }
    }
    return tag + html;
}
