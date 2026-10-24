import { IconLogout, IconZoomScan } from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';
import { useLocation } from 'preact-iso';
import { currentUser, logout } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';

function NavLink({ href, children }: { href: string; children: ComponentChildren }) {
    const { path } = useLocation();
    const active = path === href || path.startsWith(`${href}/`);
    return (
        <a
            href={href}
            class={`rounded-md px-3 py-1.5 text-sm ${active ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-600 hover:text-stone-900'}`}
        >
            {children}
        </a>
    );
}

/** Layout for signed-in pages: top bar with navigation and the user menu. */
export function AppShell({ children }: { children: ComponentChildren }) {
    const user = currentUser.value;
    const { route } = useLocation();

    async function signOut() {
        await logout();
        route('/login');
    }

    return (
        <div class="min-h-dvh bg-stone-50 text-stone-900">
            <header class="border-stone-200 border-b bg-white">
                <div class="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
                    <a href="/" class="flex items-center gap-2 font-semibold">
                        <IconZoomScan size={22} stroke={1.75} />
                        Loupe
                    </a>
                    <nav class="flex gap-1">
                        <NavLink href="/">Workspace</NavLink>
                        {user?.role === 'admin' && <NavLink href="/admin/users">Users</NavLink>}
                    </nav>
                    <div class="ml-auto flex items-center gap-2">
                        <span class="hidden text-sm text-stone-600 sm:inline">
                            {user?.displayName}
                        </span>
                        <Button
                            variant="ghost"
                            onClick={() => void signOut()}
                            aria-label="Sign out"
                        >
                            <IconLogout size={18} />
                        </Button>
                    </div>
                </div>
            </header>
            <main class="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </div>
    );
}
