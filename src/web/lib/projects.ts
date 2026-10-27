import type { Project } from '../../shared/api/projects.ts';
import { api } from './api.ts';
import { plural } from './format.ts';

// Every change to a project goes through here, with the confirmation it needs.

/** What a project form edits. */
export type ProjectFields = Pick<Project, 'name' | 'description'>;

export const createProject = (fields: ProjectFields) => api.post<Project>('/projects', fields);

export const updateProject = (project: Project, fields: ProjectFields) =>
    api.patch<Project>(`/projects/${project.id}`, fields);

/** Deletes a project with its `mockups` once confirmed; false when the user changes their mind. */
export async function deleteProject(project: Project, mockups: number) {
    const warning = mockups
        ? ` Its ${plural(mockups, 'mockup')} and all their comments will be lost.`
        : '';
    if (!confirm(`Delete "${project.name}"?${warning} This cannot be undone.`)) return false;
    await api.delete(`/projects/${project.id}`);
    return true;
}
