import type { Context } from 'hono';
import { Hono } from 'hono';
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
import { countThreadsByViewer, lastCommentsByViewer, threadActivity } from '../db/threads.ts';
import { listViewers } from '../db/viewers.ts';
import { apiError, notFound, parseJson } from '../http.ts';
import { canManage } from '../mockups/access.ts';
import { deleteUnreferencedFiles, storeMockupFile } from '../mockups/files.ts';
import { toMockup, toProject } from '../mockups/present.ts';
import { createUploadReader } from '../mockups/upload.ts';
import type { Hub } from '../review/hub.ts';
import { toReviewerSummaries } from '../review/present.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/**
 * Whether a request is a mockup upload (`POST /projects/:id/mockups` and
 * `POST /mockups/:id/versions` below): it has its own size limit, so the API-wide JSON limit
 * (app.ts) does not apply.
 */
export function isMockupUpload(path: string) {
    return /^\/api\/(projects\/[^/]+\/mockups|mockups\/[^/]+\/versions)$/.test(path);
}

export function projectRoutes({ db, config, hub }: AppDeps & { hub: Hub }) {
    /** The project, if it exists and the signed-in user manages it (404 otherwise). */
    function managedProject(c: Context<AppEnv>, id: string) {
        const row = findProject(db, id);
        if (!row || !canManage(signedInUser(c), row.project.ownerId)) throw notFound();
        return row;
    }

    /** The mockup with its project, if the signed-in user manages it (404 otherwise). */
    function managedMockup(c: Context<AppEnv>, id: string) {
        const row = findMockup(db, id);
        if (!row) throw notFound();
        return { ...row, project: managedProject(c, row.mockup.projectId) };
    }

    /** Feedback on the current versions of the given mockups, looked up per mockup. */
    function activityOf(rows: MockupWithVersion[]) {
        const versionIds = rows.map((row) => row.version.id);
        const threadsOf = threadActivity(db, versionIds);
        return ({ version }: MockupWithVersion) => threadsOf(version.id);
    }

    /** A mockup as the API shows it, with the feedback on its current version. */
    const presentMockup = (row: ReturnType<typeof managedMockup>) =>
        toMockup(config, row, row.project, activityOf([row])(row));

    const cleanUpFiles = () =>
        deleteUnreferencedFiles(config.dataDir, () => referencedFileHashes(db));

    const upload = createUploadReader(config.maxUploadBytes);

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
                mockups: rows.map((m) => toMockup(config, m, row, activity(m))),
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
            const mockups = listMockups(db, row.project.id);
            deleteProject(db, row.project.id);
            for (const { version } of mockups) hub.close(version.id);
            await cleanUpFiles();
            return c.body(null, 204);
        })
        .post('/projects/:id/mockups', upload.limit, async (c) => {
            const row = managedProject(c, c.req.param('id'));
            const { fields, bytes, fileInfo } = await upload.read(c);
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
        .post('/mockups/:id/versions', upload.limit, async (c) => {
            // Same link and viewers; the new version starts without threads.
            const { mockup, version } = managedMockup(c, c.req.param('id'));
            const archived = () =>
                apiError(409, 'archived', 'Unarchive this mockup to upload a new version.');
            // Before receiving the file, then again when storing it (insertVersion).
            if (mockup.archivedAt) throw archived();
            const { bytes, fileInfo } = await upload.read(c);
            const result = await storeMockupFile(config.dataDir, bytes, (sha256) =>
                insertVersion(db, mockup.id, {
                    sha256,
                    ...fileInfo,
                    uploadedBy: signedInUser(c).id,
                }),
            );
            if (result === 'archived') {
                await cleanUpFiles();
                throw archived();
            }
            if (result === 'same_file') {
                throw apiError(409, 'same_file', 'This file is the same as the current version.');
            }
            // Review spaces of the previous version reconnect and learn it changed.
            hub.close(version.id);
            return c.json(presentMockup(managedMockup(c, mockup.id)), 201);
        })
        .get('/mockups/:id', (c) => c.json(presentMockup(managedMockup(c, c.req.param('id')))))
        .patch('/mockups/:id', async (c) => {
            const { mockup, version } = managedMockup(c, c.req.param('id'));
            const { archived, ...changes } = await parseJson(c, updateMockupRequestSchema);
            updateMockup(db, mockup.id, {
                ...changes,
                // Archiving again keeps the date the work was first concluded.
                ...(archived !== undefined && {
                    archivedAt: archived ? (mockup.archivedAt ?? new Date()) : null,
                }),
            });
            // Open review spaces stop or resume accepting changes at once.
            if (archived !== undefined && archived !== !!mockup.archivedAt) {
                hub.publish(version.id, { type: 'archived', archived });
            }
            return c.json(presentMockup(managedMockup(c, mockup.id)));
        })
        .post('/mockups/:id/share/regenerate', (c) => {
            const { mockup, version } = managedMockup(c, c.req.param('id'));
            updateMockup(db, mockup.id, { shareToken: randomToken() });
            // The old link stops at once, also for review spaces left open.
            hub.close(version.id);
            return c.json(presentMockup(managedMockup(c, mockup.id)));
        })
        .get('/mockups/:id/reviewers', (c) => {
            const { mockup, version } = managedMockup(c, c.req.param('id'));
            return c.json(
                toReviewerSummaries(
                    listViewers(db, mockup.id),
                    countThreadsByViewer(db, version.id),
                    lastCommentsByViewer(db, version.id),
                ),
            );
        })
        .delete('/mockups/:id', async (c) => {
            const { mockup, version } = managedMockup(c, c.req.param('id'));
            deleteMockup(db, mockup.id);
            hub.close(version.id);
            await cleanUpFiles();
            return c.body(null, 204);
        });
}
