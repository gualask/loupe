import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { currentUser } from '../lib/session.ts';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';

/** Renders children for signed-in users (admins only with `admin`), otherwise redirects to login. */
export function RequireUser({ admin, children }: { admin?: boolean; children: ComponentChildren }) {
    const user = currentUser.value;
    const { route, url } = useLocation();

    const signedOut = user === null;
    useEffect(() => {
        if (signedOut) route(`/login?next=${encodeURIComponent(url)}`, true);
    }, [signedOut, route, url]);

    if (!user) return null;
    if (admin && user.role !== 'admin') return <NotFoundPage />;
    return <>{children}</>;
}
