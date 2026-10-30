import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useFormSubmit } from '../lib/form.ts';
import { currentUser, login, nextPath } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';
import { CenteredCard } from '../ui/CenteredCard.tsx';
import { FormError } from '../ui/FormError.tsx';
import { PasswordField } from '../ui/PasswordField.tsx';
import { TextField } from '../ui/TextField.tsx';

export function LoginPage() {
    const { route, query } = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { error, pending, submit } = useFormSubmit(() => login(username, password));
    const signedIn = !!currentUser.value;

    useEffect(() => {
        if (signedIn) route(nextPath(query.next, location.origin), true);
    }, [signedIn, route, query.next]);

    return (
        <CenteredCard title="Sign in">
            <form class="flex flex-col gap-4" onSubmit={submit}>
                <TextField
                    label="Username"
                    autocomplete="username"
                    required
                    value={username}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                />
                <PasswordField
                    label="Password"
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
