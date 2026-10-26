import { computed, signal } from '@preact/signals';
import type { PinAnchor } from '../../shared/anchor.ts';
import type { SharedMockup } from '../../shared/api/projects.ts';
import {
    type Author,
    type Comment,
    type RegisteredViewer,
    type Review,
    type ShareEvent,
    type Thread,
    VERSION_HEADER,
    VIEWER_KEY_HEADER,
} from '../../shared/api/reviews.ts';
import { ApiError, api, errorMessage } from '../lib/api.ts';
import { openEventStream } from '../lib/event-stream.ts';
import { storage } from '../lib/storage.ts';

const MAX_RETRY_MS = 30_000;

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline';

// The viewer key belongs to the mockup, so it survives a regenerated link. Remembering which
// mockup a link opens lets the first request already carry the key.
const viewerKeyName = (mockupId: string) => `loupe:viewer:${mockupId}`;
const linkMockupName = (token: string) => `loupe:link:${token}`;
// The name a viewer chose, used again on the next mockups they comment on.
const NAME_KEY = 'loupe:name';
// Set once the viewer closed the hint inviting them to choose a name, or chose one.
const NAME_HINT_KEY = 'loupe:name-hint';
// Set when unsent text was moved to the general comment box, to offer it after the reload.
const keptTextName = (mockupId: string) => `loupe:kept:${mockupId}`;

/** Unsent text of a box: the general comment box (`general`) or a thread's reply box. */
export const draftName = (mockupId: string, box: string) => `loupe:draft:${mockupId}:${box}`;

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

