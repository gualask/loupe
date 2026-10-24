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
    VIEWER_KEY_HEADER,
} from '../../shared/api/reviews.ts';
import { ApiError, api, errorMessage } from '../lib/api.ts';
import { openEventStream } from '../lib/event-stream.ts';
import { storage } from '../lib/storage.ts';

const MAX_RETRY_MS = 30_000;

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline';

const viewerKeyName = (mockupId: string) => `loupe:viewer:${mockupId}`;

/**
 * Loads a share link as the current browser sees it: editors through their session, viewers
 * through the viewer key stored for that mockup.
 */
export async function loadSharedMockup(token: string) {
    const shared = await api.get<SharedMockup>(`/s/${token}`);
    const key = shared.me ? null : storage.get(viewerKeyName(shared.mockupId));
    if (!key) return { shared, key: null };
    const identified = await api.get<SharedMockup>(`/s/${token}`, { [VIEWER_KEY_HEADER]: key });
    if (identified.me) return { shared: identified, key };
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
    let key = initialKey;
    let pending = 0;

    const me = computed(() => shared.value.me);
    const canWrite = computed(
        () => !!me.value && (shared.value.canModerate || !shared.value.readOnly),
    );
    const headers = () => (key ? { [VIEWER_KEY_HEADER]: key } : undefined);

    function upsert(thread: Thread) {
        const others = threads.value.filter((t) => t.id !== thread.id);
        threads.value = sortByCreation(visible(thread) ? [...others, thread] : others);
    }

    function patchThread(id: string, change: (thread: Thread) => Thread) {
        const thread = threads.value.find((t) => t.id === id);
        if (thread) upsert(change(thread));
    }

    async function refresh() {
        threads.value = await api.get<Thread[]>(`${base}/threads`, headers());
    }

    /** Sends a change, retrying network failures; API errors resync from the server. */
    async function perform<T>(send: () => Promise<T>): Promise<T | undefined> {
        pending++;
        saveState.value = 'saving';
        let delay = 1000;
        try {
            for (;;) {
                try {
                    return await send();
                } catch (err) {
                    if (err instanceof ApiError) {
                        error.value = errorMessage(err);
                        await refresh().catch(() => undefined);
                        return undefined;
                    }
                    saveState.value = 'offline';
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    delay = Math.min(delay * 2, MAX_RETRY_MS);
                    saveState.value = 'saving';
                }
            }
        } finally {
            pending--;
            if (!pending) saveState.value = error.value ? 'idle' : 'saved';
        }
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

    let closeStream: (() => void) | undefined;

    /** (Re)opens the event stream; called again once the viewer has an identity. */
    function connect() {
        closeStream?.();
        closeStream = openEventStream<ShareEvent>(`/api${base}/events`, headers() ?? {}, {
            // Events missed while disconnected are recovered by refetching.
            onOpen: () => void refresh().catch(() => undefined),
            onEvent: handleEvent,
        });
    }

    return {
        shared,
        threads,
        presence,
        saveState,
        error,
        me,
        canWrite,
        connect,
        disconnect: () => closeStream?.(),

        async register(displayName: string) {
            const res = await api.post<RegisteredViewer>(`${base}/viewers`, { displayName });
            key = res.key;
            storage.set(viewerKeyName(shared.value.mockupId), res.key);
            shared.value = { ...shared.value, me: res.viewer };
            connect();
        },

        createThread(
            input: { kind: 'pin'; anchor: PinAnchor } | { kind: 'general' },
            body: string,
        ) {
            const id = crypto.randomUUID();
            const comment = newComment(id, body);
            upsert({
                id,
                kind: input.kind,
                anchor: input.kind === 'pin' ? input.anchor : null,
                status: 'open',
                resolvedAt: null,
                author: comment.author,
                createdAt: comment.createdAt,
                comments: [comment],
            });
            void perform(() =>
                api.post<Thread>(`${base}/threads`, { id, ...input, body }, headers()),
            ).then((thread) => thread && upsert(thread));
            return id;
        },

        reply(threadId: string, body: string) {
            const comment = newComment(threadId, body);
            patchThread(threadId, (t) => ({ ...t, comments: [...t.comments, comment] }));
            void perform(() =>
                api.post<Thread>(
                    `${base}/threads/${threadId}/comments`,
                    { id: comment.id, body },
                    headers(),
                ),
            ).then((thread) => thread && upsert(thread));
        },

        edit(comment: Comment, body: string) {
            const editedAt = new Date().toISOString();
            patchThread(comment.threadId, (t) => ({
                ...t,
                comments: t.comments.map((c) =>
                    c.id === comment.id ? { ...c, body, editedAt } : c,
                ),
            }));
            void perform(() =>
                api.patch<Thread>(`${base}/comments/${comment.id}`, { body }, headers()),
            ).then((thread) => thread && upsert(thread));
        },

        remove(comment: Comment) {
            patchThread(comment.threadId, (t) => ({
                ...t,
                comments: t.comments.map((c) =>
                    c.id === comment.id ? { ...c, body: '', deleted: true } : c,
                ),
            }));
            void perform(() => api.delete(`${base}/comments/${comment.id}`, headers()));
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
