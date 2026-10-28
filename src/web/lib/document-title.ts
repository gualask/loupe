import { useEffect } from 'preact/hooks';

const APP_NAME = 'Loupe';

/** Names the browser tab after the page shown, so tabs and history entries tell pages apart. */
export function useDocumentTitle(title: string) {
    useEffect(() => {
        document.title = `${title} — ${APP_NAME}`;
        return () => {
            document.title = APP_NAME;
        };
    }, [title]);
}
