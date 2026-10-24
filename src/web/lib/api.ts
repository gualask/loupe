/** An error response from the API: `{ error: <code>, message? }`. */
export class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message?: string) {
        super(message ?? code);
        this.status = status;
        this.code = code;
    }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const json = body !== undefined && !(body instanceof FormData);
    const res = await fetch(`/api${path}`, {
        method,
        headers: json ? { 'content-type': 'application/json' } : undefined,
        body: json ? JSON.stringify(body) : (body as FormData | undefined),
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown_error', data.message);
    return data as T;
}

export const api = {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    delete: (path: string) => request<void>('DELETE', path),
};

/** A message suitable for showing next to a form. */
export function errorMessage(error: unknown) {
    if (error instanceof ApiError) return error.message;
    return 'Something went wrong. Check your connection and retry.';
}
