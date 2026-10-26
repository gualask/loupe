import type { Context } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
    createProjectRequestSchema,
    type ProjectDetail,
    updateMockupRequestSchema,
    updateProjectRequestSchema,
} from '../../shared/api/projects.ts';
import { randomToken } from '../auth/crypto.ts';
import { signedInUser } from '../auth/session.ts';
import {
    deleteMockup,
    findMockup,
    insertMockup,
    insertVersion,
    listMockups,
    type MockupWithVersion,
    referencedFileHashes,
    updateMockup,
} from '../db/mockups.ts';
import {
    deleteProject,
    findProject,
    insertProject,
    listProjects,
    updateProject,
} from '../db/projects.ts';
import { countSubmittedReviews, listReviews } from '../db/reviews.ts';
import { countThreadsByViewer, threadActivity } from '../db/threads.ts';
import { listViewers } from '../db/viewers.ts';
import { apiError, notFound, parseJson } from '../http.ts';
import { canManage } from '../mockups/access.ts';
import {
    decodeHtml,
    deleteUnreferencedFiles,
    findExternalRefs,
    storeMockupFile,
} from '../mockups/files.ts';
import { toMockup, toProject } from '../mockups/present.ts';
import { toReviewerSummaries } from '../review/present.ts';
import type { AppDeps, AppEnv } from '../types.ts';

// Multipart framing and the name field on top of the file itself.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Whether a request is a mockup upload (`POST /projects/:id/mockups` and
 * `POST /mockups/:id/versions` below): it has its own size limit, so the API-wide JSON limit
 * (app.ts) does not apply.
 */
export function isMockupUpload(path: string) {
    return /^\/api\/(projects\/[^/]+\/mockups|mockups\/[^/]+\/versions)$/.test(path);
}

