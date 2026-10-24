import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/client.ts';

const config = loadConfig();
const db = openDb(path.join(config.dataDir, 'loupe.db'));
const app = createApp({ db });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Loupe listening on port ${info.port} (${config.publicUrl})`);
});

function shutdown() {
    server.close(() => {
        db.$client.close();
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
