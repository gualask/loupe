import {
    IconArchive,
    IconArchiveOff,
    IconHistory,
    IconPencil,
    IconTrash,
} from '@tabler/icons-preact';
import type { Mockup } from '../../shared/api/projects.ts';
import { Menu, type MenuItem } from '../ui/Menu.tsx';
import type { IconButtonSize } from '../ui/styles.ts';
import { ICON } from '../ui/styles.ts';

/** The actions on a mockup, the same in the project list and on the mockup page. */
export function MockupMenu({
    mockup,
    size,
    disabled,
    onRename,
    onSetArchived,
    onEarlierVersions,
    onDelete,
}: {
    mockup: Mockup;
    size?: IconButtonSize;
    disabled?: boolean;
    onRename: () => void;
    onSetArchived: (archived: boolean) => void;
    onEarlierVersions: () => void;
    onDelete: () => void;
}) {
    const archived = mockup.archivedAt !== null;
    const earlierVersions: MenuItem[] =
        mockup.version.number > 1
            ? [
                  {
                      label: 'Earlier versions…',
                      icon: <IconHistory size={ICON.md} />,
                      onSelect: onEarlierVersions,
                  },
              ]
            : [];
    return (
        <Menu
            label={`Actions for ${mockup.name}`}
            size={size}
            disabled={disabled}
            items={[
                { label: 'Rename', icon: <IconPencil size={ICON.md} />, onSelect: onRename },
                archived
                    ? {
                          label: 'Unarchive',
                          icon: <IconArchiveOff size={ICON.md} />,
                          onSelect: () => onSetArchived(false),
                      }
                    : {
                          label: 'Archive',
                          icon: <IconArchive size={ICON.md} />,
                          onSelect: () => onSetArchived(true),
                      },
                ...earlierVersions,
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
