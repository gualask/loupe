// The API sends a message with every error; responses that are not from it (a proxy's 502, a
// rejected cross-site request) get one from their status.
function fallbackMessage(status: number) {
    return status >= 500
        ? `The server had a problem (error ${status}). Retry later.`
        : `The request failed (error ${status}). Reload the page and retry.`;
}

/** An error response from the API: `{ error: <code>, message }`. */
export class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message?: string) {
        super(message ?? fallbackMessage(status));
        this.status = status;
        this.code = code;
    }
}

type Headers = Record<string, string>;

let onSignedOut = () => {};

/** Called when a request finds the session gone: expired, ended elsewhere or revoked. */
export function handleSignedOut(handler: () => void) {
    onSignedOut = handler;
}

async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Headers = {},
): Promise<T> {
    const json = body !== undefined && !(body instanceof FormData);
    const res = await fetch(`/api${path}`, {
        method,
        headers: json ? { ...headers, 'content-type': 'application/json' } : headers,
        body: json ? JSON.stringify(body) : (body as FormData | undefined),
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.error === 'unauthenticated') onSignedOut();
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown_error', data.message);
    return data as T;
}

export const api = {
    get: <T>(path: string, headers?: Headers) => request<T>('GET', path, undefined, headers),
    post: <T>(path: string, body?: unknown, headers?: Headers) =>
        request<T>('POST', path, body, headers),
    patch: <T>(path: string, body?: unknown, headers?: Headers) =>
        request<T>('PATCH', path, body, headers),
    delete: (path: string, headers?: Headers) => request<void>('DELETE', path, undefined, headers),
    /** Posts `file` as the `file` field of a multipart form, as a file input would. */
    upload: <T>(path: string, file: File) => {
        const form = new FormData();
        form.set('file', file);
        return request<T>('POST', path, form);
    },
};

/** A message suitable for showing next to a form. */
export function errorMessage(error: unknown) {
    if (error instanceof ApiError) return error.message;
    return 'Something went wrong. Check your connection and retry.';
}
