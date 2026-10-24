import type { RefObject } from 'preact';

/**
 * Embeds a mockup document. Never add allow-same-origin to the sandbox: the mockup must keep its
 * opaque origin (docs/SPEC.md §4.1).
 */
export function MockupFrame({
    src,
    title,
    class: className,
    frameRef,
    onLoad,
}: {
    src: string;
    title: string;
    class?: string;
    frameRef?: RefObject<HTMLIFrameElement | null>;
    onLoad?: () => void;
}) {
    return (
        <iframe
            ref={frameRef}
            onLoad={onLoad}
            src={src}
            title={title}
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
            class={`block border-0 bg-white ${className ?? ''}`}
        />
    );
}
