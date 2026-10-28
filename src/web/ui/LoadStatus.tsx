import { IconLoader2 } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import type { Resource } from '../lib/resource.ts';
import { Button } from './Button.tsx';
import { CenteredCard, CenteredScreen } from './CenteredCard.tsx';
import { FormError } from './FormError.tsx';
import { ICON, TEXT } from './styles.ts';

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
        <p role="status" class={`flex items-center gap-2 ${TEXT.secondary}`}>
            <IconLoader2 size={ICON.md} class="animate-spin" />
            Loading…
        </p>
    );
}

/** What stands in for a resource that is not loaded: a spinner, `missing`, or a retry. */
export function LoadStatus<T>({ resource, missing }: { resource: Resource<T>; missing?: string }) {
    if (resource.status === 'loading') return <Spinner />;
    if (resource.status === 'missing') return <p class={TEXT.secondary}>{missing}</p>;
    if (resource.status === 'failed') {
        return <LoadFailed message={resource.message} onRetry={resource.retry} />;
    }
    return null;
}

/** Why something could not be loaded, with a retry. */
function LoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div class="flex flex-col items-start gap-3">
            <FormError message={message} />
            <Button variant="secondary" onClick={onRetry}>
                Retry
            </Button>
        </div>
    );
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
            <CenteredScreen>
                <Spinner />
            </CenteredScreen>
        );
    }
    if (resource.status === 'missing') {
        return (
            <CenteredCard title={missingTitle}>
                <p class={TEXT.secondary}>{missing}</p>
            </CenteredCard>
        );
    }
    if (resource.status === 'failed') {
        return <CenteredLoadFailed message={resource.message} onRetry={resource.retry} />;
    }
    return null;
}

/** A full-page screen for what could not be loaded, with a retry. */
export function CenteredLoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <CenteredCard title="Could not load this page">
            <LoadFailed message={message} onRetry={onRetry} />
        </CenteredCard>
    );
}
