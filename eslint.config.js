import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'coverage', 'node_modules', 'node_modules_trash', 'node_modules 2', '**/trash_node_modules*/**', 'playwright-report', '*.config.js', 'server/**/*.js'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': 'off',
            
            // ==========================================
            // ENTERPRISE STRICT MODE RULES
            // ==========================================
            
            // TypeScript strict rules - PHASE 1 (warnings for gradual adoption)
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { 
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            '@typescript-eslint/explicit-function-return-type': 'off', // Too strict for now
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'off', // Requires strictNullChecks
            '@typescript-eslint/prefer-optional-chain': 'off', // Requires type-aware linting
            '@typescript-eslint/no-floating-promises': 'off', // Requires type-aware linting
            '@typescript-eslint/no-misused-promises': 'off', // Requires type-aware linting
            '@typescript-eslint/await-thenable': 'off', // Requires type-aware linting
            '@typescript-eslint/no-unsafe-assignment': 'off', // Too aggressive
            '@typescript-eslint/no-unsafe-member-access': 'off', // Too aggressive
            '@typescript-eslint/no-unsafe-call': 'off', // Too aggressive
            '@typescript-eslint/no-unsafe-return': 'off', // Too aggressive
            '@typescript-eslint/restrict-template-expressions': 'off', // Too aggressive
            '@typescript-eslint/no-empty-interface': 'warn',
            '@typescript-eslint/ban-ts-comment': ['warn', {
                'ts-expect-error': 'allow-with-description',
                'ts-ignore': 'allow-with-description',
                'ts-nocheck': true,
                'ts-check': false,
            }],
            
            // React Hooks
            'react-hooks/exhaustive-deps': 'warn',
            'react-hooks/rules-of-hooks': 'error',
            
            // General JavaScript/TypeScript best practices
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'error',
            'no-alert': 'warn',
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['warn', 'always', { null: 'ignore' }],
            'no-duplicate-imports': 'warn',
            'no-template-curly-in-string': 'warn',
            
            // Code quality
            'no-nested-ternary': 'warn',
            'no-unneeded-ternary': 'warn',
            'no-lonely-if': 'warn',
            'no-else-return': 'warn',
            'prefer-template': 'warn',
            'object-shorthand': 'warn',
            'prefer-arrow-callback': 'warn',
            'prefer-destructuring': ['warn', {
                array: false,
                object: true
            }],
            
            // Async/Promise handling
            'no-return-await': 'warn',
            'require-await': 'off', // Too strict for now
            'no-async-promise-executor': 'error',
            
            // Error prevention
            'no-throw-literal': 'warn',
            'no-useless-catch': 'warn',
            'no-empty-pattern': 'warn',
            
            // ==========================================
            // CODE COMPLEXITY & MAINTAINABILITY
            // ==========================================
            
            // Complexity limits (enterprise-grade maintainability)
            'max-depth': ['warn', 4], // Maximum nesting depth
            'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
            'complexity': ['warn', 15], // Cyclomatic complexity
            
            // Import hygiene
            'no-restricted-imports': ['warn', {
                patterns: [
                    {
                        group: ['../**/node_modules/**'],
                        message: 'Import directly from package, not through node_modules path'
                    }
                ]
            }],
            
            // Array key quality (prevents React re-render issues)
            'no-magic-numbers': ['warn', { 
                ignore: [-1, 0, 1, 2, 100], 
                ignoreArrayIndexes: true,
                enforceConst: true,
                detectObjects: false
            }],
        },
    },
);
