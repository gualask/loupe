import { z } from 'zod';

const nameSchema = z.string().trim().min(1, 'Required').max(120, 'At most 120 characters');

export const createProjectRequestSchema = z.object({
    name: nameSchema,
    description: z.string().trim().max(500).default(''),
});

export const updateProjectRequestSchema = createProjectRequestSchema.partial();

export const updateMockupRequestSchema = z
    .object({
        name: nameSchema,
        shareEnabled: z.boolean(),
        /** ISO date-time, or null for no expiry. */
        shareExpiresAt: z.iso.datetime({ offset: true }).nullable(),
        readOnly: z.boolean(),
    })
    .partial();

export type Project = {
    id: string;
    name: string;
    description: string;
    owner: { id: string; displayName: string };
    mockupCount: number;
    createdAt: string;
};

type MockupVersion = {
    number: number;
    originalFilename: string;
    sizeBytes: number;
    /** External URLs referenced by the file; empty when it is self-contained. */
    externalRefs: string[];
    createdAt: string;
};

export type Mockup = {
    id: string;
    projectId: string;
    name: string;
    shareUrl: string;
    shareEnabled: boolean;
    shareExpiresAt: string | null;
    readOnly: boolean;
    version: MockupVersion;
    createdAt: string;
};

export type ProjectDetail = Project & { mockups: Mockup[] };

/** What a share link exposes before anything else is loaded. */
export type SharedMockup = { name: string; readOnly: boolean; contentUrl: string };
