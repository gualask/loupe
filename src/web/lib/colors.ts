import type { Author } from '../../shared/api/reviews.ts';

/** One color per viewer, by arrival order; the server hands out VIEWER_COLORS indexes. */
const VIEWER_PALETTE = [
    '#e11d48',
    '#ea580c',
    '#ca8a04',
    '#65a30d',
    '#059669',
    '#0d9488',
    '#0891b2',
    '#2563eb',
    '#4f46e5',
    '#7c3aed',
    '#c026d3',
    '#db2777',
];

const EDITOR_COLOR = '#292524';

export function authorColor(author: Author) {
    return author.kind === 'editor'
        ? EDITOR_COLOR
        : (VIEWER_PALETTE[author.colorIndex % VIEWER_PALETTE.length] ?? EDITOR_COLOR);
}

export function initials(name: string) {
    const words = name.trim().split(/\s+/);
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}
