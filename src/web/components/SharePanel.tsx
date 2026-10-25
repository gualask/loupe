import { IconExternalLink, IconRefresh } from '@tabler/icons-preact';
import { useId, useState } from 'preact/hooks';
import type { Mockup } from '../../shared/api/projects.ts';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { shareState } from '../lib/share.ts';
import { Button } from '../ui/Button.tsx';
import { CopyField } from '../ui/CopyField.tsx';
import { FormError } from '../ui/FormError.tsx';
import { buttonClass, INPUT_CLASS } from '../ui/styles.ts';

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
    disabled,
    onChange,
}: {
    label: string;
    hint: string;
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label class="flex cursor-pointer gap-3">
            <input
                type="checkbox"
                class="mt-0.5 size-4 accent-stone-900"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.currentTarget.checked)}
            />
            <span>
                <span class="block font-medium text-sm">{label}</span>
                <span class="block text-stone-500 text-xs">{hint}</span>
            </span>
        </label>
    );
}

type Settings = Partial<Pick<Mockup, 'shareEnabled' | 'shareExpiresAt' | 'readOnly'>>;

/** Share link and its settings for one mockup. */
export function SharePanel({
    mockup,
    onChange,
}: {
    mockup: Mockup;
    onChange: (mockup: Mockup) => void;
}) {
    // One change at a time, so two quick toggles cannot be saved out of order.
    const { error, pending, run } = useAction();
    // Shown while saving, so a control does not flip back until the server answers.
    const [saving, setSaving] = useState<Settings>({});
    const shown = { ...mockup, ...saving };
    const expiryId = useId();

    const apply = (request: () => Promise<Mockup>) =>
        run(async () => {
            try {
                onChange(await request());
            } finally {
                setSaving({});
            }
        });

    function save(changes: Settings) {
        setSaving(changes);
        apply(() => api.patch<Mockup>(`/mockups/${mockup.id}`, changes));
    }

    function regenerate() {
        if (confirm('Create a new link? The current link will stop working for everyone.')) {
            apply(() => api.post<Mockup>(`/mockups/${mockup.id}/share/regenerate`));
        }
    }

    const state = shareState(shown);

    return (
        <section class="flex flex-col gap-4 p-5">
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
                    class={buttonClass('ghost')}
                >
                    <IconExternalLink size={16} />
                    Open link
                </a>
                <Button variant="ghost" disabled={pending} onClick={regenerate}>
                    <IconRefresh size={16} />
                    New link
                </Button>
            </div>
            <Checkbox
                label="Link enabled"
                hint="When off, only you can open the mockup."
                checked={shown.shareEnabled}
                disabled={pending}
                onChange={(shareEnabled) => save({ shareEnabled })}
            />
            <Checkbox
                label="Read-only"
                hint="Reviewers can see comments but not add new ones."
                checked={shown.readOnly}
                disabled={pending}
                onChange={(readOnly) => save({ readOnly })}
            />
            <div class="flex flex-col gap-1.5">
                <label class="font-medium text-sm" for={expiryId}>
                    Expires
                </label>
                <div class="flex gap-2">
                    <input
                        id={expiryId}
                        type="datetime-local"
                        value={toLocalInput(shown.shareExpiresAt)}
                        disabled={pending}
                        onChange={(e) => {
                            const value = e.currentTarget.value;
                            save({
                                shareExpiresAt: value ? new Date(value).toISOString() : null,
                            });
                        }}
                        class={`min-w-0 flex-1 ${INPUT_CLASS}`}
                    />
                    {shown.shareExpiresAt ? (
                        <Button
                            variant="ghost"
                            disabled={pending}
                            onClick={() => save({ shareExpiresAt: null })}
                        >
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
