import { CenteredCard } from '../ui/CenteredCard.tsx';
import { buttonClass } from '../ui/styles.ts';

export function NotFoundPage() {
    return (
        <CenteredCard title="Page not found">
            <p class="mb-5 text-sm text-stone-600">
                The address may be mistyped, or the page moved.
            </p>
            <a href="/" class={buttonClass('secondary')}>
                Go to the workspace
            </a>
        </CenteredCard>
    );
}
