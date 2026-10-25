import { IconChevronRight } from '@tabler/icons-preact';
import { type ComponentChildren, Fragment } from 'preact';

/** Breadcrumbs ending with the page title, the page actions on the same row, and a description. */
export function PageHeader({
    trail = [],
    title,
    description,
    actions,
}: {
    trail?: { href: string; label: string }[];
    title: string;
    description?: string;
    actions?: ComponentChildren;
}) {
    return (
        <div class="flex flex-col gap-1">
            <div class="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <nav
                    aria-label="Breadcrumb"
                    class="flex min-w-0 items-center gap-1.5 text-stone-500"
                >
                    {/* Crumbs give way first, so the title stays readable on narrow screens. */}
                    {trail.map(({ href, label }) => (
                        <Fragment key={href}>
                            <a href={href} class="min-w-8 shrink-[3] truncate hover:text-stone-900">
                                {label}
                            </a>
                            <IconChevronRight size={16} class="shrink-0 text-stone-400" />
                        </Fragment>
                    ))}
                    <h1 class="truncate font-semibold text-lg text-stone-900">{title}</h1>
                </nav>
                {actions ? <div class="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            {description ? <p class="text-sm text-stone-600">{description}</p> : null}
        </div>
    );
}
