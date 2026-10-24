// Turns an uploaded mockup into the document served inside the sandboxed iframe.
// See docs/SPEC.md §4.1 and §4.2; these headers are a security boundary.

const SELF_CONTAINED_POLICY = [
    "default-src 'none'",
    "script-src 'unsafe-inline' data: blob:",
    "style-src 'unsafe-inline' data:",
    'img-src data: blob:',
    'font-src data:',
    'media-src data: blob:',
    "connect-src 'none'",
];

const EXTERNAL_ALLOWED_POLICY = [
    "default-src 'none'",
    "script-src 'unsafe-inline' data: blob: https:",
    "style-src 'unsafe-inline' data: https:",
    'img-src data: blob: https:',
    'font-src data: https:',
    'media-src data: blob: https:',
    "connect-src 'none'",
];

export function mockupHeaders(external: 'block' | 'allow') {
    const policy = external === 'allow' ? EXTERNAL_ALLOWED_POLICY : SELF_CONTAINED_POLICY;
    return {
        'Content-Type': 'text/html; charset=utf-8',
        // `sandbox` without allow-same-origin gives the document an opaque origin.
        'Content-Security-Policy': ['sandbox allow-scripts', ...policy].join('; '),
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
