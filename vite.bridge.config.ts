import { defineConfig } from 'vite';

// The bridge is inlined into served mockups, so it is built as a single self-contained script.
export default defineConfig({
    build: {
        outDir: 'dist/bridge',
        emptyOutDir: true,
        lib: {
            entry: 'src/bridge/main.ts',
            formats: ['iife'],
            name: 'LoupeBridge',
            fileName: () => 'bridge.js',
        },
    },
});
