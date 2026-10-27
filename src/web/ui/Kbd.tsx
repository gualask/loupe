/** A key of the keyboard, as the shortcuts help and menus show it. */
export function Kbd({ children }: { children: string }) {
    return (
        <kbd class="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-stone-600 text-xs">
            {children}
        </kbd>
    );
}
