import { IconZoomScan } from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';

/** Full-page layout for signed-out screens: logo, title and a card. */
export function CenteredCard({ title, children }: { title: string; children: ComponentChildren }) {
    return (
        <main class="grid min-h-dvh place-items-center bg-stone-50 px-4 py-10 text-stone-900">
            <div class="flex w-full max-w-sm flex-col items-center gap-6">
                <div class="flex items-center gap-2 font-semibold text-lg">
                    <IconZoomScan size={24} stroke={1.75} />
                    Loupe
                </div>
                <section class="w-full rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                    <h1 class="mb-5 font-semibold text-xl tracking-tight">{title}</h1>
                    {children}
                </section>
            </div>
        </main>
    );
}
