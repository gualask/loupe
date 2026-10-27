import type { Mockup } from '../../shared/api/projects.ts';
import { useAction } from '../lib/form.ts';
import { regenerateShareLink } from '../lib/mockups.ts';
import { CopyField } from '../ui/CopyField.tsx';
import { FormError } from '../ui/FormError.tsx';
import { Section } from '../ui/Section.tsx';

/** The share link of a mockup, and the way to replace it. */
export function SharePanel({
    mockup,
    onChange,
}: {
    mockup: Mockup;
    onChange: (mockup: Mockup) => void;
}) {
    const { error, pending, run } = useAction();

    const regenerate = () =>
        run(async () => {
            const updated = await regenerateShareLink(mockup);
            if (updated) onChange(updated);
        });

    return (
        <Section title="Share">
            <CopyField value={mockup.shareUrl} />
            {/* Rarely needed and it cuts everyone off, so it stays out of the way. */}
            <p class="text-stone-500 text-xs">
                Anyone with the link can open the mockup and comment. Link reached the wrong people?{' '}
                <button
                    type="button"
                    disabled={pending}
                    onClick={regenerate}
                    class="font-medium text-stone-900 underline underline-offset-2 hover:text-stone-900"
                >
                    Create a new link
                </button>
                ; the current one stops working.
            </p>
            <FormError message={error} />
        </Section>
    );
}
