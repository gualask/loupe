import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Keeps the web app on the scales of styles.ts: a value off the scale fails here instead of
// drifting into one component. Need a new value? Add it to the scale, then use it.
const WEB = path.resolve(import.meta.dirname, '..');

function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) return sources(file);
        return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [file] : [];
    });
}

const RULES: { rule: string; pattern: RegExp; allowedIn?: string[] }[] = [
    { rule: 'icon and avatar sizes come from ICON and AVATAR', pattern: /\bsize=\{\d/ },
    { rule: 'text sizes come from the type scale', pattern: /\btext-\[\d/ },
    {
        rule: 'titles and headings come from TEXT',
        pattern: /\btext-(base|lg|xl|[2-9]xl)\b/,
        allowedIn: ['ui/styles.ts'],
    },
    { rule: 'text takes stone-900, stone-600 or stone-500', pattern: /\btext-stone-(700|800)\b/ },
    { rule: 'dividers inside a surface are stone-100', pattern: /\bdivide-stone-(?!100\b)\d+/ },
    {
        rule: 'only dialogs cast the strongest shadow',
        pattern: /\bshadow-(xl|2xl)\b/,
        allowedIn: ['ui/Dialog.tsx'],
    },
    {
        rule: 'headings are semibold and names medium, nothing bold',
        pattern: /\bfont-(bold|extrabold|black)\b/,
    },
];

describe('design scales', () => {
    const files = sources(WEB).map((file) => ({
        name: path.relative(WEB, file),
        lines: readFileSync(file, 'utf8').split('\n'),
    }));

    it.each(RULES)('$rule', ({ pattern, allowedIn = [] }) => {
        const offenders = files
            .filter(({ name }) => !allowedIn.includes(name))
            .flatMap(({ name, lines }) =>
                lines.flatMap((line, i) => (pattern.test(line) ? [`${name}:${i + 1}`] : [])),
            );
        expect(offenders).toEqual([]);
    });
});
