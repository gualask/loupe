import { useEffect, useState } from 'preact/hooks';
import type { AccountLink, AdminUser, Role } from '../../shared/api/auth.ts';
import { AppShell } from '../components/AppShell.tsx';
import { api, errorMessage } from '../lib/api.ts';
import { currentUser } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';
import { CopyField } from '../ui/CopyField.tsx';
import { FormError } from '../ui/FormError.tsx';

function formatExpiry(link: AccountLink) {
    return new Date(link.expiresAt).toLocaleString();
}

function InviteSection() {
    const [role, setRole] = useState<Role>('editor');
    const [link, setLink] = useState<AccountLink>();
    const [error, setError] = useState<string>();

    async function createInvite() {
        setError(undefined);
        try {
            setLink(await api.post<AccountLink>('/admin/invites', { role }));
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    return (
        <section class="rounded-xl border border-stone-200 bg-white p-5">
            <h2 class="font-semibold">Invite someone</h2>
            <p class="mt-1 text-sm text-stone-500">
                Create a single-use link and send it yourself. It expires after 48 hours.
            </p>
            <div class="mt-4 flex flex-wrap items-center gap-2">
                <select
                    aria-label="Role"
                    value={role}
                    onChange={(e) => setRole(e.currentTarget.value as Role)}
                    class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                </select>
                <Button onClick={() => void createInvite()}>Create invite link</Button>
            </div>
            {link ? (
                <div class="mt-4 flex flex-col gap-1.5">
                    <CopyField value={link.url} />
                    <p class="text-stone-500 text-xs">Valid until {formatExpiry(link)}.</p>
                </div>
            ) : null}
            <div class="mt-3">
                <FormError message={error} />
            </div>
        </section>
    );
}

function UserRow({ user, onChange }: { user: AdminUser; onChange: (user: AdminUser) => void }) {
    const isSelf = user.id === currentUser.value?.id;
    const [resetLink, setResetLink] = useState<AccountLink>();
    const [error, setError] = useState<string>();

    async function run(action: () => Promise<void>) {
        setError(undefined);
        try {
            await action();
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    const update = (changes: { role?: Role; disabled?: boolean }) =>
        run(async () => {
            onChange(await api.patch<AdminUser>(`/admin/users/${user.id}`, changes));
            // A disabled account cannot redeem its reset link, so stop showing it.
            if (changes.disabled) setResetLink(undefined);
        });
    const createResetLink = () =>
        run(async () =>
            setResetLink(await api.post<AccountLink>(`/admin/users/${user.id}/reset-link`)),
        );

    return (
        <li class="flex flex-col gap-3 px-5 py-4">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div class="min-w-40 flex-1">
                    <p class={`font-medium ${user.disabled ? 'text-stone-400 line-through' : ''}`}>
                        {user.displayName}
                        {isSelf && <span class="ml-2 text-stone-400 text-xs">(you)</span>}
                    </p>
                    <p class="text-sm text-stone-500">@{user.username}</p>
                </div>
                <span class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700 text-xs capitalize">
                    {user.disabled ? 'disabled' : user.role}
                </span>
                {!isSelf && (
                    <div class="flex flex-wrap gap-1">
                        {!user.disabled && (
                            <Button
                                variant="ghost"
                                onClick={() =>
                                    void update({
                                        role: user.role === 'admin' ? 'editor' : 'admin',
                                    })
                                }
                            >
                                {user.role === 'admin' ? 'Make editor' : 'Make admin'}
                            </Button>
                        )}
                        {!user.disabled && (
                            <Button variant="ghost" onClick={() => void createResetLink()}>
                                Reset link
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            onClick={() => void update({ disabled: !user.disabled })}
                        >
                            {user.disabled ? 'Enable' : 'Disable'}
                        </Button>
                    </div>
                )}
            </div>
            {resetLink ? (
                <div class="flex flex-col gap-1.5">
                    <CopyField value={resetLink.url} />
                    <p class="text-stone-500 text-xs">
                        Password reset link, valid until {formatExpiry(resetLink)}.
                    </p>
                </div>
            ) : null}
            <FormError message={error} />
        </li>
    );
}

export function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        api.get<AdminUser[]>('/admin/users').then(setUsers, (err) => setError(errorMessage(err)));
    }, []);

    const replace = (updated: AdminUser) =>
        setUsers((list) => list?.map((u) => (u.id === updated.id ? updated : u)));

    return (
        <AppShell>
            <div class="flex flex-col gap-6">
                <h1 class="font-semibold text-2xl tracking-tight">Users</h1>
                <InviteSection />
                <FormError message={error} />
                {users ? (
                    <ul class="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
                        {users.map((user) => (
                            <UserRow key={user.id} user={user} onChange={replace} />
                        ))}
                    </ul>
                ) : null}
            </div>
        </AppShell>
    );
}
