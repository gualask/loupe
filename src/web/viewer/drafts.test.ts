import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeStorage } from '../test-utils.ts';
import { gatherDrafts, offerAtNextLoad, sendDraft, setAside } from './drafts.ts';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('drafts', () => {
    it('sets text aside in the general comment box and offers it at the next load', () => {
        const items = fakeStorage({ 'loupe:draft:m1:general': 'Typed before' });
        setAside('m1', 'Too small');
        expect(Object.fromEntries(items)).toEqual({
            'loupe:draft:m1:general': 'Typed before\n\nToo small',
            'loupe:draft-offer:m1': 'yes',
        });

        expect(gatherDrafts('m1', new Set())).toBe(true);
        expect(gatherDrafts('m1', new Set())).toBe(false);
        expect(Object.fromEntries(items)).toEqual({
            'loupe:draft:m1:general': 'Typed before\n\nToo small',
        });
    });

    it('moves the replies to threads that are gone into the general comment box', () => {
        const items = fakeStorage({
            'loupe:draft:m1:old-thread': 'A reply on version 1',
            'loupe:draft:m1:t1': 'A reply on this version',
            'loupe:draft:m1:blank-thread': ' ',
            'loupe:draft:m2:old-thread': 'Another mockup',
        });
        expect(gatherDrafts('m1', new Set(['t1']))).toBe(true);
        expect(Object.fromEntries(items)).toEqual({
            'loupe:draft:m1:t1': 'A reply on this version',
            'loupe:draft:m2:old-thread': 'Another mockup',
            'loupe:draft:m1:general': 'A reply on version 1',
        });
    });

    it('keeps text out of its box while it is sent, and puts it back unless saved', () => {
        const items = fakeStorage({ 'loupe:draft:m1:t1': 'First' });
        const settleFirst = sendDraft('draft:m1:t1', 'First');
        expect([...items.keys()]).toEqual([expect.stringMatching(/^loupe:sending:draft:m1:t1:/)]);

        const settleSecond = sendDraft('draft:m1:t1', 'Second');
        settleFirst(true);
        expect([...items.values()]).toEqual(['Second']);
        // Rejected after something new was typed in the box.
        items.set('loupe:draft:m1:t1', 'Third');
        settleSecond(false);
        expect(Object.fromEntries(items)).toEqual({ 'loupe:draft:m1:t1': 'Third\n\nSecond' });
    });

    it('puts text whose sending a reload cut short back into its box', () => {
        const items = fakeStorage();
        sendDraft('draft:m1:t1', 'Sent');
        items.set('loupe:draft:m1:t1', 'Typed after');
        sendDraft('draft:m1:general', 'Also sent');

        expect(gatherDrafts('m1', new Set(['t1']))).toBe(false);
        expect(Object.fromEntries(items)).toEqual({
            'loupe:draft:m1:t1': 'Typed after\n\nSent',
            'loupe:draft:m1:general': 'Also sent',
        });
    });

    it('offers the general comment box only when asked and when it has text', () => {
        const items = fakeStorage({ 'loupe:draft:m1:general': 'Kept' });
        expect(gatherDrafts('m1', new Set())).toBe(false);
        offerAtNextLoad('m1');
        expect(gatherDrafts('m1', new Set())).toBe(true);

        items.clear();
        offerAtNextLoad('m1');
        expect(gatherDrafts('m1', new Set())).toBe(false);
    });
});
