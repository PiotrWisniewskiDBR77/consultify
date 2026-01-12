/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/security/**/*.test.js'],
        exclude: ['node_modules/**'],
        env: {
            MOCK_DB: 'true',
            MOCK_REDIS: 'true',
            DB_TYPE: 'sqlite',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
