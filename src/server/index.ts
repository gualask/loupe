import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { issueSetupLinkIfNeeded } from './auth/accounts.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/client.ts';
import { deleteExpiredSessions } from './db/sessions.ts';

const config = loadConfig();
const db = openDb(path.join(config.dataDir, 'loupe.db'));
deleteExpiredSessions(db);
const app = createApp({ db, config, bridgeFile: './dist/bridge/bridge.js' });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Loupe listening on port ${info.port} (${config.publicUrl})`);
    const setup = issueSetupLinkIfNeeded(db, config);
    if (setup) {
        console.log(`\nNo accounts yet. Create the first admin with this one-time link:`);
        console.log(`  ${setup.url}\n(valid until ${setup.expiresAt})\n`);
    }
});

function shutdown() {
    server.close(() => {
        db.$client.close();
        process.exit(0);
    });
    // Event streams never end on their own; close them so close() can finish.
    if ('closeAllConnections' in server) server.closeAllConnections();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
