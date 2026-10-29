import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { shareActor } from '../review/context.ts';
import type { Hub } from '../review/hub.ts';
import type { ShareAccess } from '../review/share-access.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** The event stream of a share link's current version (docs/SPEC.md §5.2), mounted under /api/s. */
export function eventRoutes({ db, hub, access }: AppDeps & { hub: Hub; access: ShareAccess }) {
    return new Hono<AppEnv>().get('/:token/events', (c) => {
        const row = access.currentVersion(c);
        const participant = shareActor(db, c, row)?.author ?? null;
        // Reverse proxies such as nginx would otherwise hold events back in their buffer.
        c.header('X-Accel-Buffering', 'no');
        return streamSSE(c, async (stream) => {
            // Until the client leaves, or the hub ends the stream because the link no longer
            // gives access to this version.
            const ended = Promise.withResolvers<void>();
            stream.onAbort(ended.resolve);
            const leave = hub.join(row.version.id, {
                participant,
                token: row.mockup.shareToken,
                send: (event) => {
                    stream.writeSSE({ data: JSON.stringify(event) }).catch(() => undefined);
                },
                heartbeat: () => {
                    stream.write(': heartbeat\n\n').catch(() => undefined);
                },
                end: ended.resolve,
            });
            await ended.promise;
            leave();
        });
    });
}
