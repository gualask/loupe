import { useState } from 'preact/hooks';
import type { Mockup } from '../../shared/api/projects.ts';
import type { ReviewerSummary } from '../../shared/api/reviews.ts';
import { api } from '../lib/api.ts';
import { formatRelative } from '../lib/format.ts';
import { useResource } from '../lib/resource.ts';
import { reviewSpaceHref } from '../lib/share.ts';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { Section } from '../ui/Section.tsx';
import { ROW_HOVER_CLASS } from '../ui/styles.ts';
import { Avatar } from './Avatar.tsx';
import { ThreadCounts } from './ThreadCounts.tsx';

// Below the side-by-side layout, rows after these wait behind "Show all".
const FIRST_ROWS = 8;

/**
 * Viewers of a mockup with their comment counts, the most recently active first, under the
 * counts of the whole version; each opens their pins.
 */
export function ReviewersPanel({ mockup }: { mockup: Mockup }) {
    const resource = useResource(`/mockups/${mockup.id}/reviewers`, api.get<ReviewerSummary[]>);
    const [showAll, setShowAll] = useState(false);
    const reviewers = resource.status === 'ready' ? resource.data : undefined;
    const folded = !showAll && (reviewers?.length ?? 0) > FIRST_ROWS;
    const { openThreads, resolvedThreads } = mockup.activity;

    return (
        <Section
            title="Reviewers"
            aside={
                reviewers?.length ? (
                    <span class="text-sm text-stone-500">{reviewers.length}</span>
                ) : null
            }
            description={
                reviewers?.length ? (
                    <ThreadCounts open={openThreads} resolved={resolvedThreads} />
                ) : undefined
            }
            flush={!!reviewers?.length}
        >
            {reviewers?.length ? (
                <>
                    <ul class="divide-y divide-stone-100 text-sm">
                        {reviewers.map(({ viewer, threads, lastActivityAt }, i) => (
                            <li
                                key={viewer.id}
                                class={folded && i >= FIRST_ROWS ? 'hidden lg:block' : ''}
                            >
                                <a
                                    href={reviewSpaceHref(mockup, viewer.id)}
                                    class={`flex items-center gap-3 px-5 py-3 ${ROW_HOVER_CLASS}`}
                                >
                                    <Avatar author={viewer} size="md" />
                                    <span class="min-w-0 flex-1">
                                        <span
                                            class="block truncate font-medium"
                                            title={viewer.displayName}
                                        >
                                            {viewer.displayName}
                                        </span>
                                        <ThreadCounts
                                            open={threads.open}
                                            resolved={threads.resolved}
                                        />
                                    </span>
                                    {lastActivityAt ? (
                                        <span class="shrink-0 text-stone-500 text-xs">
                                            last {formatRelative(lastActivityAt)}
                                        </span>
                                    ) : null}
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
                <p class="text-sm text-stone-600">Nobody has opened the share link yet.</p>
            ) : (
                <LoadStatus resource={resource} />
            )}
        </Section>
    );
}
