import { IconZoomScan } from '@tabler/icons-preact';
import { ICON, TEXT } from './styles.ts';

/** The Loupe mark alone, where the name would crowd the bar. */
export function LogoMark() {
    return <IconZoomScan size={ICON.xl} stroke={1.75} class="shrink-0" />;
}

/** The Loupe mark and name, the same in the top bar and on signed-out screens. */
export function Logo() {
    return (
        <span class={`flex shrink-0 items-center gap-2 ${TEXT.heading}`}>
            <LogoMark />
            Loupe
        </span>
    );
}
