import { useState } from 'preact/hooks';
import type { Mockup } from '../../shared/api/projects.ts';
import type { Review, ReviewerSummary } from '../../shared/api/reviews.ts';
import { api } from '../lib/api.ts';
import { formatRelative } from '../lib/format.ts';
import { useResource } from '../lib/resource.ts';
import { formatThreadCounts, VERDICT_LABELS } from '../lib/review.ts';
import { reviewSpaceHref } from '../lib/share.ts';
import { Badge } from '../ui/Badge.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { Section } from '../ui/Section.tsx';
import { ROW_HOVER_CLASS } from '../ui/styles.ts';
import { Avatar } from './Avatar.tsx';

// Below the side-by-side layout, rows after these wait behind "Show all".
const FIRST_ROWS = 8;

type Standing = 'changes' | 'progress' | 'none' | 'approved';

/** Where a viewer's feedback stands; listed in this order, what needs attention first. */
const STANDINGS: Standing[] = ['changes', 'progress', 'none', 'approved'];

function standing(review: Review | null): Standing {
    if (!review) return 'none';
    if (review.status === 'in_progress') return 'progress';
    return review.verdict === 'changes_requested' ? 'changes' : 'approved';
}

/** "12 approved · 6 changes requested · 6 pending", leaving out what is zero. */
function summarize(reviewers: ReviewerSummary[]) {
    const count = (wanted: Standing[]) =>
        reviewers.filter(({ review }) => wanted.includes(standing(review))).length;
    return [
        [count(['approved']), 'approved'],
        [count(['changes']), 'changes requested'],
        [count(['progress', 'none']), 'pending'],
    ]
        .filter(([n]) => n)
        .map(([n, label]) => `${n} ${label}`)
        .join(' · ');
}

function Verdict({ review }: { review: Review | null }) {
    const verdict = review?.status === 'submitted' ? review.verdict : null;
    if (!verdict) {
        return <span class="text-stone-500 text-xs">{review ? 'In progress' : 'No feedback'}</span>;
    }
    return (
        <Badge tone={verdict === 'approved' ? 'good' : 'warning'}>{VERDICT_LABELS[verdict]}</Badge>
    );
}

/**
 * Viewers of a mockup with their verdict and comment counts, those needing attention first;
 * each opens their pins.
 */
export function ReviewsPanel({ mockup }: { mockup: Mockup }) {
    const resource = useResource(`/mockups/${mockup.id}/reviews`, api.get<ReviewerSummary[]>);
    const [showAll, setShowAll] = useState(false);
    // The API lists the most recently seen first, an order the stable sort keeps within a standing.
    const reviewers =
        resource.status === 'ready'
            ? [...resource.data].sort(
                  (a, b) =>
                      STANDINGS.indexOf(standing(a.review)) - STANDINGS.indexOf(standing(b.review)),
              )
            : undefined;
    const folded = !showAll && (reviewers?.length ?? 0) > FIRST_ROWS;

    return (
        <Section
            title="Reviews"
            aside={
                reviewers?.length ? (
                    <span class="text-sm text-stone-500">{reviewers.length}</span>
                ) : null
            }
            description={reviewers?.length ? summarize(reviewers) : undefined}
            flush={!!reviewers?.length}
        >
            {reviewers?.length ? (
                <>
                    <ul class="divide-y divide-stone-100 text-sm">
                        {reviewers.map(({ viewer, review, threads, lastSeenAt }, i) => (
                            <li
                                key={viewer.id}
                                class={folded && i >= FIRST_ROWS ? 'hidden lg:block' : ''}
                            >
                                <a
                                    href={reviewSpaceHref(mockup, viewer.id)}
                                    class={`flex items-center gap-3 px-5 py-3 ${ROW_HOVER_CLASS}`}
                                >
                                    <Avatar author={viewer} size={28} />
                                    <span class="min-w-0 flex-1">
                                        <span
                                            class="block truncate font-medium"
                                            title={viewer.displayName}
                                        >
                                            {viewer.displayName}
                                        </span>
                                        <span class="block truncate text-stone-500 text-xs">
                                            {formatThreadCounts(threads.open, threads.resolved)}
                                        </span>
                                    </span>
                                    <span class="flex shrink-0 flex-col items-end gap-0.5">
                                        <Verdict review={review} />
                                        <span class="text-stone-400 text-xs">
                                            seen {formatRelative(lastSeenAt)}
                                        </span>
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                    {folded ? (
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            class={`w-full border-stone-100 border-t px-5 py-3 font-medium text-sm text-stone-600 hover:text-stone-900 lg:hidden ${ROW_HOVER_CLASS}`}
                        >
                            Show all {reviewers.length}
                        </button>
                    ) : null}
                </>
            ) : reviewers ? (
                <p class="text-sm text-stone-500">Nobody has opened the share link yet.</p>
            ) : (
                <LoadStatus resource={resource} />
            )}
        </Section>
    );
}