function sortByCreation<T extends { createdAt: string }>(items: T[]) {
    return items.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const visible = (thread: Thread) => thread.comments.some((c) => !c.deleted);

/**
 * Client state of a review space: threads, presence and the viewer's own review, kept in sync
 * through the event stream. Every change is applied optimistically and retried while offline
 * (docs/SPEC.md §5.1).
 */
export function createReviewSession(
    token: string,
    initial: SharedMockup,
    initialKey: string | null,
) {
    const base = `/s/${token}`;
    const shared = signal(initial);
    const threads = signal<Thread[]>([]);
    const presence = signal<Author[]>([]);
    const saveState = signal<SaveState>('idle');
    const error = signal<string>();
    /** Set when the link stops giving access, e.g. disabled, regenerated or expired. */
    const unavailable = signal(false);
    /** Set once a newer version was uploaded: this space shows a file reviewers moved on from. */
    const outdated = signal(false);
    /** Whether to invite the viewer to replace the generated name they were given. */
    const nameHint = signal(false);
    /** Set when the general comment box holds text that could not be sent before a reload. */
    const keptText = signal(false);
    let key = initialKey;
    let joining: Promise<boolean> | undefined;
    let pending = 0;
    // Changes are sent one at a time, in order: a reply must not reach the server before its
    // thread, even when both were retried while offline.
    let queue: Promise<unknown> = Promise.resolve();
    // Set by a rejected change; the server state is reloaded once nothing else is pending, so
    // the reload does not drop changes that are still queued.
    let resync = false;

    const me = computed(() => shared.value.me);
    /** Whether changes are accepted here at all; a viewer may first need an identity. */
    const mayWrite = computed(
        () => !outdated.value && (shared.value.canModerate || !shared.value.readOnly),
    );
    /** Whether this browser can change things right now: writing is open and it has an identity. */
    const canWrite = computed(() => !!me.value && mayWrite.value);
    const headers = (): Record<string, string> => ({
        [VERSION_HEADER]: String(shared.value.version),
        ...(key && { [VIEWER_KEY_HEADER]: key }),
    });

    function upsert(thread: Thread) {
        const others = threads.value.filter((t) => t.id !== thread.id);
        threads.value = sortByCreation(visible(thread) ? [...others, thread] : others);
    }

    function patchThread(id: string, change: (thread: Thread) => Thread) {
        const thread = threads.value.find((t) => t.id === id);
        if (thread) upsert(change(thread));
    }

    let recovered = false;
    async function refresh() {
        threads.value = await api.get<Thread[]>(`${base}/threads`, headers());
        // Not from a space left on an older version: its threads are not the current ones.
        if (!recovered && !outdated.value) {
            recovered = true;
            recoverDrafts();
        }
    }

    /** Keeps text that cannot be sent from here in the general comment box, for after a reload. */
    function keepText(text: string) {
        const general = draftName(shared.value.mockupId, 'general');
        const kept = storage.get(general)?.trim();
        storage.set(general, kept ? `${kept}\n\n${text}` : text);
        storage.set(keptTextName(shared.value.mockupId), 'yes');
    }

    /**
     * Moves the reply drafts of threads that are no longer listed, e.g. those of the previous
     * version, into the general comment box, and reports text kept there before the reload.
     */
    function recoverDrafts() {
        const { mockupId } = shared.value;
        const prefix = draftName(mockupId, '');
        const listed = new Set(threads.value.map((t) => t.id));
        for (const name of storage.names(prefix)) {
            const box = name.slice(prefix.length);
            if (box === 'general' || listed.has(box)) continue;
            const text = storage.get(name)?.trim();
            storage.remove(name);
            if (text) keepText(text);
        }
        if (storage.get(keptTextName(mockupId))) {
            storage.remove(keptTextName(mockupId));
            keptText.value = true;
        }
    }

    /** Sends one change, retrying network failures; undefined when the server rejects it. */
    async function attempt<T>(send: () => Promise<T>): Promise<T | undefined> {
        let delay = 1000;
        for (;;) {
            try {
                return await send();
            } catch (err) {
                if (err instanceof ApiError) {
                    // An editor's session ended: sign in again, then come back here.
                    if (err.status === 401 && me.value?.kind === 'editor') {
                        const here = location.pathname + location.search;
                        location.assign(`/login?next=${encodeURIComponent(here)}`);
                        return undefined;
                    }
                    // A newer version is shown as a notice to reload rather than as an error.
                    if (err.code === 'version_changed') outdated.value = true;
                    else error.value = errorMessage(err);
                    resync = true;
                    return undefined;
                }
                saveState.value = 'offline';
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, MAX_RETRY_MS);
                saveState.value = 'saving';
            }
        }
    }

    /** Queues a change after the pending ones; API errors resync from the server. */
    function perform<T>(send: () => Promise<T>): Promise<T | undefined> {
        pending++;
        // Queued behind a change that is waiting for the network: still offline.
        if (saveState.value !== 'offline') saveState.value = 'saving';
        const result = queue.then(() => attempt(send));
        queue = result;
        return result.finally(async () => {
            pending--;
            if (pending) return;
            if (resync) {
                resync = false;
                await refresh().catch(() => undefined);
            }
            saveState.value = error.value || outdated.value ? 'idle' : 'saved';
        });
    }

    function newComment(threadId: string, body: string): Comment {
        const author = me.value;
        if (!author) throw new Error('commenting requires an identity');
        return {
            id: crypto.randomUUID(),
            threadId,
            author,
            body,
            createdAt: new Date().toISOString(),
            editedAt: null,
            deleted: false,
        };
    }

    function setReview(review: Review) {
        if (me.value?.kind === 'viewer' && review.viewerId === me.value.id) {
            shared.value = { ...shared.value, review };
        }
    }

    function handleEvent(event: ShareEvent) {
        if (event.type === 'thread') upsert(event.thread);
        else if (event.type === 'thread-deleted') {
            threads.value = threads.value.filter((t) => t.id !== event.id);
        } else if (event.type === 'presence') presence.value = event.participants;
        else if (event.type === 'review') setReview(event.review);
    }

    /** Applies the server's copy of a saved thread; resolves to whether the change was saved. */
    async function applySaved(saved: Promise<Thread | undefined>) {
        const thread = await saved;
        if (thread) upsert(thread);
        return !!thread;
    }

    let closeStream: (() => void) | undefined;

    async function register(displayName: string) {
        const res = await api.post<RegisteredViewer>(`${base}/viewers`, { displayName });
        key = res.key;
        storage.set(viewerKeyName(shared.value.mockupId), res.key);
        shared.value = { ...shared.value, me: res.viewer };
        connect();
    }

    function dismissNameHint() {
        nameHint.value = false;
        storage.set(NAME_HINT_KEY, 'dismissed');
    }

    /** (Re)opens the event stream; called again once the viewer has an identity. */
    function connect() {
        closeStream?.();
        closeStream = openEventStream<ShareEvent>(`/api${base}/events`, headers(), {
            // Events missed while disconnected are recovered by refetching.
            onOpen: () => void refresh().catch(() => undefined),
            onEvent: handleEvent,
            onRefused: (code) => {
                if (code === 'version_changed') outdated.value = true;
                else unavailable.value = true;
            },
        });
    }

    return {
        shared,
        threads,
        presence,
        saveState,
        error,
        unavailable,
        outdated,
        nameHint,
        keptText,
        me,
        mayWrite,
        canWrite,
        connect,
        disconnect: () => closeStream?.(),

        /**
         * Gives a viewer without an identity one, under the name they chose before or a
         * generated one; resolves to whether this browser can now act as someone.
         */
        join() {
            if (me.value) return Promise.resolve(true);
            joining ??= (async () => {
                const remembered = storage.get(NAME_KEY);
                try {
                    await register(remembered ?? '');
                    if (!remembered && !storage.get(NAME_HINT_KEY)) nameHint.value = true;
                    return true;
                } catch (err) {
                    error.value = errorMessage(err);
                    return false;
                } finally {
                    joining = undefined;
                }
            })();
            return joining;
        },

        /** Sets the viewer's name, registering them if needed, and remembers it for next time. */
        async setName(displayName: string) {
            // A join under way would otherwise register a second viewer.
            await joining;
            if (me.value?.kind === 'viewer') {
                const viewer = await api.patch<Author>(
                    `${base}/viewers/me`,
                    { displayName },
                    headers(),
                );
                shared.value = { ...shared.value, me: viewer };
            } else {
                await register(displayName);
            }
            storage.set(NAME_KEY, me.value?.displayName ?? displayName);
            dismissNameHint();
        },

        dismissNameHint,

        createThread(
            input: { kind: 'pin'; anchor: PinAnchor } | { kind: 'general' },
            body: string,
        ) {
            const id = crypto.randomUUID();
            const comment = newComment(id, body);
            upsert({
                id,
                kind: input.kind,
                // Numbered by the server.
                number: null,
                anchor: input.kind === 'pin' ? input.anchor : null,
                status: 'open',
                resolvedAt: null,
                author: comment.author,
                createdAt: comment.createdAt,
                comments: [comment],
            });
            return applySaved(
                perform(() =>
                    api.post<Thread>(`${base}/threads`, { id, ...input, body }, headers()),
                ),
            ).then((saved) => {
                // A new pin's text has no draft of its own: keep it for after the reload. The
                // general comment box keeps its draft until the comment is saved.
                if (!saved && outdated.value) {
                    if (input.kind === 'pin') keepText(body);
                    else storage.set(keptTextName(shared.value.mockupId), 'yes');
                }
                return saved;
            });
        },

        reply(threadId: string, body: string) {
            const comment = newComment(threadId, body);
            patchThread(threadId, (t) => ({ ...t, comments: [...t.comments, comment] }));
            return applySaved(
                perform(() =>
                    api.post<Thread>(
                        `${base}/threads/${threadId}/comments`,
                        { id: comment.id, body },
                        headers(),
                    ),
                ),
            );
        },

        edit(comment: Comment, body: string) {
            const editedAt = new Date().toISOString();
            patchThread(comment.threadId, (t) => ({
                ...t,
                comments: t.comments.map((c) =>
                    c.id === comment.id ? { ...c, body, editedAt } : c,
                ),
            }));
            return applySaved(
                perform(() =>
                    api.patch<Thread>(`${base}/comments/${comment.id}`, { body }, headers()),
                ),
            );
        },

        remove(comment: Comment) {
            patchThread(comment.threadId, (t) => ({
                ...t,
                comments: t.comments.map((c) =>
                    c.id === comment.id ? { ...c, body: '', deleted: true } : c,
                ),
            }));
            void perform(() =>
                api.delete(`${base}/comments/${comment.id}`, headers()).catch((err) => {
                    // A retry after a lost response: the comment is already gone.
                    if (!(err instanceof ApiError && err.status === 404)) throw err;
                }),
            );
        },

        setStatus(threadId: string, status: Thread['status']) {
            patchThread(threadId, (t) => ({
                ...t,
                status,
                resolvedAt: status === 'resolved' ? new Date().toISOString() : null,
            }));
            void perform(() =>
                api.patch<Thread>(`${base}/threads/${threadId}`, { status }, headers()),
            ).then((thread) => thread && upsert(thread));
        },

        async submitReview(input: { verdict: Review['verdict']; summary: string }) {
            const review = await perform(() => api.put<Review>(`${base}/review`, input, headers()));
            if (review) setReview(review);
            return !!review;
        },
    };
}

export type ReviewSession = ReturnType<typeof createReviewSession>;
