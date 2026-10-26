import { IconAlertTriangle } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import type { Mockup, MockupActivity } from '../../shared/api/projects.ts';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { formatBytes, formatDateTime, plural } from '../lib/format.ts';
import { FormError } from '../ui/FormError.tsx';
import { UploadDropzone } from './UploadDropzone.tsx';

/** The feedback a new version would hide, e.g. "3 comment threads and 1 review"; empty without. */
function hiddenFeedback({ openThreads, resolvedThreads, submittedReviews }: MockupActivity) {
    const threads = openThreads + resolvedThreads;
    return [
        threads ? plural(threads, 'comment thread') : '',
        submittedReviews ? plural(submittedReviews, 'review') : '',
    ]
        .filter(Boolean)
        .join(' and ');
}

/**
 * The current file of a mockup, with a warning when it is not self-contained, and the upload of
 * the next version.
 */
export function FilePanel({
    mockup,
    onChange,
}: {
    mockup: Mockup;
    onChange: (mockup: Mockup) => void;
}) {
    const { version } = mockup;
    const upload = useAction();
    // The upload itself, after the check of what it would hide.
    const [sending, setSending] = useState(false);

    const uploadVersion = (file: File) =>
        upload.run(async () => {
            // Reviewers may have commented since this page loaded.
            const { activity } = await api.get<Mockup>(`/mockups/${mockup.id}`);
            const hidden = hiddenFeedback(activity);
            const confirmed =
                !hidden ||
                confirm(
                    `Upload version ${version.number + 1}? The ${hidden} on version ${version.number} will no longer be shown. The share link stays the same.`,
                );
            if (!confirmed) return;
            setSending(true);
            try {
                onChange(await api.upload<Mockup>(`/mockups/${mockup.id}/versions`, file));
            } finally {
                setSending(false);
            }
        });

    return (
        <section class="flex flex-col gap-3 p-5 text-sm">
            <h2 class="font-semibold">File</h2>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt class="text-stone-500">Version</dt>
                <dd>{version.number}</dd>
                <dt class="text-stone-500">Name</dt>
                <dd class="truncate">{version.originalFilename}</dd>
                <dt class="text-stone-500">Size</dt>
                <dd>{formatBytes(version.sizeBytes)}</dd>
                <dt class="text-stone-500">Uploaded</dt>
                <dd>{formatDateTime(version.createdAt)}</dd>
            </dl>
            {version.externalRefs.length ? (
                <div class="rounded-md bg-amber-50 p-3 text-amber-800">
                    <p class="flex items-center gap-1.5 font-medium">
                        <IconAlertTriangle size={16} />
                        Not self-contained
                    </p>
                    <p class="mt-1 text-xs">
                        These resources are blocked unless the server allows external resources:
                    </p>
                    <ul class="mt-2 flex flex-col gap-0.5 font-mono text-xs">
                        {version.externalRefs.map((ref) => (
                            <li key={ref} class="truncate" title={ref}>
                                {ref}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <UploadDropzone
                compact
                busy={sending}
                label="Upload a new version"
                hint="Same link and reviewers; the new version starts without comments."
                onFile={uploadVersion}
            />
            <FormError message={upload.error} />
        </section>
    );
}
