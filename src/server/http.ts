import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

/**
 * Error response shape for the whole API: `{ error: <code>, message }`. The code is for
 * programs, the message is shown to people as is.
 */
export function apiError(status: ContentfulStatusCode, error: string, message: string) {
    return new HTTPException(status, { res: Response.json({ error, message }, { status }) });
}

/** Anything missing, or that the requester may not know exists. */
export function notFound() {
    return apiError(404, 'not_found', 'Not found: it may have been deleted, or the link changed.');
}

/** Parses a JSON body with a Zod schema, or fails with 400 `invalid_request`. */
export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw apiError(400, 'invalid_request', z.prettifyError(parsed.error));
    return parsed.data;
}
