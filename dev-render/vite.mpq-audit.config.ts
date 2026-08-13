import base from './vite.config';

/**
 * TEMPORARY audit-only override of dev-render/vite.config.ts, created by an
 * independent MPQ auditor session (2026-08-13). Restricts optimizeDeps
 * entries to the isolated harness HTML files this audit actually uses, so
 * Vite's cold-start dependency scanner never crawls dev-render/main.tsx
 * (whose shared screen registry statically imports a nonexistent
 * ./screens/tools-sesja-wyjscie and would otherwise drag in hundreds of
 * unrelated files). Different port (42710) to avoid colliding with any
 * other session's dev-render server already running against the shared
 * vite.config.ts on 3020.
 *
 * DELETE THIS FILE after the audit.
 */
export default {
  ...base,
  optimizeDeps: {
    ...(base as any).optimizeDeps,
    entries: [
      'method-workspace.html',
      'drd-workspace.html',
      'mpq-report-presentation.html',
      'mpq-audit-hub.html',
    ],
  },
  server: {
    ...(base as any).server,
    port: 42710,
  },
};
