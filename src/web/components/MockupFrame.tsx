/**
 * Embeds a mockup document. Never add allow-same-origin to the sandbox: the mockup must keep its
 * opaque origin (docs/SPEC.md §4.1).
 */
export function MockupFrame({
    src,
    title,
    class: className,
}: {
    src: string;
    title: string;
    class?: string;
}) {
    return (
        <iframe
            src={src}
            title={title}
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
            class={`block border-0 bg-white ${className ?? ''}`}
        />
    );
}
