import { IconZoomScan } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { api } from '../lib/api.ts';
import { CenteredCard } from '../ui/CenteredCard.tsx';

/** What reviewers see when they open a share link. Pins and comments come next. */
export function ViewerPage() {
    const { params } = useRoute();
    const [shared, setShared] = useState<SharedMockup | null>();

    useEffect(() => {
        api.get<SharedMockup>(`/s/${params.token}`).then(setShared, () => setShared(null));
    }, [params.token]);

    if (shared === undefined) return null;
    if (shared === null) {
        return (
            <CenteredCard title="Link not available">
                <p class="text-sm text-stone-600">
                    This review link is disabled, expired or does not exist. Ask whoever shared it
                    for a new one.
                </p>
            </CenteredCard>
        );
    }

    return (
        <div class="flex h-dvh flex-col bg-stone-100">
            <header class="flex h-11 shrink-0 items-center gap-3 border-stone-200 border-b bg-white px-4 text-sm">
                <IconZoomScan size={18} stroke={1.75} />
                <span class="font-medium">{shared.name}</span>
                {shared.readOnly ? (
                    <span class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600 text-xs">
                        Read-only
                    </span>
                ) : null}
            </header>
            <MockupFrame src={shared.contentUrl} title={shared.name} class="w-full flex-1" />
        </div>
    );
}
