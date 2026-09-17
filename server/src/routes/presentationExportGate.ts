/**
 * Presentation export quality-gate helpers (M19).
 *
 * Extracted from presentations.routes.ts so the review-warning contract is
 * unit-testable without loading the full route module (pdfkit / sharp / DB).
 *
 * DEC-543: quality findings are advisory metadata for every caller.
 */

const OVERRIDE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/**
 * Resolve the explicit override metadata used by final-export governance and
 * its audit record. This does not override DEC-543 quality warnings.
 */
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
}) {
  const { checkDeckQualityGates } = await import('../services/presentationQualityGatesService.js');
  const report = await checkDeckQualityGates(params.organizationId, params.deckId);
  const warnings = report.canExport ? [] : report.gates;

  // DEC-543: review findings are advisory; no role or query flag is required
  // to export. The structured payload is used by JSON/preflight
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
  res: {
    setHeader(name: string, value: string): unknown;
    getHeader?(name: string): number | string | string[] | undefined;
  },
  quality: { report: { result?: string } | null; warnings?: unknown[] }
): void {
  const warnings = quality.warnings ?? [];
  const exposed = [
    'X-Presentation-Quality-Result',
    'X-Presentation-Quality-Warning-Count',
    'X-Presentation-Quality-Warnings',
  ];
  const bounded: unknown[] = [];
  for (const warning of warnings.slice(0, 20)) {
    const candidate = [...bounded, warning];
    if (encodeURIComponent(JSON.stringify(candidate)).length > 4096) break;
    bounded.push(warning);
  }
  res.setHeader('X-Presentation-Quality-Result', quality.report?.result || 'NOT_REVIEWED');
  res.setHeader('X-Presentation-Quality-Warning-Count', String(warnings.length));
  res.setHeader('X-Presentation-Quality-Warnings', encodeURIComponent(JSON.stringify(bounded)));
  const existing = String(res.getHeader?.('Access-Control-Expose-Headers') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  res.setHeader(
    'Access-Control-Expose-Headers',
    [...new Set([...existing, ...exposed])].join(', ')
  );
}
