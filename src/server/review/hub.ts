import { type Author, authorKey, type ShareEvent, sameAuthor } from '../../shared/api/reviews.ts';

type Member = { participant: Author | null; send: (event: ShareEvent) => void };

/**
 * In-memory pub/sub for share-link event streams, one room per mockup version. Loupe runs as a
 * single process, so nothing has to be shared between instances (docs/SPEC.md §5.2).
 */
export function createHub() {
    const rooms = new Map<string, Set<Member>>();

    /** Sends an event to everyone in a room. */
    function publish(room: string, event: ShareEvent) {
        for (const member of rooms.get(room) ?? []) member.send(event);
    }

    function publishPresence(room: string) {
        const participants = new Map<string, Author>();
        for (const { participant } of rooms.get(room) ?? []) {
            if (participant) participants.set(authorKey(participant), participant);
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

    /**
     * Replaces a participant's details, e.g. a new name, in the presence published from now on;
     * the event telling the change is the caller's.
     */
    function updateParticipant(room: string, participant: Author) {
        for (const member of rooms.get(room) ?? []) {
            if (member.participant && sameAuthor(member.participant, participant)) {
                member.participant = participant;
            }
        }
    }

    return { publish, join, updateParticipant };
}

export type Hub = ReturnType<typeof createHub>;
