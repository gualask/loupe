import type { Review, ReviewerSummary } from '../../shared/api/reviews.ts';
import { api } from '../lib/api.ts';
import { formatRelative } from '../lib/format.ts';
import { useResource } from '../lib/resource.ts';
import { formatThreadCounts, VERDICT_LABELS } from '../lib/review.ts';
import { Badge } from '../ui/Badge.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { Avatar } from './Avatar.tsx';

function Verdict({ review }: { review: Review | null }) {
    const verdict = review?.status === 'submitted' ? review.verdict : null;
    if (!verdict) {
        return <span class="text-stone-500 text-xs">{review ? 'In progress' : 'No feedback'}</span>;
    }
    return (
        <Badge tone={verdict === 'approved' ? 'good' : 'warning'}>{VERDICT_LABELS[verdict]}</Badge>
    );
}

/** Viewers of a mockup with their verdict and comment counts; each opens their pins. */
export function ReviewsPanel({ mockupId, token }: { mockupId: string; token: string }) {
    const resource = useResource(`/mockups/${mockupId}/reviews`, api.get<ReviewerSummary[]>);
    const reviewers = resource.status === 'ready' ? resource.data : undefined;

    return (
        <section class="flex flex-col text-sm">
            <h2 class="px-5 py-4 font-semibold">Reviews</h2>
            {reviewers?.length ? (
                <ul class="divide-y divide-stone-100 border-stone-100 border-t">
                    {reviewers.map(({ viewer, review, threads, lastSeenAt }) => (
                        <li key={viewer.id}>
                            <a
                                href={`/s/${token}?viewer=${viewer.id}`}
                                class="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-stone-50"
                            >
                                <Avatar author={viewer} size={28} />
                                <span class="min-w-32 flex-1">
                                    <span class="block font-medium">{viewer.displayName}</span>
                                    <span class="text-stone-500 text-xs">
                                        {formatThreadCounts(threads.open, threads.resolved)} · seen{' '}
                                        {formatRelative(lastSeenAt)}
                                    </span>
                                </span>
                                <Verdict review={review} />
                            </a>
                        </li>
                    ))}
                </ul>
            ) : reviewers ? (
                <p class="border-stone-100 border-t px-5 py-4 text-stone-500">
                    Nobody has opened the share link yet.
                </p>
            ) : (
                <div class="px-5 pb-4">
                    <LoadStatus resource={resource} />
                </div>
            )}
        </section>
    );
}
