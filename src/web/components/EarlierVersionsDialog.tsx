import { IconTrash } from '@tabler/icons-preact';
import type { Mockup, MockupVersion } from '../../shared/api/projects.ts';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { uploadedFrom } from '../lib/format.ts';
import { deleteVersion } from '../lib/mockups.ts';
import { useResource } from '../lib/resource.ts';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogActions } from '../ui/Dialog.tsx';
import { FormError } from '../ui/FormError.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { CARD_CLASS, ICON, TEXT } from '../ui/styles.ts';

/**
 * The versions of a mockup before its current one, which reviewers can compare with; deleting
 * one removes it, and its comments, for everyone.
 */
export function EarlierVersionsDialog({
    mockup,
    onClose,
}: {
    mockup: Mockup;
    onClose: () => void;
}) {
    const resource = useResource(`/mockups/${mockup.id}/versions`, api.get<MockupVersion[]>);
    const action = useAction();

    const remove = (number: number) =>
        action.run(async () => {
            if (await deleteVersion(mockup, number)) {
                resource.update((versions) => versions.filter((v) => v.number !== number));
            }
        });

    return (
        <Dialog title="Earlier versions" busy={action.pending} onClose={onClose}>
            <p class={TEXT.secondary}>
                Reviewers can show them beside the current version to compare. Delete one that
                should no longer be seen.
            </p>
            <div class="mt-4">
                {resource.status !== 'ready' ? (
                    <LoadStatus resource={resource} />
                ) : resource.data.length ? (
                    <ul class={`max-h-80 divide-y divide-stone-100 overflow-y-auto ${CARD_CLASS}`}>
                        {resource.data.map((version) => (
                            <li key={version.number} class="flex items-center gap-3 px-4 py-2.5">
                                <div class="min-w-0 flex-1">
                                    <p class="font-medium text-sm text-stone-900">
                                        Version {version.number}
                                    </p>
                                    <p class={`truncate ${TEXT.meta}`}>{uploadedFrom(version)}</p>
                                </div>
                                <IconButton
                                    label={`Delete version ${version.number}`}
                                    disabled={action.pending}
                                    onClick={() => remove(version.number)}
                                >
                                    <IconTrash size={ICON.md} />
                                </IconButton>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p class={TEXT.secondary}>No earlier versions left.</p>
                )}
            </div>
            <FormError message={action.error} />
            <DialogActions>
                <Button variant="secondary" disabled={action.pending} onClick={onClose}>
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
}
