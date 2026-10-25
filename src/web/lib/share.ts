import type { Mockup } from '../../shared/api/projects.ts';

/** The token at the end of a mockup's share link (`<public URL>/s/<token>`). */
export function shareToken(mockup: Mockup) {
    return mockup.shareUrl.slice(mockup.shareUrl.lastIndexOf('/') + 1);
}

export function shareState(mockup: Mockup) {
    if (!mockup.shareEnabled) return 'Not shared';
    if (mockup.shareExpiresAt && new Date(mockup.shareExpiresAt) <= new Date()) return 'Expired';
    return 'Shared';
}
