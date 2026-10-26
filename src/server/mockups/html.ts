const MAX_REPORTED_REFS = 50;

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
