import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { currentUser, loadSession, loginPath, sessionError } from '../lib/session.ts';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { CenteredLoadFailed } from '../ui/LoadStatus.tsx';

/**
 * Renders children for signed-in users (admins only with `admin`), otherwise redirects to login;
 * offers a retry when the session could not be checked.
 */
export function RequireUser({ admin, children }: { admin?: boolean; children: ComponentChildren }) {
    const user = currentUser.value;
    const { route, url } = useLocation();

    const signedOut = user === null;
    useEffect(() => {
        if (signedOut) route(loginPath(url), true);
    }, [signedOut, route, url]);

    const error = sessionError.value;
    if (error && user === undefined) {
        return <CenteredLoadFailed message={error} onRetry={() => void loadSession()} />;
    }
    if (!user) return null;
    if (admin && user.role !== 'admin') return <NotFoundPage />;
    return <>{children}</>;
}
