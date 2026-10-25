// Maintenance commands, run inside the container as `loupe <command>`.
import { createAccountLink } from './auth/accounts.ts';
import { loadConfig } from './config.ts';
import { openDataDb } from './db/client.ts';
import { findUserByUsername } from './db/users.ts';

const USAGE = 'Usage: loupe reset-link <username>';

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

const [command, username] = process.argv.slice(2);
if (command !== 'reset-link' || !username) fail(USAGE);

const config = loadConfig();
const db = openDataDb(config.dataDir);
const user = findUserByUsername(db, username.toLowerCase());
if (!user) fail(`No user named "${username}".`);
if (user.disabledAt) fail(`User "${user.username}" is disabled.`);

const link = createAccountLink(db, config, { kind: 'reset', userId: user.id });
console.log(`Password reset link for ${user.username} (valid until ${link.expiresAt}):`);
console.log(link.url);
db.$client.close();
