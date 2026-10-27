import { IconZoomScan } from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';
import { CARD_CLASS } from './styles.ts';

/** A full-page screen with its content in the middle. */
export function CenteredScreen({ children }: { children: ComponentChildren }) {
    return <main class="grid min-h-dvh place-items-center px-4 py-10">{children}</main>;
}

/** Full-page layout for signed-out screens: logo, title and a card. */
export function CenteredCard({ title, children }: { title: string; children: ComponentChildren }) {
    return (
        <CenteredScreen>
            <div class="flex w-full max-w-sm flex-col items-center gap-6">
                <div class="flex items-center gap-2 font-semibold text-lg">
                    <IconZoomScan size={24} stroke={1.75} />
                    Loupe
                </div>
                <section class={`w-full p-6 shadow-sm ${CARD_CLASS}`}>
                    <h1 class="mb-5 font-semibold text-xl tracking-tight">{title}</h1>
                    {children}
                </section>
            </div>
        </CenteredScreen>
    );
}
