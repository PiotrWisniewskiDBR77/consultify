/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/performance/**/*.test.js'],
        exclude: ['node_modules/**'],
        env: {
            MOCK_DB: 'true',
            MOCK_REDIS: 'true',
            DB_TYPE: 'sqlite',
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
