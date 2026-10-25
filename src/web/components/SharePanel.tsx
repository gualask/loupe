import { IconExternalLink, IconRefresh } from '@tabler/icons-preact';
import { useId, useState } from 'preact/hooks';
import type { Mockup } from '../../shared/api/projects.ts';
import { api, errorMessage } from '../lib/api.ts';
import { shareState } from '../lib/share.ts';
import { Button } from '../ui/Button.tsx';
import { CopyField } from '../ui/CopyField.tsx';
import { FormError } from '../ui/FormError.tsx';

/** `datetime-local` works in local time without a zone; convert both ways. */
function toLocalInput(iso: string | null) {
    if (!iso) return '';
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Checkbox({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label class="flex cursor-pointer gap-3">
            <input
                type="checkbox"
                class="mt-0.5 size-4 accent-stone-900"
                checked={checked}
                onChange={(e) => onChange(e.currentTarget.checked)}
            />
            <span>
                <span class="block font-medium text-sm">{label}</span>
                <span class="block text-stone-500 text-xs">{hint}</span>
            </span>
        </label>
    );
}

/** Share link and its settings for one mockup. */
export function SharePanel({
    mockup,
    onChange,
}: {
    mockup: Mockup;
    onChange: (mockup: Mockup) => void;
}) {
    const [error, setError] = useState<string>();
    const expiryId = useId();

    async function run(request: () => Promise<Mockup>) {
        setError(undefined);
        try {
            onChange(await request());
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    const save = (changes: Partial<Pick<Mockup, 'shareEnabled' | 'shareExpiresAt' | 'readOnly'>>) =>
        run(() => api.patch<Mockup>(`/mockups/${mockup.id}`, changes));

    function regenerate() {
        if (confirm('Create a new link? The current link will stop working for everyone.')) {
            void run(() => api.post<Mockup>(`/mockups/${mockup.id}/share/regenerate`));
        }
    }

    const state = shareState(mockup);

    return (
        <section class="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5">
            <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold">Share</h2>
                <span class="text-stone-500 text-xs">{state}</span>
            </div>
            <CopyField value={mockup.shareUrl} />
            <div class="flex flex-wrap gap-1">
                <a
                    href={mockup.shareUrl}
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                >
                    <IconExternalLink size={16} />
                    Open link
                </a>
                <Button variant="ghost" onClick={regenerate}>
                    <IconRefresh size={16} />
                    New link
                </Button>
            </div>
            <Checkbox
                label="Link enabled"
                hint="When off, only you can open the mockup."
                checked={mockup.shareEnabled}
                onChange={(shareEnabled) => void save({ shareEnabled })}
            />
            <Checkbox
                label="Read-only"
                hint="Reviewers can see comments but not add new ones."
                checked={mockup.readOnly}
                onChange={(readOnly) => void save({ readOnly })}
            />
            <div class="flex flex-col gap-1.5">
                <label class="font-medium text-sm" for={expiryId}>
                    Expires
                </label>
                <div class="flex gap-2">
                    <input
                        id={expiryId}
                        type="datetime-local"
                        value={toLocalInput(mockup.shareExpiresAt)}
                        onChange={(e) => {
                            const value = e.currentTarget.value;
                            void save({
                                shareExpiresAt: value ? new Date(value).toISOString() : null,
                            });
                        }}
                        class="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
                    />
                    {mockup.shareExpiresAt ? (
                        <Button variant="ghost" onClick={() => void save({ shareExpiresAt: null })}>
                            Clear
                        </Button>
                    ) : null}
                </div>
                <p class="text-stone-500 text-xs">Leave empty for a link that never expires.</p>
            </div>
            <FormError message={error} />
        </section>
    );
}
