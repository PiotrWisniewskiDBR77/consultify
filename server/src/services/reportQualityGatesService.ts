/**
 * Report Quality Gates Service (T060)
 *
 * Validates report readiness for export/approval:
 *  - Gates 1-3: Structure (empty report, required/recommended sections)
 *  - Gates 4-5: Content (empty, short)
 *  - Gate 6: R1-R4 canonical template coverage
 *  - Gate 7: Brand voice compliance
 *  - Gate 8: Traceability coverage
 *  - Gate 9: Numeric consistency (intra- and inter-section)
 *  - Gate 10: Section ordering logic (summary before detail, action after analysis)
 *  - Gate 11: Cross-section claim consistency (entity counts, totals)
 *  - Gate 12: RAG consistency (Green content vs Red status, and vice versa)
 */
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

import { getOrCreateBrandVoice, validateContent } from './brandVoiceProfileService.js';
import { getCanonicalTemplate } from './reportCanonicalTemplatesService.js';

// ── Types ──────────────────────────────────────────────────────

export type GateSeverity = 'error' | 'warning' | 'info';

export type GateCategory = 'structure' | 'content' | 'compliance' | 'traceability' | 'coverage';

export interface QualityGateResult {
  id: string;
  gateType: string;
  severity: GateSeverity;
  message: string;
  sectionKey?: string;
  category: GateCategory;
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

const V3_REPORT_TYPES = ['R1', 'R2', 'R3', 'R4'];

const POSITIVE_SIGNALS = ['on track', 'completed', 'ahead of schedule', 'exceeding', 'strong progress', 'no issues'];
const NEGATIVE_SIGNALS = ['critical', 'blocked', 'failed', 'overdue', 'at risk', 'significantly delayed', 'severe'];

// ── Main Check ─────────────────────────────────────────────────

export async function checkQualityGates(
  organizationId: string,
  reportId: string
): Promise<QualityReport> {
  const gates: QualityGateResult[] = [];

  const sections = ((await dbAll(
    `SELECT section_key, section_type, title, enabled,
            COALESCE(edited_content, generated_content) AS content,
            order_index, rag, source_refs_json
     FROM report_builder_sections
     WHERE report_id = ?
     ORDER BY order_index ASC`,
    [reportId]
  )) || []) as Array<{
    section_key: string;
    section_type: string;
    title: string;
    enabled: boolean;
    content: string | null;
    order_index: number;
    rag: string | null;
    source_refs_json: string | null;
  }>;

  const report = (await dbAll(
    `SELECT status, title, report_type_v3 FROM report_builder_reports WHERE id = ?`,
    [reportId]
  )) as Array<{ status: string; title: string; report_type_v3: string | null }> | null;

  const status = report?.[0]?.status || 'DRAFT';
  const reportTypeV3 = report?.[0]?.report_type_v3?.toUpperCase() || null;
  const enabledSections = sections.filter((s) => s.enabled);
  const sectionTypes = new Set(enabledSections.map((s) => s.section_type));
  const contentSections = enabledSections.filter((s) => s.content && s.content.trim().length > 0);

  // ── Gate 1: No sections ──────────────────────────────────────
  if (enabledSections.length === 0) {
    gates.push({
      id: `qg-no-sections`,
      gateType: 'EMPTY_REPORT',
      severity: 'error',
      message: 'Report has no enabled sections. Add at least one section to proceed.',
      category: 'structure',
    });
  }

  // ── Gate 2: Missing required sections ────────────────────────
  for (const reqType of REQUIRED_SECTION_TYPES) {
    if (!sectionTypes.has(reqType)) {
      gates.push({
        id: `qg-missing-${reqType}`,
        gateType: 'MISSING_REQUIRED_SECTION',
        severity: reqType === 'cover' ? 'warning' : 'error',
        message: `Missing required section: ${reqType === 'summary' ? 'Executive Summary' : 'Cover Page'}`,
        category: 'structure',
      });
    }
  }

  // ── Gate 3: Recommended sections ─────────────────────────────
  for (const recType of RECOMMENDED_SECTION_TYPES) {
    if (!sectionTypes.has(recType) && !sectionTypes.has('consulting_decisions')) {
      gates.push({
        id: `qg-recommend-${recType}`,
        gateType: 'MISSING_RECOMMENDED_SECTION',
        severity: 'info',
        message: `Consider adding: ${formatSectionType(recType)}`,
        category: 'structure',
      });
    }
  }

  // ── Gate 4: Empty content in enabled sections ────────────────
  const emptySections = enabledSections.filter((s) => !s.content || s.content.trim().length === 0);
  for (const empty of emptySections) {
    gates.push({
      id: `qg-empty-${empty.section_key}`,
      gateType: 'EMPTY_CONTENT',
      severity: status === 'APPROVED' ? 'error' : 'warning',
      message: `Section "${empty.title}" has no content. Generate or write content before exporting.`,
      sectionKey: empty.section_key,
      category: 'content',
    });
  }

  // ── Gate 5: Very short content ───────────────────────────────
  const shortThreshold = 50;
  const shortSections = enabledSections.filter(
    (s) =>
      s.content &&
      s.content.trim().length > 0 &&
      s.content.trim().length < shortThreshold &&
      s.section_type !== 'cover'
  );
  for (const short of shortSections) {
    gates.push({
      id: `qg-short-${short.section_key}`,
      gateType: 'SHORT_CONTENT',
      severity: 'warning',
      message: `Section "${short.title}" has very short content (${short.content?.trim().length || 0} chars). Consider regenerating with more detail.`,
      sectionKey: short.section_key,
      category: 'content',
    });
  }

  // ── Gate 6: R1-R4 Canonical Template Coverage ────────────────
  if (reportTypeV3 && V3_REPORT_TYPES.includes(reportTypeV3)) {
    const template = getCanonicalTemplate(reportTypeV3);
    if (template) {
      const sectionKeys = new Set(enabledSections.map((s) => s.section_key));
      for (const canonical of template.sections) {
        if (!canonical.required) continue;
        if (!sectionKeys.has(canonical.key)) {
          gates.push({
            id: `qg-coverage-missing-${canonical.key}`,
            gateType: 'TEMPLATE_SECTION_MISSING',
            severity: 'error',
            message: `${reportTypeV3} template requires "${canonical.title}" section but it is missing.`,
            category: 'coverage',
          });
        } else {
          const match = enabledSections.find((s) => s.section_key === canonical.key);
          if (match && (!match.content || match.content.trim().length === 0)) {
            gates.push({
              id: `qg-coverage-empty-${canonical.key}`,
              gateType: 'TEMPLATE_SECTION_EMPTY',
              severity: 'warning',
              message: `${reportTypeV3} template section "${canonical.title}" exists but has no content.`,
              sectionKey: canonical.key,
              category: 'coverage',
            });
          }
        }
      }
    }
  }

  // ── Gate 7: Brand Voice Compliance ───────────────────────────
  try {
    const profile = await getOrCreateBrandVoice(organizationId);
    for (const section of contentSections) {
      const result = validateContent(section.content!, profile);
      for (const violation of result.violations) {
        gates.push({
          id: `qg-brand-${section.section_key}-${violation.type}`,
          gateType: 'BRAND_VOICE_VIOLATION',
          severity: 'warning',
          message: `"${section.title}": ${violation.message}`,
          sectionKey: section.section_key,
          category: 'compliance',
        });
      }
    }
  } catch (err) {
    logger.warn('[QualityGates] Brand voice check skipped', { error: err });
  }

  // ── Gate 8: Traceability Coverage ────────────────────────────
  if (contentSections.length > 0) {
    let tracedCount = 0;
    for (const section of contentSections) {
      let hasRefs = false;
      if (section.source_refs_json) {
        try {
          const refs = JSON.parse(section.source_refs_json);
          hasRefs = Array.isArray(refs) && refs.length > 0;
        } catch { /* malformed JSON */ }
      }
      if (hasRefs) {
        tracedCount++;
      } else {
        gates.push({
          id: `qg-trace-${section.section_key}`,
          gateType: 'MISSING_SOURCE_REFS',
          severity: 'warning',
          message: `"${section.title}" has content but no source references for traceability.`,
          sectionKey: section.section_key,
          category: 'traceability',
        });
      }
    }
    const coverage = tracedCount / contentSections.length;
    if (coverage < 0.5) {
      gates.push({
        id: `qg-trace-coverage-low`,
        gateType: 'LOW_TRACEABILITY_COVERAGE',
        severity: 'error',
        message: `Only ${Math.round(coverage * 100)}% of content sections have source references (minimum 50% required).`,
        category: 'traceability',
      });
    }
  }

  // ── Gate 9: Numeric Consistency ──────────────────────────────
  checkNumericConsistency(contentSections, gates);

  // ── Gate 10: Section Ordering Logic ─────────────────────────
  checkSectionOrdering(enabledSections, gates);

  // ── Gate 11: Cross-Section Claim Consistency ───────────────
  checkCrossSectionConsistency(contentSections, gates);

  // ── Gate 12: RAG Consistency ─────────────────────────────────
  for (const section of enabledSections) {
    if (!section.rag || !section.content) continue;
    const rag = section.rag.toLowerCase();
    const lowerContent = section.content.toLowerCase();

    if (rag === 'green' && NEGATIVE_SIGNALS.some((s) => lowerContent.includes(s))) {
      gates.push({
        id: `qg-rag-mismatch-${section.section_key}`,
        gateType: 'RAG_CONTENT_MISMATCH',
        severity: 'warning',
        message: `"${section.title}" has RAG=Green but content mentions critical/blocked items.`,
        sectionKey: section.section_key,
        category: 'coverage',
      });
    } else if (rag === 'red' && POSITIVE_SIGNALS.some((s) => lowerContent.includes(s)) && !NEGATIVE_SIGNALS.some((s) => lowerContent.includes(s))) {
      gates.push({
        id: `qg-rag-mismatch-${section.section_key}`,
        gateType: 'RAG_CONTENT_MISMATCH',
        severity: 'warning',
        message: `"${section.title}" has RAG=Red but content appears mostly positive. Verify RAG status.`,
        sectionKey: section.section_key,
        category: 'coverage',
      });
    }
  }

  // ── Score ────────────────────────────────────────────────────
  const errors = gates.filter((g) => g.severity === 'error').length;
  const warnings = gates.filter((g) => g.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 5);

  const canExport = errors === 0;
  const canApprove = errors === 0 && warnings <= 1;

  // Persist results
  await dbRun(`DELETE FROM report_quality_gates WHERE report_id = ?`, [reportId]);
  for (const gate of gates) {
    await dbRun(
      `INSERT INTO report_quality_gates
         (id, organization_id, report_id, gate_type, severity, message, section_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        gate.id,
        organizationId,
        reportId,
        gate.gateType,
        gate.severity,
        gate.message,
        gate.sectionKey || null,
      ]
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

// ── Gate 9 helper ──────────────────────────────────────────────

function checkNumericConsistency(
  contentSections: Array<{ section_key: string; title: string; content: string | null }>,
  gates: QualityGateResult[]
): void {
  const metricValues = new Map<string, { value: string; sectionKey: string; title: string }[]>();

  const patterns = [
    /(\d+(?:\.\d+)?)\s*%/g,
    /\$\s*(\d+(?:[\d,.]*\d)?(?:\s*[BMKT])?)/gi,
    /(\d+(?:,\d{3})*)\s+(initiatives?|projects?|tasks?|risks?|items?|people|FTEs?|days?|weeks?|months?)/gi,
  ];

  for (const section of contentSections) {
    if (!section.content) continue;

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(section.content)) !== null) {
        const fullMatch = match[0].trim();
        const normalized = fullMatch.toLowerCase().replace(/,/g, '');
        const unitMatch = normalized.match(/\d[\d.]*\s*(%.?|initiatives?|projects?|tasks?|risks?|items?|people|ftes?|days?|weeks?|months?|\$)/);
        const unit = unitMatch ? unitMatch[1] : '';
        const key = unit || 'numeric';

        const entries = metricValues.get(key) || [];
        entries.push({ value: fullMatch, sectionKey: section.section_key, title: section.title });
        metricValues.set(key, entries);
      }
    }
  }

  for (const [unit, entries] of metricValues.entries()) {
    if (entries.length < 2) continue;
    const uniqueValues = new Set(entries.map((e) => e.value));
    if (uniqueValues.size > 1 && entries.length <= 6) {
      const valueList = [...uniqueValues].slice(0, 3).join(', ');
      const sectionList = [...new Set(entries.map((e) => `"${e.title}"`))].slice(0, 3).join(', ');
      gates.push({
        id: `qg-numeric-${unit}-inconsistency`,
        gateType: 'NUMERIC_INCONSISTENCY',
        severity: 'warning',
        message: `Potential numeric inconsistency for "${unit}": values ${valueList} appear across ${sectionList}.`,
        category: 'content',
      });
    }
  }
}

// ── Gate 10 helper: Section Ordering ──────────────────────────

const EXPECTED_ORDER: string[] = [
  'cover',
  'executive_summary',
  'summary',
  'methodology',
  'initiatives_overview',
  'tasks_progress',
  'status_distribution',
  'budget',
  'findings',
  'axis_analysis',
  'kpi_trends',
  'planned_vs_realized_benefits',
  'risk',
  'blocked_risks',
  'escalated_risks',
  'recommendations',
  'action_plan',
  'next_week_focus',
  'gate_decisions',
  'corrective_actions',
  'timeline_heatmap',
];

function checkSectionOrdering(
  enabledSections: Array<{ section_key: string; section_type: string; title: string; order_index: number }>,
  gates: QualityGateResult[]
): void {
  const summaryTypes = ['summary', 'executive_summary', 'cover'];
  const detailTypes = ['axis_analysis', 'list', 'matrix', 'recommendations', 'action_plan'];

  const summarySection = enabledSections.find((s) =>
    summaryTypes.includes(s.section_type) || summaryTypes.includes(s.section_key)
  );
  const firstDetailSection = enabledSections.find((s) =>
    detailTypes.includes(s.section_type)
  );

  if (summarySection && firstDetailSection && summarySection.order_index > firstDetailSection.order_index) {
    gates.push({
      id: 'qg-order-summary-after-detail',
      gateType: 'SECTION_ORDER_WARNING',
      severity: 'warning',
      message: `"${summarySection.title}" appears after "${firstDetailSection.title}". Summaries should precede detail sections.`,
      category: 'structure',
    });
  }

  const actionSection = enabledSections.find((s) =>
    s.section_type === 'action_plan' || s.section_key.includes('action') || s.section_key.includes('next')
  );
  const lastAnalysis = [...enabledSections]
    .filter((s) => ['axis_analysis', 'matrix', 'list', 'summary'].includes(s.section_type))
    .pop();

  if (actionSection && lastAnalysis && actionSection.order_index < lastAnalysis.order_index) {
    gates.push({
      id: 'qg-order-action-before-analysis',
      gateType: 'SECTION_ORDER_WARNING',
      severity: 'info',
      message: `Action plan "${actionSection.title}" appears before analysis "${lastAnalysis.title}". Consider reordering.`,
      category: 'structure',
    });
  }
}

// ── Gate 11 helper: Cross-Section Claim Consistency ──────────

function checkCrossSectionConsistency(
  contentSections: Array<{ section_key: string; title: string; content: string | null }>,
  gates: QualityGateResult[]
): void {
  const countPattern = /(\d+)\s+(initiatives?|projects?|tasks?|risks?|issues?)/gi;

  const claimsByEntity = new Map<
    string,
    Array<{ count: number; sectionKey: string; title: string; raw: string }>
  >();

  for (const section of contentSections) {
    if (!section.content) continue;
    let match: RegExpExecArray | null;
    countPattern.lastIndex = 0;
    while ((match = countPattern.exec(section.content)) !== null) {
      const count = parseInt(match[1], 10);
      const entityType = match[2].toLowerCase().replace(/s$/, '');
      if (isNaN(count)) continue;

      const entries = claimsByEntity.get(entityType) || [];
      entries.push({
        count,
        sectionKey: section.section_key,
        title: section.title,
        raw: match[0],
      });
      claimsByEntity.set(entityType, entries);
    }
  }

  for (const [entity, claims] of claimsByEntity) {
    if (claims.length < 2) continue;

    const uniqueCounts = [...new Set(claims.map((c) => c.count))];
    if (uniqueCounts.length > 1) {
      const maxDiff = Math.max(...uniqueCounts) - Math.min(...uniqueCounts);
      const maxVal = Math.max(...uniqueCounts);
      if (maxDiff > 0 && maxDiff / maxVal > 0.15) {
        const sections = [...new Set(claims.map((c) => `"${c.title}"`))].slice(0, 3).join(', ');
        const counts = uniqueCounts.slice(0, 3).join(', ');
        gates.push({
          id: `qg-cross-consistency-${entity}`,
          gateType: 'CROSS_SECTION_INCONSISTENCY',
          severity: 'warning',
          message: `Different ${entity} counts (${counts}) appear across sections: ${sections}. Verify data consistency.`,
          category: 'content',
        });
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────

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
