import { type Author, authorKey, type ShareEvent, sameAuthor } from '../../shared/api/reviews.ts';

// Keeps idle connections open through proxies that drop silent ones, and is when a room checks
// that its streams may still be served.
const HEARTBEAT_MS = 25_000;

/** One open event stream. */
type Member = {
    participant: Author | null;
    /** The share token the stream was opened with. */
    token: string;
    send: (event: ShareEvent) => void;
    /** Writes the comment that keeps an idle connection open. */
    heartbeat: () => void;
    /** Ends the stream; the client finds out why when reconnecting. */
    end: () => void;
};

type Room = { members: Set<Member>; timer: ReturnType<typeof setInterval> };

/**
 * In-memory pub/sub for share-link event streams, one room per mockup version. Loupe runs as a
 * single process, so nothing has to be shared between instances (docs/SPEC.md §5.2).
 *
 * The routes that stop a link from serving a version close its room at once. As a safety net,
 * each room also checks at every heartbeat, with one lookup for all its streams, that its version
 * is still current on the link they were opened with: `linkOf` returns the share token of the
 * mockup whose current version it is, or undefined.
 */
export function createHub(linkOf: (room: string) => string | undefined) {
    const rooms = new Map<string, Room>();

    /** Sends an event to everyone in a room. */
    function publish(room: string, event: ShareEvent) {
        for (const member of rooms.get(room)?.members ?? []) member.send(event);
    }

    function presence(room: string): ShareEvent {
        const participants = new Map<string, Author>();
        for (const { participant } of rooms.get(room)?.members ?? []) {
            if (participant) participants.set(authorKey(participant), participant);
        }
        return { type: 'presence', participants: [...participants.values()] };
    }

    /** Removes members from a room, telling the others when someone they could see left. */
    function remove(room: string, leaving: Member[]) {
        const current = rooms.get(room);
        if (!current) return;
        const left = leaving.filter((member) => current.members.delete(member));
        if (!current.members.size) {
            clearInterval(current.timer);
            rooms.delete(room);
        } else if (left.some((member) => member.participant)) {
            publish(room, presence(room));
        }
    }

    /** Ends the streams of a room, those for which `ended` holds or all of them. */
    function end(room: string, ended: (member: Member) => boolean = () => true) {
        const leaving = [...(rooms.get(room)?.members ?? [])].filter(ended);
        remove(room, leaving);
        for (const member of leaving) member.end();
    }

    function beat(room: string) {
        const token = linkOf(room);
        end(room, (member) => member.token !== token);
        for (const member of rooms.get(room)?.members ?? []) member.heartbeat();
    }

    /** Subscribes a stream to a room; returns the function that leaves it. */
    function join(room: string, member: Member) {
        let current = rooms.get(room);
        if (!current) {
            current = { members: new Set(), timer: setInterval(() => beat(room), HEARTBEAT_MS) };
            rooms.set(room, current);
        }
        current.members.add(member);
        // Anonymous readers are not shown, so only the newcomer needs to learn who is here.
        if (member.participant) publish(room, presence(room));
        else member.send(presence(room));
        return () => remove(room, [member]);
    }

    /**
     * Replaces a participant's details, e.g. a new name, in the presence published from now on;
     * the event telling the change is the caller's.
     */
    function updateParticipant(room: string, participant: Author) {
        for (const member of rooms.get(room)?.members ?? []) {
            if (member.participant && sameAuthor(member.participant, participant)) {
                member.participant = participant;
            }
        }
    }

    /** Ends every stream of a version the link no longer serves to them. */
    const close = (room: string) => end(room);

    return { publish, join, updateParticipant, close };
}

export type Hub = ReturnType<typeof createHub>;
