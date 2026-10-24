// Computing and resolving pin anchors (docs/SPEC.md §4.4).
import type { PinAnchor } from '../shared/anchor.ts';

const TEST_ATTRIBUTES = ['data-testid', 'data-test', 'data-qa', 'data-cy'];
const TEXT_LIMIT = 200;

function normalizedText(el: Element) {
    return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isUnique(selector: string) {
    try {
        return document.querySelectorAll(selector).length === 1;
    } catch {
        return false;
    }
}

/** A unique id or test attribute selector for the element, if it has one. */
function attributeSelector(el: Element) {
    if (el.id && isUnique(`#${CSS.escape(el.id)}`)) return `#${CSS.escape(el.id)}`;
    for (const name of TEST_ATTRIBUTES) {
        const value = el.getAttribute(name);
        const selector = `[${name}="${CSS.escape(value ?? '')}"]`;
        if (value && isUnique(selector)) return selector;
    }
    return undefined;
}

function typeSegment(el: Element) {
    const tag = CSS.escape(el.localName);
    const siblings = el.parentElement
        ? [...el.parentElement.children].filter((c) => c.localName === el.localName)
        : [el];
    return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(el) + 1})` : tag;
}

/** Unique id or test attribute, otherwise the shortest unique `tag:nth-of-type` path. */
function selectorFor(target: Element) {
    const segments: string[] = [];
    for (let el: Element | null = target; el; el = el.parentElement) {
        const attribute = attributeSelector(el);
        if (attribute) return [attribute, ...segments].join(' > ');
        segments.unshift(typeSegment(el));
        const path = segments.join(' > ');
        if (isUnique(path)) return path;
    }
    return segments.join(' > ');
}

export function computeAnchor(el: Element, clientX: number, clientY: number): PinAnchor {
    const rect = el.getBoundingClientRect();
    const fraction = (value: number, size: number) =>
        size ? Math.min(1, Math.max(0, value / size)) : 0.5;
    const text = normalizedText(el).slice(0, TEXT_LIMIT);
    return {
        selector: selectorFor(el),
        offset: {
            x: fraction(clientX - rect.left, rect.width),
            y: fraction(clientY - rect.top, rect.height),
        },
        ...(text && { text }),
        point: { x: Math.round(clientX + scrollX), y: Math.round(clientY + scrollY) },
        viewport: { width: innerWidth, height: innerHeight },
    };
}

/** The innermost element whose text starts with the snippet. */
function findByText(text: string) {
    const candidates = [...document.body.querySelectorAll('*')].filter(
        (el) => !(el instanceof HTMLScriptElement || el instanceof HTMLStyleElement),
    );
    let found: Element | undefined;
    for (const el of candidates) {
        if (normalizedText(el).startsWith(text) && (!found || found.contains(el))) found = el;
    }
    return found;
}

/**
 * The element a stored anchor points to: the selector match when its text still agrees, else
 * a text match, else whatever the selector matched. Undefined means the pin is orphaned.
 */
export function resolveAnchor(anchor: PinAnchor): Element | undefined {
    let bySelector: Element | undefined;
    try {
        bySelector = document.querySelector(anchor.selector) ?? undefined;
    } catch {
        // A selector the current document cannot parse.
    }
    if (!anchor.text || (bySelector && normalizedText(bySelector).startsWith(anchor.text))) {
        return bySelector;
    }
    return findByText(anchor.text) ?? bySelector;
}
