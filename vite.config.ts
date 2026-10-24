import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const serverUrl = `http://127.0.0.1:${process.env.LOUPE_PORT ?? 3000}`;

export default defineConfig({
    plugins: [preact(), tailwindcss()],
    build: {
        outDir: 'dist/web',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        // The Hono server owns the API, the mockup documents and the health check.
        proxy: {
            '/api': serverUrl,
            '/healthz': serverUrl,
            '^/s/[^/]+/content': serverUrl,
        },
    },
});
