import { describe, expect, it } from 'vitest';
import { MOCKUP_PERMISSIONS, mockupFrameAllow, mockupSandbox } from './mockup-permissions.ts';
import { ALLOWED, BLOCKED } from './test-fixtures.ts';

describe('mockupSandbox', () => {
    it('runs scripts only, unless the server grants more', () => {
        expect(mockupSandbox(BLOCKED)).toBe('allow-scripts');
        expect(mockupFrameAllow(BLOCKED)).toBeUndefined();
        expect(mockupSandbox(ALLOWED)).toBe(
            'allow-scripts allow-forms allow-modals allow-downloads',
        );
        expect(mockupFrameAllow(ALLOWED)).toBe('clipboard-write');
    });

    it('never lets a mockup reach the app, its tab or new windows', () => {
        for (const name of MOCKUP_PERMISSIONS) {
            const flags = mockupSandbox({ ...BLOCKED, [name]: true });
            expect(flags).not.toMatch(/allow-same-origin|allow-top-navigation|allow-popups/);
        }
        expect(mockupSandbox(ALLOWED)).not.toMatch(
            /allow-same-origin|allow-top-navigation|allow-popups/,
        );
    });
});
