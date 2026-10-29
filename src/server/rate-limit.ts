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

/**
 * Runs at most `max` tasks at a time, in order, and lets at most `queue` more wait; beyond that a
 * task is refused at once, so a flood of requests cannot pile up work.
 */
export function createConcurrencyLimiter({ max, queue }: { max: number; queue: number }) {
    let running = 0;
    const waiting: (() => void)[] = [];

    async function run<T>(task: () => Promise<T>) {
        // Taken before the first await, so parallel calls all see the same count.
        if (running < max) running += 1;
        else await new Promise<void>((resolve) => waiting.push(resolve));
        try {
            return await task();
        } finally {
            // The slot passes straight to the next waiting task, so no newcomer can take it.
            const next = waiting.shift();
            if (next) next();
            else running -= 1;
        }
    }

    return {
        /** Runs `task` when a slot is free, or returns undefined when too many already wait. */
        tryRun<T>(task: () => Promise<T>) {
            if (running >= max && waiting.length >= queue) return undefined;
            return run(task);
        },
    };
}
