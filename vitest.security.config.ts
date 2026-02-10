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
      MOCK_DB: 'false',
      MOCK_REDIS: 'true',
      DB_TYPE: 'sqlite',
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Universal server/src alias: .js → .ts
      {
        find: /^.*\/server\/src\/(.*)\.js$/,
        replacement: path.resolve(__dirname, 'server/src/$1.ts'),
      },
      // Bridge legacy server/services paths to server/src/services
      {
        find: /.*\/server\/services\/(.*)\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/$1.ts'),
      },
      {
        find: /.*\/server\/services\/(.*)$/,
        replacement: path.resolve(__dirname, 'server/src/services/$1'),
      },
      // Database module - redirect to TypeScript version
      {
        find: /.*\/server\/src\/database\/Database\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/Database.ts'),
      },
      // Database index
      {
        find: /.*\/src\/database\/index\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/index.ts'),
      },
      // Server index module
      {
        find: /.*\/server\/src\/index\.js$/,
        replacement: path.resolve(__dirname, 'server/src/index.ts'),
      },
      // Config modules
      {
        find: /.*\/server\/src\/config\/index\.js$/,
        replacement: path.resolve(__dirname, 'server/src/config/index.ts'),
      },
      {
        find: /.*\/config\/DatabaseConfig\.js$/,
        replacement: path.resolve(__dirname, 'server/src/config/DatabaseConfig.ts'),
      },
      {
        find: '../config/DatabaseConfig.js',
        replacement: path.resolve(__dirname, 'server/src/config/DatabaseConfig.ts'),
      },
      // Fix relative database imports
      {
        find: /^\.\.\/database\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/Database.ts'),
      },
      {
        find: /^\.\.\/\.\.\/database\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/Database.ts'),
      },
      // Mocks stay as JS
      { find: /^(\.?\.\/.*__mocks__.*)\.js$/, replacement: '$1.js' },
      // Global fallback: relative .js imports → .ts (with JS fallback)
      {
        find: /^(\.?\.\/.*)(?<!__mocks__\/.*)\.js$/,
        replacement: '$1.ts',
        customResolver: async function (updatedId, importer, options) {
          const tsResolution = await this.resolve(updatedId, importer, {
            ...options,
            skipSelf: true,
          });
          if (tsResolution) return tsResolution;
          const jsPath = updatedId.replace(/\.ts$/, '.js');
          return this.resolve(jsPath, importer, { ...options, skipSelf: true });
        },
      },
    ],
  },
});
