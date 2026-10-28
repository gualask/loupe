import { useEffect, useRef } from 'preact/hooks';
import { storage } from '../lib/storage.ts';
import type { ReviewSession } from './session.ts';

// Unsent text of a mockup's comment boxes, kept by the browser until the server saves it
// (docs/SPEC.md §5.1).
const draftPrefix = (mockupId: string) => `draft:${mockupId}:`;
// Text sent from a box and not saved yet, one item per sending, named after the box's draft.
const SENDING = 'sending:';
const sendingName = (draft: string) => `${SENDING}${draft}:${crypto.randomUUID()}`;
const draftOfSending = (name: string) => name.slice(SENDING.length, name.lastIndexOf(':'));
// Set when the next load should offer the general comment box's text, e.g. after a new version.
const offerName = (mockupId: string) => `draft-offer:${mockupId}`;

export const generalDraft = (mockupId: string) => `${draftPrefix(mockupId)}general`;
export const replyDraft = (mockupId: string, threadId: string) =>
    `${draftPrefix(mockupId)}${threadId}`;

/** Appends `text` to the text of a box, as a paragraph of its own. */
export const joinText = (kept: string, text: string) =>
    kept.trim() ? `${kept.trim()}\n\n${text}` : text;

/** The text kept for a box. */
export const readDraft = (draft: string) => storage.get(draft) ?? '';

/** Keeps the text of a box, or forgets it once the box is empty. */
export function saveDraft(draft: string, text: string) {
    if (text.trim()) storage.set(draft, text);
    else storage.remove(draft);
}

function appendTo(draft: string, text: string) {
    storage.set(draft, joinText(readDraft(draft), text));
}

/**
 * Takes the text of a box out of its draft while the server saves it, so the box does not offer
 * it again, but keeps it until then: if the page closes first, the next load puts it back.
 * Returns the function to call with the outcome; a rejected text goes back into the draft.
 */
export function sendDraft(draft: string, text: string) {
    const sending = sendingName(draft);
    storage.set(sending, text);
    storage.remove(draft);
    return (saved: boolean) => {
        storage.remove(sending);
        if (!saved) appendTo(draft, text);
    };
}

/** Asks the next load to offer the text of the general comment box. */
export function offerAtNextLoad(mockupId: string) {
    storage.set(offerName(mockupId), 'yes');
}

/**
 * Keeps text that cannot be sent from this page, e.g. a pin on a version replaced meanwhile, in
 * the general comment box, and offers it at the next load.
 */
export function setAside(mockupId: string, text: string) {
    appendTo(generalDraft(mockupId), text);
    offerAtNextLoad(mockupId);
}

/**
 * Run once the threads are loaded: puts text whose sending the previous page did not see through
 * back into its box, then moves the reply drafts of threads that are not listed, e.g. those of
 * the previous version, into the general comment box. Returns whether that box has text to
 * offer.
 */
export function gatherDrafts(mockupId: string, listed: ReadonlySet<string>) {
    const prefix = draftPrefix(mockupId);
    const general = generalDraft(mockupId);
    let offer = !!storage.get(offerName(mockupId));
    storage.remove(offerName(mockupId));
    for (const name of storage.names(SENDING + prefix)) {
        const text = storage.get(name);
        storage.remove(name);
        if (text) appendTo(draftOfSending(name), text);
    }
    for (const name of storage.names(prefix)) {
        if (name === general || listed.has(name.slice(prefix.length))) continue;
        const text = storage.get(name)?.trim();
        storage.remove(name);
        if (text) {
            appendTo(general, text);
            offer = true;
        }
    }
    return offer && !!storage.get(general)?.trim();
}

/**
 * Offers unsent text again after a reload (docs/SPEC.md §5.3): once the review space shows a
 * replaced version, the next load is asked to offer it; once the threads load, the text kept for
 * this load is gathered in the general comment box and `onOffer` runs.
 */
export function useDraftRecovery(session: ReviewSession, onOffer: () => void) {
    const { mockupId } = session.shared.value;
    const outdated = session.outdated.value;
    useEffect(() => {
        if (outdated) offerAtNextLoad(mockupId);
    }, [outdated, mockupId]);

    const offer = useRef(onOffer);
    offer.current = onOffer;
    const loaded = session.loaded.value;
    useEffect(() => {
        if (!loaded) return;
        const listed = new Set(session.threads.value.map((t) => t.id));
        if (gatherDrafts(mockupId, listed)) offer.current();
    }, [loaded, mockupId, session]);
}
