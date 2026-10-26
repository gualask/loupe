import { type Signal, signal } from '@preact/signals';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { type Author, type RegisteredViewer, VIEWER_KEY_HEADER } from '../../shared/api/reviews.ts';
import { api, errorMessage } from '../lib/api.ts';
import { storage } from '../lib/storage.ts';

// The viewer key belongs to the mockup, so it survives a regenerated link. Remembering which
// mockup a link opens lets the first request already carry the key.
const viewerKeyName = (mockupId: string) => `loupe:viewer:${mockupId}`;
const linkMockupName = (token: string) => `loupe:link:${token}`;
// The name a viewer chose, used again on the next mockups they comment on.
const NAME_KEY = 'loupe:name';
// Set once the viewer closed the hint inviting them to choose a name, or chose one.
const NAME_HINT_KEY = 'loupe:name-hint';

/**
 * Loads a share link as the current browser sees it: editors through their session, viewers
 * through the viewer key stored for that mockup.
 */
export async function loadSharedMockup(token: string) {
    const knownMockupId = storage.get(linkMockupName(token));
    const sentKey = knownMockupId ? storage.get(viewerKeyName(knownMockupId)) : null;
    const shared = await api.get<SharedMockup>(
        `/s/${token}`,
        sentKey ? { [VIEWER_KEY_HEADER]: sentKey } : undefined,
    );
    storage.set(linkMockupName(token), shared.mockupId);
    // Editors are recognized by their session; a viewer key is then ignored.
    if (shared.me) return { shared, key: shared.me.kind === 'viewer' ? sentKey : null };

    const key = storage.get(viewerKeyName(shared.mockupId));
    if (!key) return { shared, key: null };
    // Unknown link (e.g. regenerated): identify with the mockup's key now.
    if (key !== sentKey) {
        const identified = await api.get<SharedMockup>(`/s/${token}`, { [VIEWER_KEY_HEADER]: key });
        if (identified.me) return { shared: identified, key };
    }
    // The server no longer knows this key.
    storage.remove(viewerKeyName(shared.mockupId));
    return { shared, key: null };
}

/**
 * Who this browser is on a share link (docs/SPEC.md §4.3). A viewer without an identity joins on
 * their first change, under the name they chose before or a generated one, and may rename
 * themselves; `shared.me` follows both.
 */
export function createIdentity({
    base,
    shared,
    key: initialKey,
    mayAct,
    headers,
    onJoined,
    onError,
}: {
    /** API path of the share link. */
    base: string;
    shared: Signal<SharedMockup>;
    key: string | null;
    /** Whether changes are accepted here at all, e.g. not on a read-only mockup. */
    mayAct: () => boolean;
    /** Headers of a change, with the viewer key. */
    headers: () => Record<string, string>;
    /** Runs once this browser joined, e.g. to reconnect the event stream with the new key. */
    onJoined: () => void;
    /** Reports a failed join, which a first change triggers without a form to show it. */
    onError: (message: string) => void;
}) {
    /** Whether to invite the viewer to replace the generated name they were given. */
    const nameHint = signal(false);
    let key = initialKey;
    let joining: Promise<boolean> | undefined;

    async function register(displayName: string) {
        const res = await api.post<RegisteredViewer>(`${base}/viewers`, { displayName });
        key = res.key;
        storage.set(viewerKeyName(shared.value.mockupId), res.key);
        shared.value = { ...shared.value, me: res.viewer };
        onJoined();
    }

    function dismissNameHint() {
        nameHint.value = false;
        storage.set(NAME_HINT_KEY, 'dismissed');
    }

    return {
        nameHint,
        dismissNameHint,

        /** The viewer key header, once this browser has a key. */
        keyHeader: (): Record<string, string> => (key ? { [VIEWER_KEY_HEADER]: key } : {}),

        /**
         * Gives this browser an identity if it has none yet; resolves to whether it can now act
         * as someone.
         */
        join() {
            if (!mayAct()) return Promise.resolve(false);
            if (shared.value.me) return Promise.resolve(true);
            joining ??= (async () => {
                const remembered = storage.get(NAME_KEY);
                try {
                    await register(remembered ?? '');
                    if (!remembered && !storage.get(NAME_HINT_KEY)) nameHint.value = true;
                    return true;
                } catch (err) {
                    onError(errorMessage(err));
                    return false;
                } finally {
                    joining = undefined;
                }
            })();
            return joining;
        },

        /** Sets the viewer's name, joining if needed, and remembers it for the next mockups. */
        async setName(displayName: string) {
            // A join under way would otherwise register a second viewer.
            await joining;
            if (shared.value.me?.kind === 'viewer') {
                const viewer = await api.patch<Author>(
                    `${base}/viewers/me`,
                    { displayName },
                    headers(),
                );
                shared.value = { ...shared.value, me: viewer };
            } else {
                await register(displayName);
            }
            storage.set(NAME_KEY, shared.value.me?.displayName ?? displayName);
            dismissNameHint();
        },
    };
}
