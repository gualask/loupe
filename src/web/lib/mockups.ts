import type { Mockup, ThreadTotals } from '../../shared/api/projects.ts';
import { api } from './api.ts';
import { confirmDialog } from './confirm.ts';
import { plural } from './format.ts';

// Every change to a mockup goes through here, with the confirmation it needs. A change the user
// cancels resolves to undefined or false.

export const uploadMockup = (projectId: string, file: File) =>
    api.upload<Mockup>(`/projects/${projectId}/mockups`, file);

export const renameMockup = (mockup: Mockup, name: string) =>
    api.patch<Mockup>(`/mockups/${mockup.id}`, { name });

export const setArchived = (mockup: Mockup, archived: boolean) =>
    api.patch<Mockup>(`/mockups/${mockup.id}`, { archived });

/** The feedback a new version would hide, e.g. "3 comment threads"; empty without. */
function hiddenFeedback({ openThreads, resolvedThreads }: ThreadTotals) {
    const threads = openThreads + resolvedThreads;
    return threads ? plural(threads, 'comment thread') : '';
}

/** Uploads the next version, first confirming when it would hide feedback on the current one. */
export async function uploadVersion(mockup: Mockup, file: File) {
    // Reviewers may have commented since the page loaded.
    const { activity, version } = await api.get<Mockup>(`/mockups/${mockup.id}`);
    const hidden = hiddenFeedback(activity);
    if (hidden) {
        const confirmed = await confirmDialog({
            title: `Upload version ${version.number + 1}?`,
            message: `The ${hidden} on version ${version.number} will no longer be shown. The share link stays the same.`,
            confirmLabel: 'Upload',
        });
        if (!confirmed) return undefined;
    }
    return api.upload<Mockup>(`/mockups/${mockup.id}/versions`, file);
}

/** Deletes an earlier version, with its comments; resolves to whether it was deleted. */
export async function deleteVersion(mockup: Mockup, number: number) {
    const confirmed = await confirmDialog({
        title: `Delete version ${number}?`,
        message:
            'Its comments will be lost too, and reviewers will no longer be able to compare with it. This cannot be undone.',
        confirmLabel: 'Delete version',
        danger: true,
    });
    if (!confirmed) return false;
    await api.delete(`/mockups/${mockup.id}/versions/${number}`);
    return true;
}

export async function regenerateShareLink(mockup: Mockup) {
    const confirmed = await confirmDialog({
        title: 'Create a new link?',
        message: 'The current link will stop working for everyone.',
        confirmLabel: 'Create new link',
        danger: true,
    });
    if (!confirmed) return undefined;
    return api.post<Mockup>(`/mockups/${mockup.id}/share/regenerate`);
}

export async function deleteMockup(mockup: Mockup) {
    const confirmed = await confirmDialog({
        title: `Delete "${mockup.name}"?`,
        message: 'Its comments will be lost too. This cannot be undone.',
        confirmLabel: 'Delete mockup',
        danger: true,
    });
    if (!confirmed) return false;
    await api.delete(`/mockups/${mockup.id}`);
    return true;
}
