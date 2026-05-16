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
      '.codex-worktrees/**',
      '**/.codex-worktrees/**',
      '.claude/**',
      '**/.claude/**',
      'apps/new-app/**',
      'knowledge/vector-website/**',
      'knowledge/vector-website/src 2/**',
      '**/src 2/**',
      'dist',
      '**/dist/**',
      '**/build/**',
      '_backup/**',
      '_quarantine/**',
      'Piotr_Tools/**',
      'cursor_zadania/**',
      'coverage',
      'coverage-mywork',
      'node_modules',
      'node_modules_trash',
      'node_modules 2',
      '**/trash_node_modules*/**',
      'playwright-report',
      // Generated test artifacts / coverage output
      'test-results/**',
      '**/test-results/**',
      '*.config.js',
      'server/**/*.js',
      'server/**/*.d.ts',
      // Operational scripts (legacy formatting) - don't block CI/dev
      'server/scripts/**',
      'scripts/**',
      'backup-pre-migration/**',
      'backup/**',
      'Softs/**',
      'scripts/migration-drafts/**',
      'quarantine/**',
      'server/src/_backup/**',
      '**/*.d.ts',
      // Ignore \"copy\" files created by tooling (e.g. \"file 5.ts\")
      '**/* *.ts',
      '**/* *.tsx',
      '**/* *.js',
      '**/* 2.tsx',
      '**/* 2.ts',
      '**/*2.tsx',
      '**/*2.ts',
      'tests/**',
    ],
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
      reportUnusedDisableDirectives: 'off', // Keep off for now to avoid noise during transition
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort,
      prettier: prettierPlugin,
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
      'no-console': 'warn',
      'no-async-promise-executor': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // ==========================================
      // TYPESCRIPT - STRICTER RULES
      // ==========================================
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',

      // ==========================================
      // REACT
      // ==========================================
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ==========================================
      // CODE QUALITY - RE-ENABLED
      // ==========================================
      'no-empty': 'warn',
      'no-useless-catch': 'warn',
      'no-case-declarations': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  {
    // Stage 8 (Source Of Truth: ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md §11):
    // Frontend AI surfaces MUST go through the shared organization context engine, not
    // ad-hoc browser-only ingestion (FileReader, direct DOMParser of uploaded files,
    // raw pdfjs/mammoth/xlsx imports). The shared backend engine enforces tenant ACL,
    // honest degraded UI, lineage, quotas and retention. Bypassing it is a P0 hazard.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/Document/**', 'src/services/api.ts'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: 'pdfjs-dist',
              message:
                'Frontend ingestion of PDFs is forbidden. Upload files via the documents API and let the backend Organization Context Engine extract page locators (tenant-safe, lineage-aware).',
            },
            {
              name: 'mammoth',
              message:
                'Frontend ingestion of DOCX is forbidden. Upload via documents API; the backend Organization Context Engine extracts paragraph/table locators with ACL.',
            },
            {
              name: 'xlsx',
              message:
                'Frontend ingestion of XLSX is forbidden. Upload via documents API; the backend extracts sheet locators with quotas and lineage.',
            },
            {
              name: 'tesseract.js',
              message:
                'Frontend OCR is forbidden. Upload images via documents API; the backend Organization Context Engine handles OCR with confidence scores, prompt-injection treatment and cost metering.',
            },
            {
              name: 'jszip',
              message:
                'Frontend zip parsing of context files (PPTX/DOCX) is forbidden. Use the documents API and the shared engine.',
            },
            {
              name: 'pdf-parse',
              message:
                'Frontend PDF parsing is forbidden. Use the documents API and the shared backend engine.',
            },
          ],
        },
      ],
    },
  }
);