export function projectRoutes({ db, config }: AppDeps) {
    /** The project, if it exists and the signed-in user manages it (404 otherwise). */
    function managedProject(c: Context<AppEnv>, id: string) {
        const row = findProject(db, id);
        if (!row || !canManage(signedInUser(c), row.project.ownerId)) throw notFound();
        return row;
    }

    function managedMockup(c: Context<AppEnv>, id: string) {
        const row = findMockup(db, id);
        if (!row) throw notFound();
        managedProject(c, row.mockup.projectId);
        return row;
    }

    /** Feedback on the current versions of the given mockups, looked up per mockup. */
    function activityOf(rows: MockupWithVersion[]) {
        const versionIds = rows.map((row) => row.version.id);
        const threadsOf = threadActivity(db, versionIds);
        const reviewsOf = countSubmittedReviews(db, versionIds);
        return ({ version }: MockupWithVersion) => ({
            ...threadsOf(version.id),
            submittedReviews: reviewsOf(version.id),
        });
    }

    /** A mockup as the API shows it, with the feedback on its current version. */
    const presentMockup = (row: MockupWithVersion) => toMockup(config, row, activityOf([row])(row));

    const cleanUpFiles = () =>
        deleteUnreferencedFiles(config.dataDir, () => referencedFileHashes(db));

    const uploadLimit = bodyLimit({
        maxSize: config.maxUploadBytes + MULTIPART_OVERHEAD_BYTES,
        onError: () => {
            throw apiError(413, 'file_too_large', 'The file exceeds the upload limit.');
        },
    });

    /** The HTML file of an upload, checked, with what is recorded about it and the form fields. */
    async function readUpload(c: Context<AppEnv>) {
        const fields = await c.req.parseBody();
        const { file } = fields;
        if (!(file instanceof File)) throw apiError(400, 'invalid_request', 'Missing file.');
        if (file.size > config.maxUploadBytes) {
            throw apiError(413, 'file_too_large', 'The file exceeds the upload limit.');
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const html = decodeHtml(bytes);
        if (!html) throw apiError(400, 'not_html', 'The file is not a UTF-8 HTML document.');
        const fileInfo = {
            sizeBytes: bytes.byteLength,
            originalFilename: file.name,
            externalRefs: findExternalRefs(html),
        };
        return { fields, bytes, fileInfo };
    }

    return new Hono<AppEnv>()
        .get('/projects', (c) => {
            const user = signedInUser(c);
            const rows = listProjects(db, user.role === 'admin' ? undefined : user.id);
            return c.json(rows.map(toProject));
        })
        .post('/projects', async (c) => {
            const input = await parseJson(c, createProjectRequestSchema);
            const id = insertProject(db, { ownerId: signedInUser(c).id, ...input });
            return c.json(toProject(managedProject(c, id)), 201);
        })
        .get('/projects/:id', (c) => {
            const row = managedProject(c, c.req.param('id'));
            const rows = listMockups(db, row.project.id);
            const activity = activityOf(rows);
            const body: ProjectDetail = {
                ...toProject(row),
                mockups: rows.map((m) => toMockup(config, m, activity(m))),
            };
            return c.json(body);
        })
        .patch('/projects/:id', async (c) => {
            const row = managedProject(c, c.req.param('id'));
            updateProject(db, row.project.id, await parseJson(c, updateProjectRequestSchema));
            return c.json(toProject(managedProject(c, row.project.id)));
        })
        .delete('/projects/:id', async (c) => {
            const row = managedProject(c, c.req.param('id'));
            deleteProject(db, row.project.id);
            await cleanUpFiles();
            return c.body(null, 204);
        })
        .post('/projects/:id/mockups', uploadLimit, async (c) => {
            const row = managedProject(c, c.req.param('id'));
            const { fields, bytes, fileInfo } = await readUpload(c);
            const fallbackName =
                fileInfo.originalFilename.replace(/\.html?$/i, '') || 'Untitled mockup';
            const name = (typeof fields.name === 'string' && fields.name.trim()) || fallbackName;
            const id = await storeMockupFile(config.dataDir, bytes, (sha256) =>
                insertMockup(
                    db,
                    {
                        projectId: row.project.id,
                        name: name.slice(0, 120),
                        shareToken: randomToken(),
                        createdBy: signedInUser(c).id,
                    },
                    { sha256, ...fileInfo },
                ),
            );
            return c.json(presentMockup(managedMockup(c, id)), 201);
        })
        .post('/mockups/:id/versions', uploadLimit, async (c) => {
            // Same link and viewers; the new version starts without threads or reviews.
            const { mockup } = managedMockup(c, c.req.param('id'));
            const { bytes, fileInfo } = await readUpload(c);
            const added = await storeMockupFile(config.dataDir, bytes, (sha256) =>
                insertVersion(db, mockup.id, {
                    sha256,
                    ...fileInfo,
                    uploadedBy: signedInUser(c).id,
                }),
            );
            if (!added) {
                throw apiError(409, 'same_file', 'This file is the same as the current version.');
            }
            return c.json(presentMockup(managedMockup(c, mockup.id)), 201);
        })
        .get('/mockups/:id', (c) => c.json(presentMockup(managedMockup(c, c.req.param('id')))))
        .patch('/mockups/:id', async (c) => {
            const { mockup } = managedMockup(c, c.req.param('id'));
            const { shareExpiresAt, ...changes } = await parseJson(c, updateMockupRequestSchema);
            updateMockup(db, mockup.id, {
                ...changes,
                ...(shareExpiresAt !== undefined && {
                    shareExpiresAt: shareExpiresAt ? new Date(shareExpiresAt) : null,
                }),
            });
            return c.json(presentMockup(managedMockup(c, mockup.id)));
        })
        .post('/mockups/:id/share/regenerate', (c) => {
            const { mockup } = managedMockup(c, c.req.param('id'));
            updateMockup(db, mockup.id, { shareToken: randomToken() });
            return c.json(presentMockup(managedMockup(c, mockup.id)));
        })
        .get('/mockups/:id/reviews', (c) => {
            const { mockup, version } = managedMockup(c, c.req.param('id'));
            return c.json(
                toReviewerSummaries(
                    listViewers(db, mockup.id),
                    countThreadsByViewer(db, version.id),
                    listReviews(db, version.id),
                ),
            );
        })
        .delete('/mockups/:id', async (c) => {
            const { mockup } = managedMockup(c, c.req.param('id'));
            deleteMockup(db, mockup.id);
            await cleanUpFiles();
            return c.body(null, 204);
        });
}
