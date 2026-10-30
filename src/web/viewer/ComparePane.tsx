import { IconLayoutColumns, IconLayoutRows, IconX } from '@tabler/icons-preact';
import type { SharedVersion } from '../../shared/api/projects.ts';
import type { MockupPermissions } from '../../shared/mockup-permissions.ts';
import { MockupFrame } from '../components/MockupFrame.tsx';
import type { Bridge } from '../lib/bridge.ts';
import { formatDate } from '../lib/format.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { Select } from '../ui/Select.tsx';
import { ICON, TEXT } from '../ui/styles.ts';
import { PaneBar, Preview } from './Preview.tsx';

/**
 * An earlier version shown read-only beside the current one, before it: on the left, or above
 * when `stacked`. It takes no pins; its bridge only forwards shortcuts and reports.
 */
export function ComparePane({
    name,
    versions,
    shown,
    stacked,
    viewportWidth,
    permissions,
    bridge,
    onShow,
    onToggleLayout,
    onClose,
}: {
    name: string;
    versions: SharedVersion[];
    shown: SharedVersion;
    stacked: boolean;
    viewportWidth: number | null;
    permissions: MockupPermissions;
    bridge: Bridge;
    onShow: (number: number) => void;
    onToggleLayout: () => void;
    onClose: () => void;
}) {
    return (
        <section
            aria-label={`Version ${shown.number}, for comparison`}
            class={`flex min-h-0 min-w-0 flex-1 flex-col border-stone-200 ${stacked ? 'border-b' : 'border-r'}`}
        >
            <PaneBar>
                <Select
                    label="Earlier version to compare with"
                    value={String(shown.number)}
                    onChange={(value) => onShow(Number(value))}
                >
                    {versions.map((version) => (
                        <option key={version.number} value={version.number}>
                            Version {version.number}
                        </option>
                    ))}
                </Select>
                <span class={`min-w-0 flex-1 truncate ${TEXT.meta}`}>
                    Uploaded {formatDate(shown.createdAt)}
                </span>
                <IconButton
                    label={stacked ? 'Show side by side' : 'Show one above the other'}
                    onClick={onToggleLayout}
                >
                    {stacked ? (
                        <IconLayoutColumns size={ICON.md} />
                    ) : (
                        <IconLayoutRows size={ICON.md} />
                    )}
                </IconButton>
                <IconButton label="Close comparison" onClick={onClose}>
                    <IconX size={ICON.md} />
                </IconButton>
            </PaneBar>
            <Preview width={viewportWidth}>
                {/* Keyed by version, so choosing another loads it afresh. */}
                <MockupFrame
                    key={shown.number}
                    bridge={bridge}
                    src={shown.contentUrl}
                    permissions={permissions}
                    title={`Version ${shown.number} of ${name}`}
                    class="h-full w-full"
                />
            </Preview>
        </section>
    );
}
