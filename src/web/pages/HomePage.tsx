import { AppShell } from '../components/AppShell.tsx';

export function HomePage() {
    return (
        <AppShell>
            <h1 class="font-semibold text-2xl tracking-tight">Workspace</h1>
            <p class="mt-2 text-stone-500">Projects and mockups will appear here.</p>
        </AppShell>
    );
}
