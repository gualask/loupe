import { Badge } from '../ui/Badge.tsx';

/** Beside an item's name, the open threads waiting for an editor's reply; nothing without any. */
export function AwaitingBadge({ count }: { count: number }) {
    if (!count) return null;
    return (
        <Badge tone="warning" title="Open threads whose latest comment is a reviewer's">
            {`${count} awaiting reply`}
        </Badge>
    );
}
