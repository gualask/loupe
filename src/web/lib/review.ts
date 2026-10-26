import type { Review } from '../../shared/api/reviews.ts';

export const VERDICT_LABELS: Record<NonNullable<Review['verdict']>, string> = {
    approved: 'Approved',
    changes_requested: 'Changes requested',
};

/** "2 open · 1 resolved" */
export const formatThreadCounts = (open: number, resolved: number) =>
    `${open} open · ${resolved} resolved`;
