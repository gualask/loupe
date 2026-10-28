import { computed, signal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import type { PinAnchor } from '../../shared/anchor.ts';
import type { SharedMockup } from '../../shared/api/projects.ts';
import {
    type Author,
    type Comment,
    type ShareEvent,
    sameAuthor,
    type Thread,
    VERSION_HEADER,
} from '../../shared/api/reviews.ts';
import { ApiError, api, errorMessage } from '../lib/api.ts';
import { openEventStream } from '../lib/event-stream.ts';
import { loginPath } from '../lib/session.ts';
import { createChangeQueue } from './changes.ts';
import { createIdentity } from './identity.ts';

function sortByCreation<T extends { createdAt: string }>(items: T[]) {
    return items.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const visible = (thread: Thread) => thread.comments.some((c) => !c.deleted);

/** Where a new thread goes: a pin on an element, or a general comment. */
export type ThreadTarget = { kind: 'pin'; anchor: PinAnchor } | { kind: 'general' };

/**
 * Client state of a review space: threads and presence, kept in sync through the event stream.
 * Every change is applied optimistically and retried while offline (docs/SPEC.md §5.1).
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
    const error = signal<string>();
    /** Set when the link stops giving access: regenerated, or its mockup deleted. */
    const unavailable = signal(false);
    /** Set once a newer version was uploaded: this space shows a file reviewers moved on from. */
    const outdated = signal(false);
    /** Set once the threads of the current version were loaded. */
    const loaded = signal(false);

    const me = computed(() => shared.value.me);
    /** Whether changes are accepted here at all; a viewer may first need an identity. */
    const mayWrite = computed(() => !outdated.value && !shared.value.archived);
    /** Whether this browser can change things right now: writing is open and it has an identity. */
    const canWrite = computed(() => !!me.value && mayWrite.value);
    const identity = createIdentity({
        base,
        shared,
        key: initialKey,
        mayAct: () => mayWrite.value,
        headers,
        onJoined: connect,
        onError: (message) => {
            error.value = message;
        },
    });

    function headers() {
        return { [VERSION_HEADER]: String(shared.value.version), ...identity.keyHeader() };
    }

    function upsert(thread: Thread) {
        const others = threads.value.filter((t) => t.id !== thread.id);
        threads.value = sortByCreation(visible(thread) ? [...others, thread] : others);
    }

    function patchThread(id: string, change: (thread: Thread) => Thread) {
        const thread = threads.value.find((t) => t.id === id);
        if (thread) upsert(change(thread));
    }

    const changes = createChangeQueue({
        onRejected: (err) => {
            // An editor's session ended: sign in again, then come back here.
            if (err.status === 401 && me.value?.kind === 'editor') {
                location.assign(loginPath(location.pathname + location.search));
            } else if (err.code === 'version_changed') {
                // A newer version is shown as a notice to reload rather than as an error.
                outdated.value = true;
            } else if (err.code === 'archived') {
                // Archived meanwhile, and its event missed: the space closes to changes.
                setArchived(true);
            } else {
                error.value = errorMessage(err);
            }
        },
        load: () => api.get<Thread[]>(`${base}/threads`, headers()),
        show: (list) => {
            threads.value = list;
            if (!outdated.value) loaded.value = true;
        },
    });
    const { perform } = changes;

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

    function setArchived(archived: boolean) {
        shared.value = { ...shared.value, archived };
    }

    /** Shows a viewer's new name wherever they appear. */
    function showName(viewer: Extract<Author, { kind: 'viewer' }>) {
        const named = (author: Author) => (sameAuthor(author, viewer) ? viewer : author);
        threads.value = threads.value.map((thread) => ({
            ...thread,
            author: named(thread.author),
            comments: thread.comments.map((comment) => ({
                ...comment,
                author: named(comment.author),
            })),
        }));
        presence.value = presence.value.map(named);
        if (me.value) shared.value = { ...shared.value, me: named(me.value) };
    }

    function handleEvent(event: ShareEvent) {
        if (event.type === 'thread') upsert(event.thread);
        else if (event.type === 'thread-deleted') {
            threads.value = threads.value.filter((t) => t.id !== event.id);
        } else if (event.type === 'presence') presence.value = event.participants;
        else if (event.type === 'viewer') showName(event.viewer);
        else if (event.type === 'archived') setArchived(event.archived);
    }

    /** Applies the server's copy of a saved thread; resolves to whether the change was saved. */
    async function applySaved(saved: Promise<Thread | undefined>) {
        const thread = await saved;
        if (thread) upsert(thread);
        return !!thread;
    }

    let closeStream: (() => void) | undefined;

    /** (Re)opens the event stream; called again once the viewer has an identity. */
    function connect() {
        closeStream?.();
        closeStream = openEventStream<ShareEvent>(`/api${base}/events`, headers(), {
            // Events missed while disconnected are recovered by refetching.
            onOpen: changes.resync,
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
        saveState: changes.saveState,
        error,
        unavailable,
        outdated,
        loaded,
        me,
        mayWrite,
        canWrite,
        identity,
        connect,
        disconnect: () => closeStream?.(),

        createThread(input: ThreadTarget, body: string) {
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
                    api.post<Thread>(
                        `${base}/threads`,
                        { id, ...input, comment: { id: comment.id, body } },
                        headers(),
                    ),
                ),
            );
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
    };
}

export type ReviewSession = ReturnType<typeof createReviewSession>;

/**
 * The session of a review space: created once per link, connected while the space is shown;
 * `onUnavailable` runs when the link stops giving access.
 */
export function useReviewSession(
    token: string,
    initial: SharedMockup,
    viewerKey: string | null,
    onUnavailable: () => void,
) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: initial values only
    const session = useMemo(() => createReviewSession(token, initial, viewerKey), [token]);
    useEffect(() => {
        session.connect();
        return session.disconnect;
    }, [session]);
    const unavailable = session.unavailable.value;
    useEffect(() => {
        if (unavailable) onUnavailable();
    }, [unavailable, onUnavailable]);
    return session;
}
