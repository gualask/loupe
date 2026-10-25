import type { Review } from '../../shared/api/reviews.ts';

export const VERDICT_LABELS: Record<NonNullable<Review['verdict']>, string> = {
    approved: 'Approved',
    changes_requested: 'Changes requested',
};
