import type { ComponentChildren } from 'preact';

/** The bar above each mockup while comparing: which version it shows. */
export function PaneBar({ children }: { children: ComponentChildren }) {
    return (
        <div class="flex h-12 shrink-0 items-center gap-2 border-stone-200 border-b bg-white px-3">
            {children}
        </div>
    );
}

/**
 * A mockup document at the preview width (null fills the pane), scrolling within its pane. A
 * width wider than the pane keeps its size and scrolls sideways, so the preview stays true.
 */
export function Preview({
    width,
    children,
}: {
    width: number | null;
    children: ComponentChildren;
}) {
    return (
        <div class="flex min-h-0 min-w-0 flex-1 justify-center-safe overflow-auto">
            <div
                class="h-full shrink-0 bg-white shadow-sm"
                style={{ width: width ? `${width}px` : '100%' }}
            >
                {children}
            </div>
        </div>
    );
}
