import { IconAlertTriangle } from '@tabler/icons-preact';
import type { Mockup } from '../../shared/api/projects.ts';
import { shareState } from '../lib/share.ts';

function Badge({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'good' }) {
    const colors =
        tone === 'good' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600';
    return <span class={`rounded-full px-2 py-0.5 text-xs ${colors}`}>{children}</span>;
}

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
                    {external} external {external === 1 ? 'resource' : 'resources'}
                </span>
            ) : null}
        </div>
    );
}
