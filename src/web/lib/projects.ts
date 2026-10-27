import type { Project } from '../../shared/api/projects.ts';
import { api } from './api.ts';
import { confirmDialog } from './confirm.ts';
import { plural } from './format.ts';

// Every change to a project goes through here, with the confirmation it needs.

/** What a project form edits. */
type ProjectFields = Pick<Project, 'name' | 'description'>;

export const createProject = (fields: ProjectFields) => api.post<Project>('/projects', fields);

export const updateProject = (project: Project, fields: ProjectFields) =>
    api.patch<Project>(`/projects/${project.id}`, fields);

/** Deletes a project with its `mockups` once confirmed; false when the user changes their mind. */
export async function deleteProject(project: Project, mockups: number) {
    const warning = mockups
        ? `Its ${plural(mockups, 'mockup')} and all their comments will be lost. `
        : '';
    const confirmed = await confirmDialog({
        title: `Delete "${project.name}"?`,
        message: `${warning}This cannot be undone.`,
        confirmLabel: 'Delete project',
        danger: true,
    });
    if (!confirmed) return false;
    await api.delete(`/projects/${project.id}`);
    return true;
}
