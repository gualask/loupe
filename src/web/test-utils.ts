import { vi } from 'vitest';

/** Stands in for the browser's localStorage, holding `stored`; returns its items. */
export function fakeStorage(stored: Record<string, string> = {}) {
    const items = new Map(Object.entries(stored));
    vi.stubGlobal('localStorage', {
        get length() {
            return items.size;
        },
        key: (index: number) => [...items.keys()][index] ?? null,
        getItem: (name: string) => items.get(name) ?? null,
        setItem: (name: string, value: string) => items.set(name, value),
        removeItem: (name: string) => items.delete(name),
    });
    return items;
}
