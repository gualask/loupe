import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

/** Error response shape for the whole API: `{ error: <code>, message? }`. */
export function apiError(status: ContentfulStatusCode, error: string, message?: string) {
    return new HTTPException(status, {
        res: Response.json(message ? { error, message } : { error }, { status }),
    });
}

/** Parses a JSON body with a Zod schema, or fails with 400 `invalid_request`. */
export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw apiError(400, 'invalid_request', z.prettifyError(parsed.error));
    return parsed.data;
}
