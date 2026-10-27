import { useState } from 'preact/hooks';
import {
    DESCRIPTION_MAX_LENGTH,
    NAME_MAX_LENGTH,
    type Project,
} from '../../shared/api/projects.ts';
import { createProject, updateProject } from '../lib/projects.ts';
import { FormDialog } from '../ui/FormDialog.tsx';
import { TextField } from '../ui/TextField.tsx';

/**
 * The name and description of a new project, or of `project` when editing it. `onSaved` gets the
 * project as saved; the caller then closes the dialog.
 */
export function ProjectDialog({
    project,
    onSaved,
    onClose,
}: {
    project?: Project;
    onSaved: (project: Project) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(project?.name ?? '');
    const [description, setDescription] = useState(project?.description ?? '');

    const save = async () => {
        const fields = { name, description };
        onSaved(await (project ? updateProject(project, fields) : createProject(fields)));
    };

    return (
        <FormDialog
            title={project ? 'Edit project' : 'New project'}
            submitLabel={project ? 'Save' : 'Create project'}
            onSubmit={save}
            onClose={onClose}
        >
            <TextField
                label="Project name"
                required
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
            />
            <TextField
                label="Description (optional)"
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={description}
                onInput={(e) => setDescription(e.currentTarget.value)}
            />
        </FormDialog>
    );
}
