import { IconPencil, IconTrash } from '@tabler/icons-preact';
import type { Project } from '../../shared/api/projects.ts';
import { Menu } from '../ui/Menu.tsx';
import type { IconButtonSize } from '../ui/styles.ts';
import { ICON } from '../ui/styles.ts';

/** The actions on a project, the same in the workspace list and on the project page. */
export function ProjectMenu({
    project,
    size,
    disabled,
    onEdit,
    onDelete,
}: {
    project: Project;
    size?: IconButtonSize;
    disabled?: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <Menu
            label={`Actions for ${project.name}`}
            size={size}
            disabled={disabled}
            items={[
                { label: 'Edit', icon: <IconPencil size={ICON.md} />, onSelect: onEdit },
                {
                    label: 'Delete…',
                    icon: <IconTrash size={ICON.md} />,
                    danger: true,
                    onSelect: onDelete,
                },
            ]}
        />
    );
}
