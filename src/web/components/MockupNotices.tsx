import { IconAlertTriangle, IconExternalLink, IconX } from '@tabler/icons-preact';
import {
    type MockupPermission,
    type MockupPermissions,
    mockupPermissionVariable,
} from '../../shared/mockup-permissions.ts';
import type { MockupReports } from '../lib/mockup-reports.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { Notice } from '../ui/Notice.tsx';
import { buttonClass, ICON } from '../ui/styles.ts';

/** What each permission lets a mockup use, as people know it. */
const USES: Record<MockupPermission, string> = {
    external: 'files from other sites',
    forms: 'forms',
    eval: 'code built at run time (eval)',
    modals: 'browser dialogs (alert, confirm, prompt, print)',
    downloads: 'downloads',
    clipboard: 'copying to the clipboard',
};

/**
 * Notices about the mockup shown: the files from other sites found in it at upload, when
 * `externalRefs` lists them; the page a link of it would open, offered in a new tab; and what it
 * used that this server blocks. `showSettings` names, for editors, the settings that allow it.
 */
export function MockupNotices({
    reports,
    permissions,
    showSettings,
    externalRefs = [],
}: {
    reports: MockupReports;
    permissions: MockupPermissions;
    showSettings: boolean;
    externalRefs?: string[];
}) {
    // Files listed from the upload already say what the mockup loads from other sites.
    const listed = externalRefs.length > 0;
    const blocked = reports.used.filter(
        (permission) => !permissions[permission] && !(listed && permission === 'external'),
    );
    if (!listed && !reports.link && !blocked.length) return null;
    return (
        <div class="flex flex-col gap-2">
            {listed ? (
                <ExternalFiles
                    refs={externalRefs}
                    allowed={permissions.external}
                    showSettings={showSettings}
                />
            ) : null}
            {reports.link ? (
                <LeavingLink url={reports.link} onDismiss={reports.dismissLink} />
            ) : null}
            {blocked.length ? (
                <BlockedUses
                    permissions={blocked}
                    showSettings={showSettings}
                    onDismiss={reports.dismissUsed}
                />
            ) : null}
        </div>
    );
}

function ExternalFiles({
    refs,
    allowed,
    showSettings,
}: {
    refs: string[];
    allowed: boolean;
    showSettings: boolean;
}) {
    return (
        <Notice tone="warning">
            <p class="flex items-center gap-1.5 font-medium">
                <IconAlertTriangle size={ICON.md} />
                Not self-contained
            </p>
            <p class="mt-1 text-xs">
                {allowed
                    ? 'It loads these files from other sites, which see the address of whoever opens it:'
                    : 'It uses these files from other sites, which this server blocks:'}
            </p>
            <ul class="mt-2 flex flex-col gap-0.5 font-mono text-xs">
                {refs.map((ref) => (
                    <li key={ref} class="truncate" title={ref}>
                        {ref}
                    </li>
                ))}
            </ul>
            {showSettings && !allowed ? <SettingsHint permissions={['external']} /> : null}
        </Notice>
    );
}

function LeavingLink({ url, onDismiss }: { url: string; onDismiss: () => void }) {
    return (
        <Notice tone="neutral" role="status">
            <div class="flex items-center gap-3">
                <p class="min-w-0 flex-1">
                    The mockup links to a page outside it:{' '}
                    <span class="break-all font-mono text-xs">{url}</span>
                </p>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class={buttonClass('secondary', 'sm')}
                >
                    <IconExternalLink size={ICON.md} />
                    Open in new tab
                </a>
                <IconButton label="Dismiss" onClick={onDismiss}>
                    <IconX size={ICON.md} />
                </IconButton>
            </div>
        </Notice>
    );
}

function BlockedUses({
    permissions,
    showSettings,
    onDismiss,
}: {
    permissions: MockupPermission[];
    showSettings: boolean;
    onDismiss: () => void;
}) {
    return (
        <Notice tone="warning" role="status">
            <div class="flex items-start gap-3">
                <div class="min-w-0 flex-1">
                    <p class="flex items-center gap-1.5 font-medium">
                        <IconAlertTriangle size={ICON.md} />
                        Parts of this mockup may not work
                    </p>
                    <p class="mt-1">
                        It uses {permissions.map((permission) => USES[permission]).join(', ')},
                        which this server blocks.
                    </p>
                    {showSettings ? <SettingsHint permissions={permissions} /> : null}
                </div>
                <IconButton label="Dismiss" onClick={onDismiss}>
                    <IconX size={ICON.md} />
                </IconButton>
            </div>
        </Notice>
    );
}

/** The settings that grant `permissions`, for editors to pass on to an administrator. */
function SettingsHint({ permissions }: { permissions: MockupPermission[] }) {
    return (
        <p class="mt-1 text-xs">
            An administrator can allow this in the server settings:{' '}
            {permissions.map((permission, i) => (
                <span key={permission}>
                    {i ? ', ' : ''}
                    <code class="font-mono">{mockupPermissionVariable(permission)}=allow</code>
                </span>
            ))}
        </p>
    );
}
