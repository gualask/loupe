import type { Author } from '../../shared/api/reviews.ts';
import { authorColor, initials } from '../lib/colors.ts';
import { Badge } from '../ui/Badge.tsx';
import { AVATAR } from '../ui/styles.ts';

export function Avatar({ author, size = 'md' }: { author: Author; size?: keyof typeof AVATAR }) {
    const px = AVATAR[size];
    return (
        <span
            class="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white"
            style={{
                width: `${px}px`,
                height: `${px}px`,
                fontSize: `${px * 0.42}px`,
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
        <span class="inline-flex max-w-44 shrink-0 items-center gap-1.5 font-medium">
            <span class="truncate">{author.displayName}</span>
            {author.kind === 'editor' ? <Badge>Editor</Badge> : null}
        </span>
    );
}
