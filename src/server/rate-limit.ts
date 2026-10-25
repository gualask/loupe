/** Counts events per key in a fixed window; in memory, which is enough for a single process. */
export function createWindowLimiter({ max, windowMs }: { max: number; windowMs: number }) {
    const counts = new Map<string, { count: number; resetAt: number }>();
    let nextSweep = Date.now() + windowMs;

    function current(key: string) {
        const entry = counts.get(key);
        if (entry && entry.resetAt <= Date.now()) {
            counts.delete(key);
            return undefined;
        }
        return entry;
    }

    /** Drops expired windows of keys that never came back, at most once per window. */
    function sweep() {
        const now = Date.now();
        if (now < nextSweep) return;
        nextSweep = now + windowMs;
        for (const [key, entry] of counts) if (entry.resetAt <= now) counts.delete(key);
    }

    return {
        /**
         * Records an event unless the key has reached its limit; returns whether it was allowed.
         * Checking and recording are one step, so no await can slip between them and let
         * parallel requests all pass.
         */
        take(key: string) {
            sweep();
            const entry = current(key);
            if (entry && entry.count >= max) return false;
            if (entry) entry.count += 1;
            else counts.set(key, { count: 1, resetAt: Date.now() + windowMs });
            return true;
        },
        reset(key: string) {
            counts.delete(key);
        },
    };
}
