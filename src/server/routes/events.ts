import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { findSharedMockup, shareActor } from '../review/context.ts';
import type { Hub } from '../review/hub.ts';
import type { ShareAccess } from '../review/share-access.ts';
import type { AppDeps, AppEnv } from '../types.ts';

// Keeps idle connections open through proxies that drop silent ones, and is when an open stream
// notices that its link was disabled, regenerated or has expired.
const HEARTBEAT_MS = 25_000;

/** The event stream of a share link's current version (docs/SPEC.md §5.2), mounted under /api/s. */
export function eventRoutes({ db, hub, access }: AppDeps & { hub: Hub; access: ShareAccess }) {
    return new Hono<AppEnv>().get('/:token/events', (c) => {
        const row = access.currentVersion(c);
        const participant = shareActor(db, c, row)?.author ?? null;
        // Reverse proxies such as nginx would otherwise hold events back in their buffer.
        c.header('X-Accel-Buffering', 'no');
        return streamSSE(c, async (stream) => {
            const leave = hub.join(row.version.id, participant, (event) => {
                stream.writeSSE({ data: JSON.stringify(event) }).catch(() => undefined);
            });
            let heartbeat: ReturnType<typeof setInterval> | undefined;
            // Until the client leaves, or the link stops giving access to this version: the
            // stream then ends, and the client finds the link unavailable when reconnecting.
            await new Promise<void>((resolve) => {
                stream.onAbort(resolve);
                heartbeat = setInterval(() => {
                    if (findSharedMockup(db, c)?.version.id !== row.version.id) resolve();
                    else stream.write(': heartbeat\n\n').catch(() => undefined);
                }, HEARTBEAT_MS);
            });
            clearInterval(heartbeat);
            leave();
        });
    });
}
