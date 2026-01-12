import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
    {
        ignores: [
            'dist',
            'coverage',
            'coverage-mywork',
            'node_modules',
            'node_modules_trash',
            'node_modules 2',
            '**/trash_node_modules*/**',
            'playwright-report',
            '*.config.js',
            'server/**/*.js',
            'server/**/*.d.ts',
            'backup-pre-migration/**',
            'backup/**',
            'scripts/migration-drafts/**',
            'quarantine/**',
            '**/*.d.ts',
            '**/* 2.tsx',
            '**/* 2.ts',
            '**/*2.tsx',
            '**/*2.ts',
            'tests/**'
        ]
    },
    {
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            // Prettier must be last to override other configs
            prettierConfig,
        ],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'off' // Keep off for now to avoid noise during transition
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'simple-import-sort': simpleImportSort,
            'prettier': prettierPlugin,
        },
        rules: {
            // ==========================================
            // FORMATTING & IMPORTS
            // ==========================================
            'prettier/prettier': 'error',
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',

            // ==========================================
            // CRITICAL RULES
            // ==========================================
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-var': 'error',
            'no-debugger': 'error',
            'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
            'no-async-promise-executor': 'error',
            'prefer-const': 'error',
            'eqeqeq': ['error', 'always', { 'null': 'ignore' }],

            // ==========================================
            // TYPESCRIPT
            // ==========================================
            '@typescript-eslint/no-explicit-any': 'warn', // Downgrade to warn for now
            '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',

            // ==========================================
            // REACT
            // ==========================================
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
        },
    },
);
