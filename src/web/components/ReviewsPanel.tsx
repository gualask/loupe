import { IconMessages } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import type { Review, ReviewerSummary } from '../../shared/api/reviews.ts';
import { api } from '../lib/api.ts';
import { formatRelative } from '../lib/format.ts';
import { Avatar } from '../viewer/Avatar.tsx';

function Verdict({ review }: { review: Review | null }) {
    if (review?.status !== 'submitted') {
        return <span class="text-stone-500 text-xs">{review ? 'In progress' : 'No feedback'}</span>;
    }
    const approved = review.verdict === 'approved';
    return (
        <span
            class={`rounded-full px-2 py-0.5 text-xs ${approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
        >
            {approved ? 'Approved' : 'Changes requested'}
        </span>
    );
}

/** Viewers of a mockup with their verdict and comment counts; each opens their pins. */
export function ReviewsPanel({ mockupId, token }: { mockupId: string; token: string }) {
    const [reviewers, setReviewers] = useState<ReviewerSummary[]>();

    useEffect(() => {
        api.get<ReviewerSummary[]>(`/mockups/${mockupId}/reviews`).then(setReviewers, () =>
            setReviewers([]),
        );
    }, [mockupId]);

    return (
        <section class="flex flex-col rounded-xl border border-stone-200 bg-white text-sm">
            <header class="flex items-center justify-between gap-4 px-5 py-4">
                <h2 class="font-semibold">Reviews</h2>
                <a
                    href={`/s/${token}`}
                    class="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-3 py-2 font-medium text-white hover:bg-stone-700"
                >
                    <IconMessages size={16} />
                    Open review space
                </a>
            </header>
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
                                        {threads.open} open · {threads.resolved} resolved · seen{' '}
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
            ) : null}
        </section>
    );
}
