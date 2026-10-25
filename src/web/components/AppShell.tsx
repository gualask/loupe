import { IconLogout, IconZoomScan } from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';
import { useLocation } from 'preact-iso';
import { currentUser, logout } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';

function NavLink({
    href,
    sections = [],
    children,
}: {
    href: string;
    /** Path prefixes, besides `href`, that belong to this entry. */
    sections?: string[];
    children: ComponentChildren;
}) {
    const { path } = useLocation();
    const active = [href, ...sections].some((p) => path === p || path.startsWith(`${p}/`));
    return (
        <a
            href={href}
            aria-current={active ? 'page' : undefined}
            class={`rounded-md px-3 py-1.5 text-sm ${active ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-600 hover:text-stone-900'}`}
        >
            {children}
        </a>
    );
}

/**
 * Layout for signed-in pages: full-width top bar with navigation and the user menu. With
 * `fitScreen`, wide screens get a page exactly as tall as the window, which the page fills
 * instead of scrolling.
 */
export function AppShell({
    fitScreen = false,
    children,
}: {
    fitScreen?: boolean;
    children: ComponentChildren;
}) {
    const user = currentUser.value;
    const { route } = useLocation();

    async function signOut() {
        await logout();
        route('/login');
    }

    return (
        <div
            class={`flex min-h-dvh flex-col bg-stone-50 text-stone-900 ${fitScreen ? 'lg:h-dvh' : ''}`}
        >
            <header class="flex h-14 shrink-0 items-center gap-4 border-stone-200 border-b bg-white px-4 sm:px-6 lg:px-8">
                <a href="/" class="flex items-center gap-2 font-semibold">
                    <IconZoomScan size={22} stroke={1.75} />
                    Loupe
                </a>
                <nav class="flex gap-1">
                    <NavLink href="/" sections={['/projects', '/mockups']}>
                        Workspace
                    </NavLink>
                    {user?.role === 'admin' && <NavLink href="/admin/users">Users</NavLink>}
                </nav>
                <div class="ml-auto flex items-center gap-2">
                    <span class="hidden text-sm text-stone-600 sm:inline">{user?.displayName}</span>
                    <Button variant="ghost" onClick={() => void signOut()} aria-label="Sign out">
                        <IconLogout size={18} />
                    </Button>
                </div>
            </header>
            <main class="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
    );
}
