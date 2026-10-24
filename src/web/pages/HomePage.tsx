import { IconZoomScan } from '@tabler/icons-preact';

export function HomePage() {
    return (
        <main class="grid min-h-dvh place-items-center bg-stone-50 text-stone-900">
            <div class="flex flex-col items-center gap-3 text-center">
                <IconZoomScan size={40} stroke={1.5} />
                <h1 class="font-semibold text-2xl tracking-tight">Loupe</h1>
                <p class="text-stone-500">Pinned feedback on HTML mockups. Work in progress.</p>
            </div>
        </main>
    );
}
