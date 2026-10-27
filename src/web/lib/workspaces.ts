import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { AdminUser, User } from '../../shared/api/auth.ts';
import type { Project } from '../../shared/api/projects.ts';
import { api } from './api.ts';

/** Whose projects a page shows: one owner's, or every workspace's (admins only). */
export type Workspace = { id: string; displayName: string } | 'all';

/** The page listing the projects of `owner`, or of everyone (`all`). */
export const workspaceHref = (owner: string, me: string) =>
    owner === me ? '/' : `/?owner=${owner}`;

/** Whose projects the workspace page shows: the `?owner=` an admin picked, or one's own. */
export const ownerFromQuery = (owner: string | undefined, me: User) =>
    (me.role === 'admin' && owner) || me.id;

/**
 * The workspace of `owner`, named after its projects or its account; undefined until either
 * is known. An owner neither knows is still named, so the path keeps its switcher.
 */
export function resolveWorkspace(
    owner: string,
    me: User,
    known: { projects?: Project[]; accounts?: AdminUser[] },
): Workspace | undefined {
    if (owner === 'all') return 'all';
    if (owner === me.id) return me;
    const found =
        known.projects?.find((p) => p.owner.id === owner)?.owner ??
        known.accounts?.find((account) => account.id === owner);
    if (found) return found;
    return known.projects && known.accounts ? { id: owner, displayName: 'Unknown' } : undefined;
}

const accounts = signal<AdminUser[] | undefined>(undefined);
let loading = false;

/**
 * The accounts whose workspaces an admin can open; undefined until loaded or when not
 * `enabled`. Refreshed on every page, so new or renamed accounts show up without a reload.
 */
export function useWorkspaceOwners(enabled: boolean) {
    useEffect(() => {
        if (!enabled || loading) return;
        loading = true;
        api.get<AdminUser[]>('/admin/users')
            .then((list) => {
                accounts.value = list;
            })
            // The list kept so far stays; the next page tries again.
            .catch(() => undefined)
            .finally(() => {
                loading = false;
            });
    }, [enabled]);
    return enabled ? accounts.value : undefined;
}
