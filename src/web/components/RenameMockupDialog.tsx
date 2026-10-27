import { useState } from 'preact/hooks';
import { type Mockup, NAME_MAX_LENGTH } from '../../shared/api/projects.ts';
import { renameMockup } from '../lib/mockups.ts';
import { FormDialog } from '../ui/FormDialog.tsx';
import { TextField } from '../ui/TextField.tsx';

/** The name of a mockup. `onSaved` gets the renamed mockup; the caller then closes the dialog. */
export function RenameMockupDialog({
    mockup,
    onSaved,
    onClose,
}: {
    mockup: Mockup;
    onSaved: (mockup: Mockup) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(mockup.name);

    return (
        <FormDialog
            title="Rename mockup"
            submitLabel="Save"
            onSubmit={async () => onSaved(await renameMockup(mockup, name))}
            onClose={onClose}
        >
            <TextField
                label="Mockup name"
                required
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
            />
        </FormDialog>
    );
}
