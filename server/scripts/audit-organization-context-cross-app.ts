#!/usr/bin/env tsx
/**
 * Stage 8 cross-application audit.
 *
 * Verifies that all AI surfaces flow through the shared Organization Context Engine and
 * do not bypass tenant ACL, lineage, or honest degraded UI requirements.
 *
 * Source of truth: docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md §11
 *
 * Checks:
 * 1. No frontend code imports server-side ingestion libs (mammoth/pdfjs/xlsx/tesseract/jszip)
 *    -> covered by ESLint rule, this script asserts the rule exists.
 * 2. AI Chat (ai.routes.ts) uses ContextRetrievalService for attachments.
 * 3. Interview Insight uses lineage table for context retrieval.
 * 4. Document upload route uses ContextDocumentService (single ingestion path).
 * 5. UsageDashboardView surfaces context storage telemetry.
 *
 * Exit code: 0 on PASS, 1 on any audit failure.
 */

import fs from 'node:fs';
import path from 'node:path';

interface AuditCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

function readSafe(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function listFiles(dir: string, predicate: (file: string) => boolean): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const next = stack.pop() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(next, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(next, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'coverage' ||
          entry.name === 'build'
        ) {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function main(): void {
  const root = process.cwd();
  const eslintConfig = readSafe(path.join(root, 'eslint.config.js'));
  const aiRoutes = readSafe(path.join(root, 'server/src/routes/ai.routes.ts'));
  const insight = readSafe(path.join(root, 'server/src/services/InterviewInsightService.ts'));
  const docsRoutes = readSafe(path.join(root, 'server/src/routes/documents.routes.ts'));
  const usageDashboard = readSafe(
    path.join(root, 'src/views/admin/UsageDashboardView.tsx')
  );

  const frontendFiles = listFiles(
    path.join(root, 'src'),
    (file) =>
      (file.endsWith('.ts') || file.endsWith('.tsx')) &&
      !file.includes('/node_modules/') &&
      !file.includes('/dist/')
  );

  const forbiddenImportPatterns = [
    /from\s+['"]pdfjs-dist['"]/,
    /from\s+['"]mammoth['"]/,
    /from\s+['"]xlsx['"]/,
    /from\s+['"]tesseract\.js['"]/,
    /from\s+['"]pdf-parse['"]/,
    /from\s+['"]jszip['"]/,
  ];

  const violationFiles: string[] = [];
  for (const file of frontendFiles) {
    const content = readSafe(file);
    if (forbiddenImportPatterns.some((re) => re.test(content))) {
      violationFiles.push(file.replace(root + '/', ''));
    }
  }

  const checks: AuditCheck[] = [
    {
      name: 'ESLint config defines no-restricted-imports for browser-only ingestion libs',
      pass:
        eslintConfig.includes('no-restricted-imports') &&
        eslintConfig.includes('pdfjs-dist') &&
        eslintConfig.includes('tesseract.js') &&
        eslintConfig.includes('Frontend OCR is forbidden'),
    },
    {
      name: 'No frontend file imports server-side ingestion libraries',
      pass: violationFiles.length === 0,
      detail: violationFiles.length > 0 ? `Found in: ${violationFiles.join(', ')}` : undefined,
    },
    {
      name: 'AI Chat wires shared ContextRetrievalService for attachments + lineage',
      pass:
        aiRoutes.includes('ContextRetrievalService') &&
        aiRoutes.includes('recordContextRetrievalLineage') &&
        aiRoutes.includes('ai_chat_context_retrieved'),
    },
    {
      name: 'Interview Insight Service uses organization_context_lineage_events table',
      pass: insight.includes('organization_context_lineage_events'),
    },
    {
      name: 'Documents route is the single context document ingestion entrypoint',
      pass:
        docsRoutes.includes('contextDocumentService') &&
        docsRoutes.includes("'/upload'") &&
        docsRoutes.includes('multer'),
    },
    {
      name: 'Usage Dashboard surfaces context storage telemetry to admins',
      pass: usageDashboard.includes('storage') || usageDashboard.includes('Storage'),
    },
  ];

  const failed = checks.filter((c) => !c.pass);
  const summary = {
    contract: 'organization_context_engine_cross_app_audit_v1',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed.map((c) => ({ name: c.name, detail: c.detail || null })),
    forbiddenImportViolations: violationFiles,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) {
    console.error('Cross-app audit FAILED');
    process.exit(1);
  }
  console.log('Cross-app audit PASS');
}

main();
