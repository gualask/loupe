import logoUrl from '../brand/logo.svg';
import { ICON, TEXT } from './styles.ts';

/** The Loupe mark alone, where the name would crowd the bar. */
export function LogoMark() {
    return <img src={logoUrl} width={ICON.xl} height={ICON.xl} alt="" class="shrink-0" />;
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
