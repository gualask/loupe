import type { TargetedEvent } from 'preact';
import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { AccountTokenInfo, User } from '../../shared/api/auth.ts';
import { api } from '../lib/api.ts';
import { useFormSubmit } from '../lib/form.ts';
import { useResource } from '../lib/resource.ts';
import { currentUser } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';
import { CenteredCard } from '../ui/CenteredCard.tsx';
import { FormError } from '../ui/FormError.tsx';
import { CenteredLoadStatus } from '../ui/LoadStatus.tsx';
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
    const resource = useResource(`/auth/tokens/${token}`, api.get<AccountTokenInfo>);
    const [form, setForm] = useState({ username: '', displayName: '', password: '' });
    const { error, pending, submit } = useFormSubmit(async () => {
        const reset = resource.status === 'ready' && resource.data.kind === 'reset';
        const body = reset ? { password: form.password } : form;
        currentUser.value = await api.post<User>(`/auth/tokens/${token}`, body);
        route('/', true);
    });

    if (resource.status !== 'ready') {
        return (
            <CenteredLoadStatus
                resource={resource}
                missingTitle="Link not valid"
                missing="This link is invalid, expired or already used. Ask an admin for a new one."
            />
        );
    }
    const info = resource.data;

    const set = (field: keyof typeof form) => (e: TargetedEvent<HTMLInputElement>) =>
        setForm({ ...form, [field]: e.currentTarget.value });
    const signedIn = currentUser.value;

    return (
        <CenteredCard title={TITLES[info.kind]}>
            <form class="flex flex-col gap-4" onSubmit={submit}>
                {/* E.g. an admin opening an invite link they just created, to check it. */}
                {signedIn ? (
                    <p class="rounded-md bg-amber-50 p-3 text-amber-800 text-sm">
                        You are signed in as <strong>{signedIn.username}</strong>. Continuing signs
                        you out and into the account of this link.
                    </p>
                ) : null}
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
