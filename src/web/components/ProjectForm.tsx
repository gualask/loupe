import { useState } from 'preact/hooks';
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from '../../shared/api/projects.ts';
import type { ProjectFields } from '../lib/projects.ts';
import { FormCard } from '../ui/FormCard.tsx';
import { TextField } from '../ui/TextField.tsx';

/** The name and description of a new or existing project. */
export function ProjectForm({
    initial = { name: '', description: '' },
    submitLabel,
    onSubmit,
    onCancel,
}: {
    initial?: ProjectFields;
    submitLabel: string;
    onSubmit: (fields: ProjectFields) => Promise<unknown>;
    onCancel: () => void;
}) {
    const [name, setName] = useState(initial.name);
    const [description, setDescription] = useState(initial.description);

    return (
        <FormCard
            submitLabel={submitLabel}
            onSubmit={() => onSubmit({ name, description })}
            onCancel={onCancel}
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
        </FormCard>
    );
}
