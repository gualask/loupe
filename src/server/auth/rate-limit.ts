/** Counts failures per key in a fixed window; in memory, which is enough for a single process. */
export function createFailureLimiter({ max, windowMs }: { max: number; windowMs: number }) {
    const failures = new Map<string, { count: number; resetAt: number }>();

    function current(key: string) {
        const entry = failures.get(key);
        if (entry && entry.resetAt <= Date.now()) {
            failures.delete(key);
            return undefined;
        }
        return entry;
    }

    return {
        isBlocked(key: string) {
            return (current(key)?.count ?? 0) >= max;
        },
        recordFailure(key: string) {
            const entry = current(key);
            if (entry) entry.count += 1;
            else failures.set(key, { count: 1, resetAt: Date.now() + windowMs });
        },
        reset(key: string) {
            failures.delete(key);
        },
    };
}
