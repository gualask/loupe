import type { Mockup } from '../../shared/api/projects.ts';

export function shareState(mockup: Mockup) {
    if (!mockup.shareEnabled) return 'Not shared';
    if (mockup.shareExpiresAt && new Date(mockup.shareExpiresAt) <= new Date()) return 'Expired';
    return 'Shared';
}
