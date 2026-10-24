import type { Context } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
    createProjectRequestSchema,
    updateMockupRequestSchema,
    updateProjectRequestSchema,
} from '../../shared/api/projects.ts';
import { randomToken } from '../auth/crypto.ts';
import { signedInUser } from '../auth/session.ts';
import {
    deleteMockup,
    findMockup,
    insertMockup,
    listMockups,
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
import { apiError, parseJson } from '../http.ts';
import { canManage, toMockup, toProject } from '../mockups/access.ts';
import {
    decodeHtml,
    deleteUnreferencedFiles,
    findExternalRefs,
    storeMockupFile,
} from '../mockups/files.ts';
import type { AppDeps, AppEnv } from '../types.ts';

// Multipart framing and the name field on top of the file itself.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export function projectRoutes({ db, config }: AppDeps) {
    /** The project, if it exists and the signed-in user manages it (404 otherwise). */
    function managedProject(c: Context<AppEnv>, id: string) {
        const row = findProject(db, id);
        if (!row || !canManage(signedInUser(c), row.project.ownerId))
            throw apiError(404, 'not_found');
        return row;
    }

    function managedMockup(c: Context<AppEnv>, id: string) {
        const row = findMockup(db, id);
        if (!row) throw apiError(404, 'not_found');
        managedProject(c, row.mockup.projectId);
        return row;
    }

    const cleanUpFiles = () => deleteUnreferencedFiles(config.dataDir, referencedFileHashes(db));

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
            const mockups = listMockups(db, row.project.id).map((m) => toMockup(config, m));
            return c.json({ ...toProject(row), mockups });
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
        .post(
            '/projects/:id/mockups',
            bodyLimit({
                maxSize: config.maxUploadBytes + MULTIPART_OVERHEAD_BYTES,
                onError: () => {
                    throw apiError(413, 'file_too_large', 'The file exceeds the upload limit.');
                },
            }),
            async (c) => {
                const row = managedProject(c, c.req.param('id'));
                const body = await c.req.parseBody();
                const file = body.file;
                if (!(file instanceof File))
                    throw apiError(400, 'invalid_request', 'Missing file.');
                if (file.size > config.maxUploadBytes) {
                    throw apiError(413, 'file_too_large', 'The file exceeds the upload limit.');
                }
                const bytes = new Uint8Array(await file.arrayBuffer());
                const html = decodeHtml(bytes);
                if (!html)
                    throw apiError(400, 'not_html', 'The file is not a UTF-8 HTML document.');

                const fallbackName = file.name.replace(/\.html?$/i, '') || 'Untitled mockup';
                const name = (typeof body.name === 'string' && body.name.trim()) || fallbackName;
                const sha256 = await storeMockupFile(config.dataDir, bytes);
                const id = insertMockup(
                    db,
                    {
                        projectId: row.project.id,
                        name: name.slice(0, 120),
                        shareToken: randomToken(),
                        createdBy: signedInUser(c).id,
                    },
                    {
                        sha256,
                        sizeBytes: bytes.byteLength,
                        originalFilename: file.name,
                        externalRefs: findExternalRefs(html),
                    },
                );
                return c.json(toMockup(config, managedMockup(c, id)), 201);
            },
        )
        .get('/mockups/:id', (c) => c.json(toMockup(config, managedMockup(c, c.req.param('id')))))
        .patch('/mockups/:id', async (c) => {
            const { mockup } = managedMockup(c, c.req.param('id'));
            const { shareExpiresAt, ...changes } = await parseJson(c, updateMockupRequestSchema);
            updateMockup(db, mockup.id, {
                ...changes,
                ...(shareExpiresAt !== undefined && {
                    shareExpiresAt: shareExpiresAt ? new Date(shareExpiresAt) : null,
                }),
            });
            return c.json(toMockup(config, managedMockup(c, mockup.id)));
        })
        .post('/mockups/:id/share/regenerate', (c) => {
            const { mockup } = managedMockup(c, c.req.param('id'));
            updateMockup(db, mockup.id, { shareToken: randomToken() });
            return c.json(toMockup(config, managedMockup(c, mockup.id)));
        })
        .delete('/mockups/:id', async (c) => {
            const { mockup } = managedMockup(c, c.req.param('id'));
            deleteMockup(db, mockup.id);
            await cleanUpFiles();
            return c.body(null, 204);
        });
}
