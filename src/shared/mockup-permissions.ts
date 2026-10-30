// What mockups may do beyond running their own scripts (docs/SPEC.md §4.1). The server reads
// the permissions from LOUPE_MOCKUP_* and sends them with each mockup, so the app embeds the
// document with the same sandbox the server serves it with.

export const MOCKUP_PERMISSIONS = [
    'external',
    'forms',
    'eval',
    'modals',
    'downloads',
    'clipboard',
] as const;

export type MockupPermission = (typeof MOCKUP_PERMISSIONS)[number];

/** Each permission granted or not; all are blocked unless the server allows them. */
export type MockupPermissions = Record<MockupPermission, boolean>;

/** The environment variable that grants `permission` when set to `allow`. */
export function mockupPermissionVariable(permission: MockupPermission) {
    return `LOUPE_MOCKUP_${permission.toUpperCase()}` as `LOUPE_MOCKUP_${Uppercase<MockupPermission>}`;
}

/**
 * The sandbox flags of a mockup document, for its CSP and its iframe. Never allow-same-origin
 * (the document would reach the app), allow-top-navigation or allow-popups: links leaving the
 * mockup go through the app instead (§4.2).
 */
export function mockupSandbox(permissions: MockupPermissions) {
    const flags = ['allow-scripts'];
    if (permissions.forms) flags.push('allow-forms');
    if (permissions.modals) flags.push('allow-modals');
    if (permissions.downloads) flags.push('allow-downloads');
    return flags.join(' ');
}

/** The permissions policy of a mockup's iframe (its `allow` attribute), if it needs one. */
export function mockupFrameAllow(permissions: MockupPermissions) {
    return permissions.clipboard ? 'clipboard-write' : undefined;
}
