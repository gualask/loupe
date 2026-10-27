import type { Mockup, MockupActivity } from '../../shared/api/projects.ts';
import { api } from './api.ts';
import { plural } from './format.ts';

// Every change to a mockup goes through here, with the confirmation it needs. A change the user
// cancels resolves to undefined or false.

export const uploadMockup = (projectId: string, file: File) =>
    api.upload<Mockup>(`/projects/${projectId}/mockups`, file);

export const renameMockup = (mockup: Mockup, name: string) =>
    api.patch<Mockup>(`/mockups/${mockup.id}`, { name });

export const setArchived = (mockup: Mockup, archived: boolean) =>
    api.patch<Mockup>(`/mockups/${mockup.id}`, { archived });

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

/** Uploads the next version, first confirming when it would hide feedback on the current one. */
export async function uploadVersion(mockup: Mockup, file: File) {
    // Reviewers may have commented since the page loaded.
    const { activity, version } = await api.get<Mockup>(`/mockups/${mockup.id}`);
    const hidden = hiddenFeedback(activity);
    if (
        hidden &&
        !confirm(
            `Upload version ${version.number + 1}? The ${hidden} on version ${version.number} will no longer be shown. The share link stays the same.`,
        )
    ) {
        return undefined;
    }
    return api.upload<Mockup>(`/mockups/${mockup.id}/versions`, file);
}

export async function regenerateShareLink(mockup: Mockup) {
    if (!confirm('Create a new link? The current link will stop working for everyone.')) {
        return undefined;
    }
    return api.post<Mockup>(`/mockups/${mockup.id}/share/regenerate`);
}

export async function deleteMockup(mockup: Mockup) {
    if (!confirm(`Delete "${mockup.name}" and all its comments? This cannot be undone.`)) {
        return false;
    }
    await api.delete(`/mockups/${mockup.id}`);
    return true;
}
