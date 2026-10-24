import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { errorMessage } from '../lib/api.ts';
import { currentUser, login } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';
import { CenteredCard } from '../ui/CenteredCard.tsx';
import { FormError } from '../ui/FormError.tsx';
import { TextField } from '../ui/TextField.tsx';

/** Only same-app paths, so a crafted link cannot redirect elsewhere after login. */
function safeNext(next: string | undefined) {
    return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function LoginPage() {
    const { route, query } = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string>();
    const [pending, setPending] = useState(false);
    const signedIn = !!currentUser.value;

    useEffect(() => {
        if (signedIn) route(safeNext(query.next), true);
    }, [signedIn, route, query.next]);

    async function submit(e: Event) {
        e.preventDefault();
        setPending(true);
        setError(undefined);
        try {
            await login(username, password);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setPending(false);
        }
    }

    return (
        <CenteredCard title="Sign in">
            <form class="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
                <TextField
                    label="Username"
                    autocomplete="username"
                    required
                    value={username}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                />
                <TextField
                    label="Password"
                    type="password"
                    autocomplete="current-password"
                    required
                    value={password}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                />
                <FormError message={error} />
                <Button type="submit" disabled={pending}>
                    Sign in
                </Button>
            </form>
            <p class="mt-4 text-stone-500 text-xs">
                Forgot your password? Ask an admin for a reset link.
            </p>
        </CenteredCard>
    );
}
