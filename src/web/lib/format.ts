import type { Role } from '../../shared/api/auth.ts';

export const ROLE_LABELS: Record<Role, string> = { editor: 'Editor', admin: 'Admin' };

export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// English like the rest of the UI (localization is on the roadmap).
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday", then a date. */
export function formatRelative(iso: string) {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    if (Math.abs(seconds) < 60) return 'just now';
    if (Math.abs(seconds) < 3600) return relative.format(Math.round(seconds / 60), 'minute');
    if (Math.abs(seconds) < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
    if (Math.abs(seconds) < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
    return formatDate(iso);
}

/** "1 mockup", "3 mockups"; `many` for irregular plurals ("replies"). */
export function plural(count: number, one: string, many = `${one}s`) {
    return `${count} ${count === 1 ? one : many}`;
}
