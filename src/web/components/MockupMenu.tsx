import { IconArchive, IconArchiveOff, IconPencil, IconTrash } from '@tabler/icons-preact';
import type { Mockup } from '../../shared/api/projects.ts';
import { Menu } from '../ui/Menu.tsx';
import type { IconButtonSize } from '../ui/styles.ts';

/** The actions on a mockup, the same in the project list and on the mockup page. */
export function MockupMenu({
    mockup,
    size,
    disabled,
    onRename,
    onSetArchived,
    onDelete,
}: {
    mockup: Mockup;
    size?: IconButtonSize;
    disabled?: boolean;
    onRename: () => void;
    onSetArchived: (archived: boolean) => void;
    onDelete: () => void;
}) {
    const archived = mockup.archivedAt !== null;
    return (
        <Menu
            label={`Actions for ${mockup.name}`}
            size={size}
            disabled={disabled}
            items={[
                { label: 'Rename', icon: <IconPencil size={16} />, onSelect: onRename },
                archived
                    ? {
                          label: 'Unarchive',
                          icon: <IconArchiveOff size={16} />,
                          onSelect: () => onSetArchived(false),
                      }
                    : {
                          label: 'Archive',
                          icon: <IconArchive size={16} />,
                          onSelect: () => onSetArchived(true),
                      },
                {
                    label: 'Delete…',
                    icon: <IconTrash size={16} />,
                    danger: true,
                    onSelect: onDelete,
                },
            ]}
        />
    );
}
