/**
 * Presentation export quality-gate helpers (M19).
 *
 * Extracted from presentations.routes.ts so the security-relevant role-gate and
 * the 422 enforcement contract are unit-testable without loading the full route
 * module (pdfkit / sharp / DB). Behaviour is identical to the prior inline code.
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
  if (!report.canExport && !params.allowOverride) {
    return {
      ok: false as const,
      status: 422,
      report,
      payload: {
        success: false,
        error: 'Deck is blocked by quality gates.',
        code: 'QUALITY_GATE_BLOCKED',
        result: report.result,
        scorecard: report.scorecard,
        gates: report.gates,
        format: params.format,
      },
    };
  }
  return { ok: true as const, report };
}
