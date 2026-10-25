import type { Author } from '../../shared/api/reviews.ts';
import { authorColor, initials } from '../lib/colors.ts';

export function Avatar({ author, size = 24 }: { author: Author; size?: number }) {
    return (
        <span
            class="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                fontSize: `${size * 0.42}px`,
                background: authorColor(author),
            }}
            title={author.displayName}
        >
            {initials(author.displayName)}
        </span>
    );
}

export function AuthorName({ author }: { author: Author }) {
    return (
        <span class="inline-flex items-center gap-1.5 font-medium">
            {author.displayName}
            {author.kind === 'editor' ? (
                <span class="rounded bg-stone-800 px-1 py-px font-semibold text-[10px] text-white uppercase tracking-wide">
                    Editor
                </span>
            ) : null}
        </span>
    );
}
