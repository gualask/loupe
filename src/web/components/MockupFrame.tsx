import { IconRefresh } from '@tabler/icons-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
    type MockupPermissions,
    mockupFrameAllow,
    mockupSandbox,
} from '../../shared/mockup-permissions.ts';
import type { Bridge } from '../lib/bridge.ts';
import { Button } from '../ui/Button.tsx';
import { ICON, TEXT } from '../ui/styles.ts';

// How long a loaded frame may leave its bridge silent before it counts as lost.
const LOST_AFTER_MS = 2000;

/**
 * Embeds a mockup document with the sandbox the server serves it with, connected to `bridge`.
 * Never add allow-same-origin to the sandbox: the mockup must keep its opaque origin
 * (docs/SPEC.md §4.1). A frame whose bridge does not answer after a load is lost, e.g. on the
 * error page of a site the mockup took it to: it is covered, with a way back to the mockup.
 */
export function MockupFrame({
    src,
    title,
    permissions,
    bridge,
    class: className,
}: {
    src: string;
    title: string;
    permissions: MockupPermissions;
    bridge: Bridge;
    class?: string;
}) {
    // Kept by the frame, so a new frame, e.g. of another version, starts afresh.
    const [lost, setLost] = useState(false);
    const lostTimer = useRef(0);

    // Every answer of the bridge shows the mockup is there.
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each new connection.
    useEffect(() => {
        clearTimeout(lostTimer.current);
        setLost(false);
    }, [bridge.connection]);
    useEffect(() => () => clearTimeout(lostTimer.current), []);

    function onLoad() {
        clearTimeout(lostTimer.current);
        lostTimer.current = window.setTimeout(() => setLost(true), LOST_AFTER_MS);
        bridge.ping();
    }

    function reload() {
        setLost(false);
        // Setting the address again loads it, wherever the frame went since.
        if (bridge.frame.current) bridge.frame.current.src = src;
    }

    return (
        <div class={`relative ${className ?? ''}`}>
            <iframe
                ref={bridge.frame}
                onLoad={onLoad}
                src={src}
                title={title}
                sandbox={mockupSandbox(permissions)}
                allow={mockupFrameAllow(permissions)}
                referrerpolicy="no-referrer"
                class="block h-full w-full border-0 bg-white"
            />
            {lost ? (
                <div class="absolute inset-0 grid place-items-center bg-white p-6 text-center">
                    <div class="flex max-w-sm flex-col items-center gap-3">
                        <p class={TEXT.secondary}>
                            The mockup could not be shown here. It may have tried to open another
                            page.
                        </p>
                        <Button variant="secondary" size="sm" onClick={reload}>
                            <IconRefresh size={ICON.md} />
                            Reload mockup
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
