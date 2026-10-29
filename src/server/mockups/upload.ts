import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { apiError } from '../http.ts';
import type { AppEnv } from '../types.ts';
import { decodeHtml, findExternalRefs } from './html.ts';

// Multipart framing and the name field on top of the file itself.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
// Longer names are cut: the name is only shown, and is sent with every listing of the mockup.
const MAX_FILENAME_LENGTH = 255;

const tooLarge = () => apiError(413, 'file_too_large', 'The file exceeds the upload limit.');

/** Reading of mockup uploads: a multipart form with an HTML `file` of at most `maxBytes`. */
export function createUploadReader(maxBytes: number) {
    return {
        /** Refuses a request body too large for any upload before it is read. */
        limit: bodyLimit({
            maxSize: maxBytes + MULTIPART_OVERHEAD_BYTES,
            onError: () => {
                throw tooLarge();
            },
        }),

        /** The HTML file of an upload, checked, with what is recorded about it and the form fields. */
        async read(c: Context<AppEnv>) {
            const fields = await c.req.parseBody();
            const { file } = fields;
            if (!(file instanceof File)) throw apiError(400, 'invalid_request', 'Missing file.');
            if (file.size > maxBytes) throw tooLarge();
            const bytes = new Uint8Array(await file.arrayBuffer());
            const html = decodeHtml(bytes);
            if (!html) throw apiError(400, 'not_html', 'The file is not a UTF-8 HTML document.');
            const fileInfo = {
                sizeBytes: bytes.byteLength,
                originalFilename: file.name.slice(0, MAX_FILENAME_LENGTH),
                externalRefs: findExternalRefs(html),
            };
            return { fields, bytes, fileInfo };
        },
    };
}
