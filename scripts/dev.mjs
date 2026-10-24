// Runs the bridge build in watch mode, the Hono server with --watch and the Vite dev server.
import { spawn } from 'node:child_process';

const tasks = [
    ['bridge', 'pnpm', ['exec', 'vite', 'build', '-c', 'vite.bridge.config.ts', '--watch']],
    ['server', 'node', ['--watch', 'src/server/index.ts']],
    ['web', 'pnpm', ['exec', 'vite']],
];

const children = tasks.map(([name, command, args]) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const prefix = `[${name}] `;
    for (const stream of [child.stdout, child.stderr]) {
        stream.on('data', (chunk) => {
            const text = chunk.toString().replace(/\n(?=.)/g, `\n${prefix}`);
            process.stdout.write(prefix + text);
        });
    }
    child.on('exit', (code) => {
        if (code !== null && code !== 0) stopAll(code);
    });
    return child;
});

function stopAll(code = 0) {
    for (const child of children) child.kill('SIGTERM');
    process.exit(code);
}

process.on('SIGINT', () => stopAll());
process.on('SIGTERM', () => stopAll());
