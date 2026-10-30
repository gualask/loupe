import { describe, expect, it } from 'vitest';
import { BLOCKED } from '../shared/test-fixtures.ts';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
    it('blocks every mockup permission unless allowed one by one', () => {
        expect(loadConfig({}).mockupPermissions).toEqual(BLOCKED);
        expect(
            loadConfig({ LOUPE_MOCKUP_FORMS: 'allow', LOUPE_MOCKUP_EXTERNAL: 'block' })
                .mockupPermissions,
        ).toEqual({ ...BLOCKED, forms: true });
    });

    it('rejects values other than block and allow', () => {
        expect(() => loadConfig({ LOUPE_MOCKUP_MODALS: 'true' })).toThrow(/LOUPE_MOCKUP_MODALS/);
    });
});
