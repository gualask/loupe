import { useEffect, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { AccountTokenInfo, User } from '../../shared/api/auth.ts';
import { api, errorMessage } from '../lib/api.ts';
import { currentUser } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';
import { CenteredCard } from '../ui/CenteredCard.tsx';
import { FormError } from '../ui/FormError.tsx';
import { TextField } from '../ui/TextField.tsx';

const TITLES: Record<AccountTokenInfo['kind'], string> = {
    setup: 'Create the admin account',
    invite: 'Create your account',
    reset: 'Choose a new password',
};

/** Handles the single-use setup, invite and password-reset links. */
export function AccountLinkPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const token = params.token ?? '';
    const [info, setInfo] = useState<AccountTokenInfo | null>();
    const [form, setForm] = useState({ username: '', displayName: '', password: '' });
    const [error, setError] = useState<string>();
    const [pending, setPending] = useState(false);

    useEffect(() => {
        api.get<AccountTokenInfo>(`/auth/tokens/${token}`).then(setInfo, () => setInfo(null));
    }, [token]);

    async function submit(e: Event) {
        e.preventDefault();
        setPending(true);
        setError(undefined);
        try {
            const body = info?.kind === 'reset' ? { password: form.password } : form;
            currentUser.value = await api.post<User>(`/auth/tokens/${token}`, body);
            route('/', true);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setPending(false);
        }
    }

    if (info === undefined) return null;
    if (info === null) {
        return (
            <CenteredCard title="Link not valid">
                <p class="text-sm text-stone-600">
                    This link is invalid, expired or already used. Ask an admin for a new one.
                </p>
            </CenteredCard>
        );
    }

    const set = (field: keyof typeof form) => (e: Event) =>
        setForm({ ...form, [field]: (e.currentTarget as HTMLInputElement).value });

    return (
        <CenteredCard title={TITLES[info.kind]}>
            <form class="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
                {info.kind === 'reset' ? (
                    <p class="text-sm text-stone-600">
                        Account: <strong>{info.username}</strong>
                        {/* Lets password managers store the new password for this account. */}
                        <input
                            type="text"
                            autocomplete="username"
                            value={info.username}
                            hidden
                            readOnly
                        />
                    </p>
                ) : (
                    <>
                        {info.kind === 'invite' && (
                            <p class="text-sm text-stone-600">
                                You have been invited as <strong>{info.role}</strong>.
                            </p>
                        )}
                        <TextField
                            label="Username"
                            autocomplete="username"
                            required
                            pattern="[A-Za-z0-9._\-]{3,32}"
                            hint="3–32 characters: letters, digits, dot, dash or underscore."
                            value={form.username}
                            onInput={set('username')}
                        />
                        <TextField
                            label="Display name"
                            autocomplete="name"
                            required
                            maxLength={64}
                            value={form.displayName}
                            onInput={set('displayName')}
                        />
                    </>
                )}
                <TextField
                    label="Password"
                    type="password"
                    autocomplete="new-password"
                    required
                    minLength={10}
                    hint="At least 10 characters."
                    value={form.password}
                    onInput={set('password')}
                />
                <FormError message={error} />
                <Button type="submit" disabled={pending}>
                    {info.kind === 'reset' ? 'Set password' : 'Create account'}
                </Button>
            </form>
        </CenteredCard>
    );
}
