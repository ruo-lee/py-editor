import { defineConfig } from 'vite';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
    base: '/',
    server: {
        port: 3000,
        proxy: {
            '/api': 'http://localhost:8080',
            '/workspace': 'http://localhost:8080',
        },
    },
    plugins: [
        (monacoEditorPlugin.default || monacoEditorPlugin)({
            languageWorkers: ['editorWorkerService', 'json', 'css', 'html', 'typescript'],
        }),
    ],
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                manualChunks: {
                    'monaco-editor': ['monaco-editor'],
                },
            },
        },
    },
    optimizeDeps: {
        include: ['monaco-editor'],
    },
});
