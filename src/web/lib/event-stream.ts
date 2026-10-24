const MAX_RETRY_MS = 30_000;

/**
 * Reads a Server-Sent Events stream with fetch, so requests can carry headers, and reconnects
 * with backoff. `onOpen` runs on every (re)connection. Returns the function that closes it.
 */
export function openEventStream<T>(
    url: string,
    headers: Record<string, string>,
    handlers: { onOpen: () => void; onEvent: (event: T) => void },
) {
    let stopped = false;
    let controller: AbortController | undefined;

    async function readOnce() {
        controller = new AbortController();
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok || !res.body) throw new Error(`event stream failed: ${res.status}`);
        handlers.onOpen();
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
            const { value, done } = await reader.read();
            if (done) return;
            buffer += value;
            let end = buffer.indexOf('\n\n');
            while (end >= 0) {
                const data = buffer
                    .slice(0, end)
                    .split('\n')
                    .filter((line) => line.startsWith('data:'))
                    .map((line) => line.slice(5).trimStart())
                    .join('\n');
                buffer = buffer.slice(end + 2);
                if (data) handlers.onEvent(JSON.parse(data) as T);
                end = buffer.indexOf('\n\n');
            }
        }
    }

    void (async () => {
        let delay = 1000;
        while (!stopped) {
            const started = Date.now();
            await readOnce().catch(() => undefined);
            if (stopped) return;
            // A connection that stayed up for a while resets the backoff.
            delay = Date.now() - started > MAX_RETRY_MS ? 1000 : Math.min(delay * 2, MAX_RETRY_MS);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    })();

    return () => {
        stopped = true;
        controller?.abort();
    };
}
