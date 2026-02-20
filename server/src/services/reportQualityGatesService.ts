/**
 * Report Quality Gates Service (T060)
 *
 * Validates report readiness for export/approval:
 *  - Missing required sections
 *  - Empty enabled sections
 *  - Structure completeness
 *  - Content quality signals
 */
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

// ── Types ──────────────────────────────────────────────────────

export type GateSeverity = 'error' | 'warning' | 'info';

export interface QualityGateResult {
  id: string;
  gateType: string;
  severity: GateSeverity;
  message: string;
  sectionKey?: string;
}

export interface QualityReport {
  reportId: string;
  canExport: boolean;
  canApprove: boolean;
  gates: QualityGateResult[];
  score: number;
  checkedAt: string;
}

const REQUIRED_SECTION_TYPES = ['summary', 'cover'];
const RECOMMENDED_SECTION_TYPES = ['recommendations', 'consulting_decisions', 'findings'];

// ── Main Check ─────────────────────────────────────────────────

export async function checkQualityGates(
  organizationId: string,
  reportId: string
): Promise<QualityReport> {
  const gates: QualityGateResult[] = [];

  const sections = ((await dbAll(
    `SELECT key, type, title, enabled, content, order_index
     FROM report_builder_sections
     WHERE report_id = ?
     ORDER BY order_index ASC`,
    [reportId]
  )) || []) as Array<{
    key: string; type: string; title: string; enabled: boolean;
    content: string | null; order_index: number;
  }>;

  const report = (await dbAll(
    `SELECT status, title FROM report_builder_reports WHERE id = ?`,
    [reportId]
  )) as Array<{ status: string; title: string }> | null;

  const status = report?.[0]?.status || 'DRAFT';
  const enabledSections = sections.filter((s) => s.enabled);
  const sectionTypes = new Set(enabledSections.map((s) => s.type));

  // Gate 1: No sections
  if (enabledSections.length === 0) {
    gates.push({
      id: `qg-no-sections`,
      gateType: 'EMPTY_REPORT',
      severity: 'error',
      message: 'Report has no enabled sections. Add at least one section to proceed.',
    });
  }

  // Gate 2: Missing required sections
  for (const reqType of REQUIRED_SECTION_TYPES) {
    if (!sectionTypes.has(reqType)) {
      gates.push({
        id: `qg-missing-${reqType}`,
        gateType: 'MISSING_REQUIRED_SECTION',
        severity: reqType === 'cover' ? 'warning' : 'error',
        message: `Missing required section: ${reqType === 'summary' ? 'Executive Summary' : 'Cover Page'}`,
      });
    }
  }

  // Gate 3: Recommended sections
  for (const recType of RECOMMENDED_SECTION_TYPES) {
    if (!sectionTypes.has(recType) && !sectionTypes.has('consulting_decisions')) {
      gates.push({
        id: `qg-recommend-${recType}`,
        gateType: 'MISSING_RECOMMENDED_SECTION',
        severity: 'info',
        message: `Consider adding: ${formatSectionType(recType)}`,
      });
    }
  }

  // Gate 4: Empty content in enabled sections
  const emptySections = enabledSections.filter((s) => !s.content || s.content.trim().length === 0);
  for (const empty of emptySections) {
    gates.push({
      id: `qg-empty-${empty.key}`,
      gateType: 'EMPTY_CONTENT',
      severity: status === 'APPROVED' ? 'error' : 'warning',
      message: `Section "${empty.title}" has no content. Generate or write content before exporting.`,
      sectionKey: empty.key,
    });
  }

  // Gate 5: Very short content
  const shortThreshold = 50;
  const shortSections = enabledSections.filter(
    (s) => s.content && s.content.trim().length > 0 && s.content.trim().length < shortThreshold && s.type !== 'cover'
  );
  for (const short of shortSections) {
    gates.push({
      id: `qg-short-${short.key}`,
      gateType: 'SHORT_CONTENT',
      severity: 'warning',
      message: `Section "${short.title}" has very short content (${short.content?.trim().length || 0} chars). Consider regenerating with more detail.`,
      sectionKey: short.key,
    });
  }

  // Calculate score (0-100)
  const errors = gates.filter((g) => g.severity === 'error').length;
  const warnings = gates.filter((g) => g.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 10);

  const canExport = errors === 0;
  const canApprove = errors === 0 && warnings <= 1;

  // Persist results
  await dbRun(`DELETE FROM report_quality_gates WHERE report_id = ?`, [reportId]);
  for (const gate of gates) {
    await dbRun(
      `INSERT INTO report_quality_gates
         (id, organization_id, report_id, gate_type, severity, message, section_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gate.id, organizationId, reportId, gate.gateType, gate.severity, gate.message, gate.sectionKey || null]
    );
  }

  return {
    reportId,
    canExport,
    canApprove,
    gates,
    score,
    checkedAt: new Date().toISOString(),
  };
}

function formatSectionType(type: string): string {
  const map: Record<string, string> = {
    recommendations: 'Recommendations',
    consulting_decisions: 'Next Steps & Decisions',
    findings: 'Key Findings',
    summary: 'Executive Summary',
    cover: 'Cover Page',
  };
  return map[type] || type;
}
