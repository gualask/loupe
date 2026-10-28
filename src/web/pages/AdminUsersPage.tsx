import { useState } from 'preact/hooks';
import type { AccountLink, AdminUser, Role } from '../../shared/api/auth.ts';
import { AppShell } from '../components/AppShell.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { formatDateTime, ROLE_LABELS } from '../lib/format.ts';
import { useResource } from '../lib/resource.ts';
import { currentUser } from '../lib/session.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { CopyField } from '../ui/CopyField.tsx';
import { FormError } from '../ui/FormError.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { Section } from '../ui/Section.tsx';
import { Select } from '../ui/Select.tsx';
import { CARD_CLASS } from '../ui/styles.ts';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

/** A single-use account link to copy, with how long it works: "<label> until <date>." */
function AccountLinkField({ link, label }: { link: AccountLink; label: string }) {
    return (
        <div class="flex flex-col gap-1.5">
            <CopyField value={link.url} />
            <p class="text-stone-500 text-xs">
                {label} until {formatDateTime(link.expiresAt)}.
            </p>
        </div>
    );
}

function InviteSection() {
    const [role, setRole] = useState<Role>('editor');
    // The role of the last link stays with it, whatever the select shows next.
    const [invite, setInvite] = useState<{ role: Role; link: AccountLink }>();
    const { error, pending, run } = useAction();

    const createInvite = () =>
        run(async () =>
            setInvite({ role, link: await api.post<AccountLink>('/admin/invites', { role }) }),
        );

    return (
        <div class={CARD_CLASS}>
            <Section
                title="Invite someone"
                description="Create a single-use link and send it yourself. It expires after 48 hours."
            >
                <div class="flex flex-wrap items-center gap-2">
                    <Select label="Role" value={role} onChange={(r) => setRole(r as Role)}>
                        {ROLES.map((r) => (
                            <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                            </option>
                        ))}
                    </Select>
                    <Button disabled={pending} onClick={createInvite}>
                        Create invite link
                    </Button>
                </div>
                {invite ? (
                    <AccountLinkField
                        link={invite.link}
                        label={`${ROLE_LABELS[invite.role]} invite, valid`}
                    />
                ) : null}
                <FormError message={error} />
            </Section>
        </div>
    );
}

function UserRow({ user, onChange }: { user: AdminUser; onChange: (user: AdminUser) => void }) {
    const isSelf = user.id === currentUser.value?.id;
    const [resetLink, setResetLink] = useState<AccountLink>();
    const { error, pending, run } = useAction();

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
                    <p class="flex flex-wrap items-center gap-2">
                        <span
                            class={`font-medium ${user.disabled ? 'text-stone-400 line-through' : ''}`}
                        >
                            {user.displayName}
                        </span>
                        <Badge>{user.disabled ? 'Disabled' : ROLE_LABELS[user.role]}</Badge>
                        {isSelf && <span class="text-stone-500 text-xs">(you)</span>}
                    </p>
                    <p class="text-stone-500 text-xs">@{user.username}</p>
                </div>
                {!isSelf && (
                    <div class="flex flex-wrap gap-1">
                        {!user.disabled && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                    update({
                                        role: user.role === 'admin' ? 'editor' : 'admin',
                                    })
                                }
                            >
                                {user.role === 'admin' ? 'Make editor' : 'Make admin'}
                            </Button>
                        )}
                        {!user.disabled && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                onClick={createResetLink}
                            >
                                Reset link
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => update({ disabled: !user.disabled })}
                        >
                            {user.disabled ? 'Enable' : 'Disable'}
                        </Button>
                    </div>
                )}
            </div>
            {resetLink ? (
                <AccountLinkField link={resetLink} label="Password reset link, valid" />
            ) : null}
            <FormError message={error} />
        </li>
    );
}

export function AdminUsersPage() {
    const users = useResource('/admin/users', api.get<AdminUser[]>);

    const replace = (updated: AdminUser) =>
        users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));

    return (
        <AppShell>
            <div class="flex flex-col gap-6">
                <PageHeader title="Users" />
                <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    {users.status === 'ready' ? (
                        <ul class={`divide-y divide-stone-100 ${CARD_CLASS}`}>
                            {users.data.map((user) => (
                                <UserRow key={user.id} user={user} onChange={replace} />
                            ))}
                        </ul>
                    ) : (
                        <LoadStatus resource={users} />
                    )}
                    <div class="xl:col-start-2">
                        <InviteSection />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
