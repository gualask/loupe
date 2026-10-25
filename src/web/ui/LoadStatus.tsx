import { IconLoader2 } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import type { Resource } from '../lib/resource.ts';
import { Button } from './Button.tsx';
import { CenteredCard } from './CenteredCard.tsx';
import { FormError } from './FormError.tsx';

// Fast loads finish before the spinner shows, so it does not flash.
const SPINNER_DELAY_MS = 300;

function Spinner() {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setShown(true), SPINNER_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);
    if (!shown) return null;
    return (
        <p role="status" class="flex items-center gap-2 text-sm text-stone-500">
            <IconLoader2 size={16} class="animate-spin" />
            Loading…
        </p>
    );
}

/** What stands in for a resource that is not loaded: a spinner, `missing`, or a retry. */
export function LoadStatus<T>({ resource, missing }: { resource: Resource<T>; missing?: string }) {
    if (resource.status === 'loading') return <Spinner />;
    if (resource.status === 'missing') return <p class="text-stone-500">{missing}</p>;
    if (resource.status === 'failed') {
        return (
            <div class="flex flex-col items-start gap-3">
                <FormError message={resource.message} />
                <Button variant="secondary" onClick={resource.retry}>
                    Retry
                </Button>
            </div>
        );
    }
    return null;
}

/** The same for the full-page screens behind a link, where `missing` explains the dead link. */
export function CenteredLoadStatus<T>({
    resource,
    missingTitle,
    missing,
}: {
    resource: Resource<T>;
    missingTitle: string;
    missing: string;
}) {
    if (resource.status === 'loading') {
        return (
            <main class="grid min-h-dvh place-items-center bg-stone-50">
                <Spinner />
            </main>
        );
    }
    if (resource.status === 'missing') {
        return (
            <CenteredCard title={missingTitle}>
                <p class="text-sm text-stone-600">{missing}</p>
            </CenteredCard>
        );
    }
    return (
        <CenteredCard title="Could not load this page">
            <LoadStatus resource={resource} />
        </CenteredCard>
    );
}
