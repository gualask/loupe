import type { ComponentChildren } from 'preact';
import { useDocumentTitle } from '../lib/document-title.ts';
import { Logo } from './Logo.tsx';
import { CARD_CLASS, TEXT } from './styles.ts';

/** A full-page screen with its content in the middle. */
export function CenteredScreen({ children }: { children: ComponentChildren }) {
    return <main class="grid min-h-dvh place-items-center px-4 py-10">{children}</main>;
}

/** Full-page layout for signed-out screens: logo, title (also of the browser tab) and a card. */
export function CenteredCard({ title, children }: { title: string; children: ComponentChildren }) {
    useDocumentTitle(title);
    return (
        <CenteredScreen>
            <div class="flex w-full max-w-sm flex-col items-center gap-6">
                <Logo />
                <section class={`w-full p-6 shadow-sm ${CARD_CLASS}`}>
                    <h1 class={`mb-5 ${TEXT.title}`}>{title}</h1>
                    {children}
                </section>
            </div>
        </CenteredScreen>
    );
}
