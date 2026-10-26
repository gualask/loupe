import type { Author, ShareEvent } from '../../shared/api/reviews.ts';

type Member = { participant: Author | null; send: (event: ShareEvent) => void };

/**
 * In-memory pub/sub for share-link event streams, one room per mockup version. Loupe runs as a
 * single process, so nothing has to be shared between instances (docs/SPEC.md §5.2).
 */
export function createHub() {
    const rooms = new Map<string, Set<Member>>();

    /** Sends an event to everyone in a room, or only to the participants `to` accepts. */
    function publish(
        room: string,
        event: ShareEvent,
        to?: (participant: Author | null) => boolean,
    ) {
        for (const member of rooms.get(room) ?? []) {
            if (!to || to(member.participant)) member.send(event);
        }
    }

    function publishPresence(room: string) {
        const participants = new Map<string, Author>();
        for (const { participant } of rooms.get(room) ?? []) {
            if (participant) participants.set(`${participant.kind}:${participant.id}`, participant);
        }
        publish(room, { type: 'presence', participants: [...participants.values()] });
    }

    /** Subscribes to a room; returns the function that leaves it. */
    function join(room: string, participant: Author | null, send: Member['send']) {
        const member = { participant, send };
        const members = rooms.get(room) ?? new Set();
        rooms.set(room, members.add(member));
        publishPresence(room);
        return () => {
            members.delete(member);
            if (!members.size) rooms.delete(room);
            else if (participant) publishPresence(room);
        };
    }

    /** Shows a renamed viewer's new name in the presence of a room. */
    function rename(room: string, viewer: Author) {
        let present = false;
        for (const member of rooms.get(room) ?? []) {
            const { participant } = member;
            if (participant?.kind === viewer.kind && participant.id === viewer.id) {
                member.participant = viewer;
                present = true;
            }
        }
        if (present) publishPresence(room);
    }

    return { publish, join, rename };
}

export type Hub = ReturnType<typeof createHub>;
