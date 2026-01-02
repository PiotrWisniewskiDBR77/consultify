/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            // Ensure AI SDK mocks work for server/* tests
            // This routes server/node_modules/@google/generative-ai to main node_modules
            // '@google/generative-ai': path.resolve(__dirname, 'node_modules/@google/generative-ai'),
            // 'openai': path.resolve(__dirname, 'node_modules/openai'),
        },
    },
    // Disable .env loading in tests to avoid permission issues
    envPrefix: [],
    envDir: undefined, // Don't load .env files
    test: {
        globals: true,
        environment: 'jsdom',
        env: {
            MOCK_DB: 'true',
            MOCK_REDIS: 'true',
            DB_TYPE: 'sqlite',
            NODE_ENV: 'test',
        },
        setupFiles: './tests/setup.ts',
        include: ['tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/components/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/backend/**/*.{test,spec}.{js,ts,jsx,tsx}'],
        exclude: ['tests/e2e/**', 'tests/performance/**', 'node_modules/**'],
        // @ts-expect-error: environmentMatchGlobs is valid in newer vitest versions but types might be lagging
        environmentMatchGlobs: [
            ['tests/unit/backend/**', 'node'],
            ['tests/backend/**', 'node'],
            ['server/**', 'node'],
        ],
        reporters: ['default', 'junit'],
        outputFile: 'junit.xml',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{ts,tsx}', 'server/**/*.js'],
            exclude: [
                'src/vite-env.d.ts',
                '**/*.test.ts',
                '**/*.test.tsx',
                'tests/**',
                'server/scripts/**',
                'server/workers/**',
                'server/seed_*.js',
                'server/fix_*.js',
                'server/inspect_*.js',
                'server/migrate_*.js',
                'server/test-*.js',
                'server/database.postgres.js',
                'server/database.sqlite.js',
                '**/trash_node_modules_*/**',
            ],
            thresholds: {
                global: {
                    statements: 90,
                    branches: 90,
                    functions: 90,
                    lines: 90,
                },
                // Don't fail CI on coverage, just warn
                perFile: false,
            },
        },
    },
});
