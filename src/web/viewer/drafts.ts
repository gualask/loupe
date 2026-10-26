import { storage } from '../lib/storage.ts';

// Unsent text of a mockup's comment boxes, kept by the browser until the server saves it
// (docs/SPEC.md §5.1).
const draftPrefix = (mockupId: string) => `loupe:draft:${mockupId}:`;
// Set when the next load should offer the general comment box's text, e.g. after a new version.
const offerName = (mockupId: string) => `loupe:draft-offer:${mockupId}`;

export const generalDraft = (mockupId: string) => `${draftPrefix(mockupId)}general`;
export const replyDraft = (mockupId: string, threadId: string) =>
    `${draftPrefix(mockupId)}${threadId}`;

function appendToGeneral(mockupId: string, text: string) {
    const general = generalDraft(mockupId);
    const kept = storage.get(general)?.trim();
    storage.set(general, kept ? `${kept}\n\n${text}` : text);
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
    appendToGeneral(mockupId, text);
    offerAtNextLoad(mockupId);
}

/**
 * Run once the threads are loaded: moves the reply drafts of threads that are not listed, e.g.
 * those of the previous version, into the general comment box. Returns whether that box has
 * text to offer.
 */
export function gatherDrafts(mockupId: string, listed: ReadonlySet<string>) {
    const prefix = draftPrefix(mockupId);
    const general = generalDraft(mockupId);
    let offer = !!storage.get(offerName(mockupId));
    storage.remove(offerName(mockupId));
    for (const name of storage.names(prefix)) {
        if (name === general || listed.has(name.slice(prefix.length))) continue;
        const text = storage.get(name)?.trim();
        storage.remove(name);
        if (text) {
            appendToGeneral(mockupId, text);
            offer = true;
        }
    }
    return offer && !!storage.get(general)?.trim();
}
