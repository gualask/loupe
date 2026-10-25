import { IconAlertTriangle } from '@tabler/icons-preact';
import type { Mockup } from '../../shared/api/projects.ts';
import { plural } from '../lib/format.ts';
import { shareState } from '../lib/share.ts';
import { Badge } from '../ui/Badge.tsx';

/** Share status, read-only and external-resource warnings for a mockup. */
export function MockupBadges({ mockup }: { mockup: Mockup }) {
    const state = shareState(mockup);
    const external = mockup.version.externalRefs.length;
    return (
        <div class="flex flex-wrap items-center gap-1.5">
            <Badge tone={state === 'Shared' ? 'good' : 'neutral'}>{state}</Badge>
            {mockup.readOnly ? <Badge>Read-only</Badge> : null}
            {external ? (
                <span
                    class="inline-flex items-center gap-1 text-amber-700 text-xs"
                    title="This file loads external resources"
                >
                    <IconAlertTriangle size={14} />
                    {plural(external, 'external resource')}
                </span>
            ) : null}
        </div>
    );
}
