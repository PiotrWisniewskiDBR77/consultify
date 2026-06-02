import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

// Frontend ingestion bans (Organization Context Engine SoT §11). Shared between the
// general src block and the Admin-fork-ban block so non-Admin files keep both guards.
const FRONTEND_INGESTION_RESTRICTED_PATHS = [
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
];

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

      // ==========================================
      // X1 DESIGN SYSTEM GUARDRAILS
      // See: docs/plans/cross-cutting/PLAN_X1_design_system.md §6
      // warn level during transition (1458 existing hex literals would hard-break
      // CI at error); CI runs `eslint --max-warnings 0` so new violations fail.
      // Overridden off inside src/components/ui/ (see ui override block below).
      // ==========================================
      'no-restricted-syntax': [
        'warn',
        {
          // Ban inline style={{}} outside src/components/ui/
          selector: 'JSXAttribute[name.name="style"][value.type="JSXExpressionContainer"]',
          message:
            'Inline style={{}} is banned outside src/components/ui/. Use Tailwind design tokens (crimson-*, navy-*, token-*).',
        },
        {
          // Ban raw hex color literals (className strings, props, style values)
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Hardcoded hex color detected. Use a Tailwind token (crimson-*, navy-*, danger-*, etc.) instead.',
        },
        {
          // Ban arbitrary Tailwind color brackets, e.g. bg-[#A51C30]
          selector: 'Literal[value=/\\[#[0-9a-fA-F]/]',
          message:
            'Arbitrary Tailwind color bg-[#…] is banned. Use a token class (bg-crimson-600, etc.).',
        },
      ],
    },
  },
  {
    // X1: design-system guardrails do not apply inside the primitives layer —
    // ui/ owns the raw style/hex/token definitions.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
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
      'no-restricted-imports': ['warn', { paths: FRONTEND_INGESTION_RESTRICTED_PATHS }],
    },
  },
  {
    // X1: ban importing the retired Admin/shared primitive forks from NEW code.
    // The forks are now thin adapters over ui/primitives. The Admin module and the
    // existing SuperAdmin views legitimately keep using them because they rely on
    // IconButton / Section / CardWithHeader / StatsCard, which have no primitive
    // equivalent yet (Week-2 migration). Everything else must use ui/primitives.
    // Re-declares the ingestion paths so non-Admin src files keep both guards.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/components/Document/**',
      'src/services/api.ts',
      'src/components/Admin/**',
      'src/views/superadmin/**',
    ],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: FRONTEND_INGESTION_RESTRICTED_PATHS,
          patterns: [
            {
              group: ['**/Admin/shared/Button', '**/Admin/shared/Card'],
              message:
                'Import Button/Card from @/components/ui/primitives instead of the retired Admin/shared forks.',
            },
          ],
        },
      ],
    },
  }
);
