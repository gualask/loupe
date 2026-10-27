import { IconLogout, IconSelector, IconUsers } from '@tabler/icons-preact';
import { type ComponentChildren, Fragment } from 'preact';
import { useLocation } from 'preact-iso';
import type { User } from '../../shared/api/auth.ts';
import { ROLE_LABELS } from '../lib/format.ts';
import { currentUser, logout } from '../lib/session.ts';
import { useWorkspaceOwners, type Workspace, workspaceHref } from '../lib/workspaces.ts';
import { Badge } from '../ui/Badge.tsx';
import { Logo } from '../ui/Logo.tsx';
import { Menu, type MenuItem } from '../ui/Menu.tsx';
import { ICON, TOP_BAR_CLASS } from '../ui/styles.ts';
import { Avatar } from './Avatar.tsx';

/** A page above the current one, linked from the top bar. */
type Crumb = { href: string; label: string };

/** The workspace a page belongs to, as the first step of its path. */
function workspaceCrumb(workspace: Workspace, me: User): Crumb {
    // Editors only ever see their own.
    if (me.role !== 'admin') return { href: '/', label: 'Workspace' };
    if (workspace === 'all') return { href: workspaceHref('all', me.id), label: 'All workspaces' };
    return {
        href: workspaceHref(workspace.id, me.id),
        label: workspace.id === me.id ? 'My workspace' : workspace.displayName,
    };
}

/** For admins, next to the workspace in the path: opens any other one. */
function WorkspaceSwitcher({ current, me }: { current: Workspace; me: User }) {
    const { route } = useLocation();
    const owners = useWorkspaceOwners(true);
    const currentId = current === 'all' ? 'all' : current.id;

    const choice = (label: string, owner: string, separate = false): MenuItem => ({
        label,
        id: owner,
        checked: owner === currentId,
        separate,
        onSelect: () => route(workspaceHref(owner, me.id)),
    });
    const others = (owners ?? [])
        .filter((owner) => owner.id !== me.id)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return (
        <Menu
            label="Switch workspace"
            icon={<IconSelector size={ICON.md} />}
            align="start"
            items={[
                choice('My workspace', me.id),
                choice('All workspaces', 'all'),
                ...others.map((owner, i) => choice(owner.displayName, owner.id, i === 0)),
            ]}
        />
    );
}

/** The signed-in user's avatar, opening who they are and what concerns their account. */
function AccountMenu({ user }: { user: User }) {
    const { route } = useLocation();

    async function signOut() {
        await logout();
        route('/login');
    }

    const items: MenuItem[] = [
        {
            label: 'Sign out',
            icon: <IconLogout size={ICON.md} />,
            separate: true,
            onSelect: () => void signOut(),
        },
    ];
    if (user.role === 'admin') {
        items.unshift({
            label: 'Users',
            icon: <IconUsers size={ICON.md} />,
            onSelect: () => route('/admin/users'),
        });
    }

    return (
        <Menu
            label={`Account: ${user.displayName}`}
            variant="avatar"
            size="md"
            // The same avatar an editor has in review spaces.
            icon={<Avatar author={{ kind: 'editor', ...user }} size="lg" />}
            header={
                <>
                    <div class="flex items-center gap-2">
                        <p class="truncate font-medium text-sm text-stone-900">
                            {user.displayName}
                        </p>
                        <Badge>{ROLE_LABELS[user.role]}</Badge>
                    </div>
                    <p class="truncate text-stone-500 text-xs">@{user.username}</p>
                </>
            }
            items={items}
        />
    );
}

/**
 * Layout for signed-in pages: a full-width top bar with the path to the page and the account menu.
 * Pages inside a workspace pass it once known, with `trail`, the pages between the workspace and
 * them (the page shows its own title); the path starts from the workspace, where admins can switch
 * to another. With `fitScreen`, wide screens get a page exactly as tall as the window, which the
 * page fills instead of scrolling.
 */
export function AppShell({
    workspace,
    trail = [],
    fitScreen = false,
    children,
}: {
    workspace?: Workspace;
    trail?: Crumb[];
    fitScreen?: boolean;
    children: ComponentChildren;
}) {
    const user = currentUser.value;
    const crumbs = user && workspace ? [workspaceCrumb(workspace, user), ...trail] : [];
    const switcher =
        user?.role === 'admin' && workspace ? (
            <WorkspaceSwitcher current={workspace} me={user} />
        ) : null;

    return (
        <div class={`flex min-h-dvh flex-col ${fitScreen ? 'lg:h-dvh' : ''}`}>
            <header class={`flex items-center gap-4 ${TOP_BAR_CLASS}`}>
                <nav aria-label="Breadcrumb" class="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <a href="/" class="shrink-0">
                        <Logo />
                    </a>
                    {crumbs.map(({ href, label }, i) => (
                        <Fragment key={href}>
                            <span aria-hidden="true" class="text-stone-300">
                                /
                            </span>
                            {/* Farther pages give way first, so the parent stays readable. */}
                            <span
                                class={`flex min-w-8 items-center gap-0.5 ${i < crumbs.length - 1 ? 'shrink-[3]' : ''}`}
                            >
                                <a href={href} class="truncate text-stone-600 hover:text-stone-900">
                                    {label}
                                </a>
                                {i === 0 ? switcher : null}
                            </span>
                        </Fragment>
                    ))}
                </nav>
                {user ? <AccountMenu user={user} /> : null}
            </header>
            <main class="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
    );
}
