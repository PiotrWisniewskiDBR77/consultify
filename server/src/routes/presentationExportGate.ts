/**
 * Presentation export quality-gate helpers (M19).
 *
 * Extracted from presentations.routes.ts so the review-warning contract is
 * unit-testable without loading the full route module (pdfkit / sharp / DB).
 *
 * L-02 regression-guard: quality-gate override is ADMIN/OWNER/SUPERADMIN only —
 * a non-admin passing ?overrideQualityGate=true must NOT bypass the gate.
 */

const OVERRIDE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

export function canOverrideQualityGate(req: {
  user?: { role?: string };
  userRole?: string;
  query?: Record<string, unknown>;
}): boolean {
  const role = req.user?.role || req.userRole || '';
  const requested = String(req.query?.overrideQualityGate || '') === 'true';
  return OVERRIDE_ROLES.includes(role) && requested;
}

export async function enforceQualityGateForExport(params: {
  organizationId: string;
  deckId: string;
  format: 'pdf' | 'pptx' | 'png' | 'html';
  allowOverride?: boolean;
}) {
  const { checkDeckQualityGates } = await import('../services/presentationQualityGatesService.js');
  const report = await checkDeckQualityGates(params.organizationId, params.deckId);
  const warnings = report.canExport ? [] : report.gates;

  // DEC-543: review findings are advisory. `allowOverride` remains in the
  // signature for backwards-compatible callers, but no role or query flag is
  // required to export. The structured payload is used by JSON/preflight
  // callers; binary routes expose the same warnings in response headers.
  return {
    ok: true as const,
    status: 200 as const,
    report,
    warnings,
    payload: {
      success: true,
      format: params.format,
      result: report.result,
      scorecard: report.scorecard,
      warnings,
    },
  };
}

export function setQualityWarningHeaders(
  res: { setHeader(name: string, value: string): unknown },
  quality: { report: { result?: string } | null; warnings?: unknown[] }
): void {
  const warnings = quality.warnings ?? [];
  res.setHeader('X-Presentation-Quality-Result', quality.report?.result || 'NOT_REVIEWED');
  res.setHeader('X-Presentation-Quality-Warning-Count', String(warnings.length));
  res.setHeader('X-Presentation-Quality-Warnings', encodeURIComponent(JSON.stringify(warnings)));
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-Presentation-Quality-Result, X-Presentation-Quality-Warning-Count, X-Presentation-Quality-Warnings'
  );
}
