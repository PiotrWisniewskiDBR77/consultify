/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './tests/setup.ts',
        include: ['tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/components/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/backend/**/*.{test,spec}.{js,ts,jsx,tsx}'],
        exclude: ['tests/e2e/**', 'tests/performance/**', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            all: true,
            include: ['src/**/*.{ts,tsx}', 'server/**/*.js'],
            exclude: ['src/vite-env.d.ts', '**/*.test.ts', '**/*.test.tsx', 'tests/**']
        },
    },
});
