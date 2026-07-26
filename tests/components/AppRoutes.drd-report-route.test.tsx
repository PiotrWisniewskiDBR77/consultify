/**
 * AppRoutes — DRD Audit Report route (audyt 2026-07-26).
 *
 * `DRDAuditReportView` (full editor: AI chat, per-section AI actions, PDF
 * export, publishing-grade "Raport DRD" client report) is wired to a live
 * backend (server/src/services/report/drdReportGenerator.ts +
 * drdReportService.ts, GET /api/assessment-reports/:reportId/*) but had ZERO
 * importers anywhere in the app. This registers a flag-gated route under the
 * Audits module.
 *
 * Source-level assertions (matching the existing
 * `AppRoutes.ai-chat-routing.test.tsx` convention) — a full render of
 * AppRoutes pulls in the entire provider tree, so the wiring contract is
 * verified directly against the route source instead.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('AppRoutes — DRD Audit Report route', () => {
  const appRoutes = readSource('src/routes/AppRoutes.tsx');

  it('registers /audit-programs/drd-report/:reportId', () => {
    expect(appRoutes).toContain('path="/audit-programs/drd-report/:reportId"');
  });

  it('lazy-mounts the real DRDAuditReportView (not a stub)', () => {
    expect(appRoutes).toContain("import('@/views/DRDAuditReportView')");
    expect(appRoutes).toContain('m.DRDAuditReportView');
  });

  it('is gated behind BetaGate moduleId="MODULE_AUDITS" like /audit-programs', () => {
    const routeBlock = appRoutes.slice(
      appRoutes.indexOf('path="/audit-programs/drd-report/:reportId"')
    );
    expect(routeBlock.slice(0, 400)).toContain('MODULE_AUDITS');
  });

  it('gates the mount on isDrdReportEnabled (default OFF) via DRDAuditReportRoute', () => {
    expect(appRoutes).toContain("import { isDrdReportEnabled } from '@/utils/drdReportFlag'");
    const routeComponentBlock = appRoutes.slice(
      appRoutes.indexOf('const DRDAuditReportRoute'),
      appRoutes.indexOf('const DRDAuditReportRoute') + 800
    );
    expect(routeComponentBlock).toContain('isDrdReportEnabled()');
    // OFF must redirect away, never render the view directly.
    expect(routeComponentBlock).toContain("<Navigate to=\"/audit-programs\" replace />");
  });

  it('reads :reportId from the URL and passes it to the view', () => {
    const routeComponentBlock = appRoutes.slice(
      appRoutes.indexOf('const DRDAuditReportRoute'),
      appRoutes.indexOf('const DRDAuditReportRoute') + 800
    );
    expect(routeComponentBlock).toContain('useParams<{ reportId: string }>()');
    expect(routeComponentBlock).toContain('reportId={params.reportId}');
  });
});
