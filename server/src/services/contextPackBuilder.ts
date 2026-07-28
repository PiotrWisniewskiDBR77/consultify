/**
 * ContextPack Builder — constructs a standardized structured input for AI generation.
 * Replaces raw text dumps with organized data packages containing:
 * headings, key_points, data_points, charts_available, images_available, metadata.
 */

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import organizationContextService from './organizationContext/OrganizationContextService.js';

export interface SourceRef {
  artifact_id: string;
  artifact_type: string;
  artifact_name: string;
}

export interface DataPoint {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  period?: string;
  source_artifact_id: string;
}

export interface AvailableChart {
  chart_type: string;
  title: string;
  data_summary: string;
  source_artifact_id: string;
}

export interface ContextPack {
  pack_id: string;
  created_at: string;
  organization_id: string;
  language: 'en' | 'pl';
  sources: SourceRef[];
  headings: string[];
  key_points: string[];
  data_points: DataPoint[];
  charts_available: AvailableChart[];
  images_available: { url: string; description: string; source_artifact_id: string }[];
  raw_text_excerpt?: string;
  metadata: {
    total_source_artifacts: number;
    confidence_score: number;
    extraction_warnings: string[];
    source_coverage_map?: Record<string, { extracted: boolean; warnings: string[] }>;
    data_gap_register?: Array<{ artifact_id: string; artifact_type: string; issue: string }>;
    /**
     * Layout/template inventory available to the organization. This is SYSTEM context
     * used ONLY for choosing a layout/template — it is NEVER slide/document content.
     * Kept OUT of `key_points` (which generators treat as company findings) so template
     * names can never leak into deck/doc/sheet content. See BUG C fix.
     */
    template_inventory?: { active: string[]; deprecated: string[] };
  };
}

/**
 * Build a ContextPack from source references.
 * Fetches relevant data from the database for each artifact type.
 */
export async function buildContextPack(
  organizationId: string,
  sourceRefs: SourceRef[],
  language: 'en' | 'pl' = 'en'
): Promise<ContextPack> {
  const pack: ContextPack = {
    pack_id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    organization_id: organizationId,
    language,
    sources: sourceRefs,
    headings: [],
    key_points: [],
    data_points: [],
    charts_available: [],
    images_available: [],
    metadata: {
      total_source_artifacts: sourceRefs.length,
      confidence_score: 1.0,
      extraction_warnings: [],
      source_coverage_map: {},
      data_gap_register: [],
      template_inventory: { active: [], deprecated: [] },
    },
  };

  try {
    await injectOrganizationContext(pack, organizationId);
  } catch (error) {
    logger.warn('[ContextPack] Failed to inject org context', { error });
    pack.metadata.extraction_warnings.push('Organization context unavailable');
  }

  try {
    await injectTemplateInventory(pack, organizationId);
  } catch {
    // Non-fatal: template inventory is supplementary context
  }

  for (const ref of sourceRefs) {
    if (pack.metadata.source_coverage_map) {
      pack.metadata.source_coverage_map[`${ref.artifact_type}:${ref.artifact_id}`] = {
        extracted: false,
        warnings: [],
      };
    }
    try {
      await extractFromSource(pack, ref, organizationId);
      const key = `${ref.artifact_type}:${ref.artifact_id}`;
      if (pack.metadata.source_coverage_map?.[key]) {
        pack.metadata.source_coverage_map[key].extracted = true;
      }
    } catch (error) {
      logger.warn(`[ContextPack] Failed to extract from ${ref.artifact_type}:${ref.artifact_id}`, {
        error,
      });
      const warning = `Failed to extract data from ${ref.artifact_name} (${ref.artifact_type})`;
      pack.metadata.extraction_warnings.push(warning);
      const key = `${ref.artifact_type}:${ref.artifact_id}`;
      if (pack.metadata.source_coverage_map?.[key]) {
        pack.metadata.source_coverage_map[key].warnings.push(warning);
      }
      pack.metadata.data_gap_register?.push({
        artifact_id: ref.artifact_id,
        artifact_type: ref.artifact_type,
        issue: warning,
      });
      pack.metadata.confidence_score -= 0.1;
    }
  }

  pack.metadata.confidence_score = Math.max(0, pack.metadata.confidence_score);

  return pack;
}

async function injectOrganizationContext(pack: ContextPack, organizationId: string): Promise<void> {
  const resolved = await organizationContextService.buildResolvedContext(organizationId);
  if (!resolved) return;

  const p = resolved.profile;
  const s = resolved.strategic;
  const sys = resolved.systems;
  const ops = resolved.operations;

  if (p?.companyName) pack.headings.unshift(`Organization: ${p.companyName}`);
  if (p?.industry)
    pack.key_points.push(
      `Industry: ${p.industry}${p.industrySubsector ? ` / ${p.industrySubsector}` : ''}`
    );
  if (p?.organizationType) pack.key_points.push(`Organization type: ${p.organizationType}`);
  if (p?.companySize)
    pack.key_points.push(
      `Scale: ${p.companySize}${p.employeeCount ? ` (${p.employeeCount} employees)` : ''}`
    );
  if (s?.mission) pack.key_points.push(`Mission: ${s.mission}`);
  if (s?.priorities && s.priorities.length > 0)
    pack.key_points.push(`Strategic priorities: ${s.priorities.join(', ')}`);
  if (s?.competitivePosition)
    pack.key_points.push(`Competitive position: ${s.competitivePosition}`);
  if (sys?.stack && sys.stack.length > 0)
    pack.key_points.push(`Technology stack: ${sys.stack.join(', ')}`);
  if (sys?.coreSystems && sys.coreSystems.length > 0)
    pack.key_points.push(`Core systems: ${sys.coreSystems.join(', ')}`);
  if (ops?.deliveryModel) pack.key_points.push(`Delivery model: ${ops.deliveryModel}`);
  if (p?.revenueModel) pack.key_points.push(`Revenue model: ${p.revenueModel}`);
  if (ops?.productionArchetype) pack.key_points.push(`Production: ${ops.productionArchetype}`);
  if (ops?.constraints && ops.constraints.length > 0)
    pack.key_points.push(`Constraints: ${ops.constraints.slice(0, 3).join(', ')}`);
}

async function injectTemplateInventory(pack: ContextPack, organizationId: string): Promise<void> {
  const rows = await dbAll<{ output_type: string; origin_summary_json: string | null }>(
    `SELECT output_type, origin_summary_json FROM v8_output_artifacts
     WHERE organization_id = ? AND artifact_family = 'template'
     ORDER BY last_transition_at DESC LIMIT 20`,
    [organizationId],
    { fallback: true }
  );
  if (!rows || rows.length === 0) return;

  const active: string[] = [];
  const deprecated: string[] = [];
  for (const r of rows) {
    let summary: any = null;
    try {
      summary = r.origin_summary_json ? JSON.parse(r.origin_summary_json) : null;
    } catch {
      /* */
    }
    const tpl = summary?.template;
    const title = tpl?.metadata?.resolvedTitle || tpl?.description || r.output_type;
    const status = String(tpl?.status || '').toLowerCase();
    if (status === 'deprecated') {
      deprecated.push(String(title));
    } else {
      active.push(String(title));
    }
  }

  // BUG C fix: template inventory is LAYOUT/SYSTEM context, not content. It must NEVER
  // land in `key_points` (which presentationGeneratorService/transformationReadDeckPackService
  // copy into `_keyFindings` = slide content). Store it in a dedicated metadata field so
  // the layout picker can read it while generators can never surface template names as content.
  if (pack.metadata.template_inventory) {
    pack.metadata.template_inventory.active = active;
    pack.metadata.template_inventory.deprecated = deprecated;
  }
}

async function extractFromSource(
  pack: ContextPack,
  ref: SourceRef,
  organizationId: string
): Promise<void> {
  switch (ref.artifact_type) {
    case 'initiative':
    case 'initiative_portfolio':
      await extractInitiativeData(pack, ref, organizationId);
      break;
    case 'task':
    case 'execution_tasks':
      await extractTaskData(pack, ref, organizationId);
      break;
    case 'decision':
      await extractDecisionData(pack, ref, organizationId);
      break;
    case 'benefit':
    case 'benefits_tracking':
      await extractBenefitsData(pack, ref, organizationId);
      break;
    case 'kpi_roi':
    case 'financial_analysis':
      await extractFinancialData(pack, ref, organizationId);
      break;
    case 'economic_analysis':
    case 'budget':
      await extractEconomicAnalysisData(pack, ref, organizationId);
      break;
    case 'execution_status':
      await extractExecutionData(pack, ref, organizationId);
      break;
    case 'raid':
    case 'risk':
      await extractRiskData(pack, ref, organizationId);
      break;
    case 'tool_session':
      await extractToolSessionData(pack, ref, organizationId);
      break;
    case 'valuation':
      await extractValuationData(pack, ref, organizationId);
      break;
    case 'report':
    case 'presentation':
    case 'sheet':
    case 'artifact':
      await extractArtifactGovernanceData(pack, ref, organizationId);
      break;
    default:
      pack.metadata.extraction_warnings.push(`Unknown artifact type: ${ref.artifact_type}`);
  }
}

async function extractInitiativeData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  // Schema-drift fix (2026-07-28, part of OGNIWO 8): the previous query selected
  // `owner`, `started_at`, `target_date` — none of which exist on `initiatives`
  // (real columns: owner_business_id/owner_execution_id, start_date/
  // planned_start_date, planned_end_date/forecast_end_date/end_date). On Postgres
  // this threw "column does not exist", was swallowed by the caller's per-source
  // try/catch, and silently produced ZERO data_points — the exact "cichy fallback"
  // this program forbids. Join to `users` for a readable owner name and coalesce
  // the due-date candidates instead of a column that never existed.
  const initiatives = await dbAll(
    `SELECT i.id, i.name AS title, i.description, i.status, i.priority,
            (u.first_name || ' ' || u.last_name) AS owner,
            i.start_date,
            COALESCE(i.planned_end_date::text, i.forecast_end_date, i.end_date::text) AS target_date,
            COALESCE(i.progress, 0) AS progress
     FROM initiatives i
     LEFT JOIN users u ON u.id = i.owner_business_id
     WHERE i.organization_id = ? AND (i.id = ? OR ? IS NULL)
     ORDER BY i.priority DESC LIMIT 20`,
    [orgId, ref.artifact_id || null, ref.artifact_id || null]
  );

  for (const init of initiatives) {
    pack.headings.push(init.title);
    if (init.description) {
      pack.key_points.push(`${init.title}: ${init.description}`);
    }
    pack.key_points.push(
      `Initiative "${init.title}" — status: ${init.status || 'Unknown'}, progress: ${init.progress}%, owner: ${init.owner || 'Unassigned'}`
    );
    pack.data_points.push({
      label: init.title,
      value: init.status || 'Unknown',
      source_artifact_id: ref.artifact_id,
    });
    if (init.progress != null) {
      pack.data_points.push({
        label: `${init.title} Progress`,
        value: init.progress,
        unit: '%',
        source_artifact_id: ref.artifact_id,
      });
    }
    if (init.target_date) {
      pack.data_points.push({
        label: `${init.title} Due`,
        value: init.target_date,
        source_artifact_id: ref.artifact_id,
      });
    }
  }

  pack.charts_available.push({
    chart_type: 'bar',
    title: 'Initiative Status Distribution',
    data_summary: `${initiatives.length} initiatives across multiple statuses`,
    source_artifact_id: ref.artifact_id,
  });
}

async function extractFinancialData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const kpis = await dbAll(
    `SELECT name, current_value, target_value, unit, trend_direction, period
     FROM kpis WHERE organization_id = ?
     ORDER BY updated_at DESC LIMIT 15`,
    [orgId]
  );

  for (const kpi of kpis) {
    pack.data_points.push({
      label: kpi.name,
      value: kpi.current_value,
      unit: kpi.unit,
      trend: kpi.trend_direction,
      period: kpi.period,
      source_artifact_id: ref.artifact_id,
    });
  }

  if (kpis.length > 0) {
    pack.key_points.push(
      `${kpis.length} KPIs tracked; ${kpis.filter((k: any) => k.trend_direction === 'up').length} trending up.`
    );
    pack.charts_available.push({
      chart_type: 'line',
      title: 'KPI Trends',
      data_summary: `${kpis.length} metrics with trend data`,
      source_artifact_id: ref.artifact_id,
    });
  }
}

async function extractExecutionData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const tasks = await dbAll(
    `SELECT title, status, priority, assignee, due_date
     FROM tasks WHERE organization_id = ?
     ORDER BY due_date ASC LIMIT 30`,
    [orgId]
  );

  const total = tasks.length;
  const completed = tasks.filter(
    (t: any) => t.status === 'done' || t.status === 'completed'
  ).length;
  const overdue = tasks.filter(
    (t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  ).length;

  pack.key_points.push(`Execution: ${completed}/${total} tasks completed. ${overdue} overdue.`);
  pack.data_points.push(
    { label: 'Total Tasks', value: total, source_artifact_id: ref.artifact_id },
    { label: 'Completed', value: completed, source_artifact_id: ref.artifact_id },
    { label: 'Overdue', value: overdue, source_artifact_id: ref.artifact_id }
  );

  pack.charts_available.push({
    chart_type: 'pie',
    title: 'Task Status Distribution',
    data_summary: `${total} tasks: ${completed} completed, ${overdue} overdue`,
    source_artifact_id: ref.artifact_id,
  });
}

async function extractRiskData(pack: ContextPack, ref: SourceRef, orgId: string): Promise<void> {
  const risks = await dbAll(
    `SELECT title, severity, probability, status, mitigation_plan, owner
     FROM risks WHERE organization_id = ?
     ORDER BY severity DESC, probability DESC LIMIT 15`,
    [orgId]
  );

  const critical = risks.filter(
    (r: any) => r.severity === 'critical' || r.severity === 'high'
  ).length;

  pack.key_points.push(`${risks.length} risks tracked, ${critical} critical/high severity.`);
  for (const risk of risks) {
    pack.data_points.push({
      label: risk.title,
      value: `${risk.severity}/${risk.probability}`,
      source_artifact_id: ref.artifact_id,
    });
    if (risk.mitigation_plan) {
      pack.key_points.push(`Risk "${risk.title}": ${risk.mitigation_plan}`);
    }
  }

  pack.charts_available.push({
    chart_type: 'scatter',
    title: 'Risk Heat Map',
    data_summary: `${risks.length} risks plotted by severity × probability`,
    source_artifact_id: ref.artifact_id,
  });
}

async function extractToolSessionData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  if (!ref.artifact_id) return;

  const session = await dbGet(
    `SELECT tool_type, input_data, output_data, created_at
     FROM tool_sessions WHERE id = ? AND organization_id = ?`,
    [ref.artifact_id, orgId]
  );

  if (session) {
    const output =
      typeof session.output_data === 'string'
        ? JSON.parse(session.output_data)
        : session.output_data;

    if (output?.summary) pack.key_points.push(output.summary);
    if (output?.key_findings) {
      for (const finding of output.key_findings) {
        pack.key_points.push(finding);
      }
    }
    if (output?.data_points) {
      for (const dp of output.data_points) {
        pack.data_points.push({ ...dp, source_artifact_id: ref.artifact_id });
      }
    }
  }
}

async function extractValuationData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  if (!ref.artifact_id) return;
  const rows = await dbAll(
    `SELECT title, status, currency, source_type, method, horizon_years, results, advisory, negotiation_pack
     FROM valuations WHERE organization_id = ? AND id = ? LIMIT 1`,
    [orgId, ref.artifact_id]
  );
  for (const v of rows) {
    pack.headings.push(v.title || 'Enterprise Valuation');
    const results = typeof v.results === 'string' ? JSON.parse(v.results || '{}') : v.results || {};
    const dcf = results?.dcf;
    if (dcf) {
      if (dcf.enterpriseValue != null)
        pack.data_points.push({
          label: 'Enterprise Value',
          value: dcf.enterpriseValue,
          unit: v.currency || 'PLN',
          source_artifact_id: ref.artifact_id,
        });
      if (dcf.equityValue != null)
        pack.data_points.push({
          label: 'Equity Value',
          value: dcf.equityValue,
          unit: v.currency || 'PLN',
          source_artifact_id: ref.artifact_id,
        });
      if (dcf.impliedMultiple != null)
        pack.data_points.push({
          label: 'EV/EBITDA',
          value: dcf.impliedMultiple,
          unit: 'x',
          source_artifact_id: ref.artifact_id,
        });
      if (dcf.wacc != null)
        pack.data_points.push({
          label: 'WACC',
          value: dcf.wacc,
          unit: '%',
          source_artifact_id: ref.artifact_id,
        });
    }
    if (results?.sensitivity) {
      pack.key_points.push(
        `Sensitivity analysis: ${JSON.stringify(results.sensitivity.rowHeaders || [])} WACC vs growth rates`
      );
    }
    const advisory =
      typeof v.advisory === 'string' ? JSON.parse(v.advisory || '{}') : v.advisory || {};
    const recs = Array.isArray(advisory?.recommendations) ? advisory.recommendations : [];
    for (const rec of recs.slice(0, 5)) {
      pack.key_points.push(
        `Advisory: ${rec.title || rec.description || ''} (${rec.priority || 'medium'})`
      );
    }
    pack.metadata.confidence_score += 3;
  }
}

async function extractTaskData(pack: ContextPack, ref: SourceRef, orgId: string): Promise<void> {
  const tasks = await dbAll(
    `SELECT title, status, priority, assignee, due_date
     FROM tasks WHERE organization_id = ? AND (id = ? OR ? IS NULL)
     ORDER BY due_date ASC LIMIT 30`,
    [orgId, ref.artifact_id || null, ref.artifact_id || null]
  );

  const total = tasks.length;
  const completed = tasks.filter(
    (t: any) => t.status === 'done' || t.status === 'completed'
  ).length;
  const overdue = tasks.filter(
    (t: any) =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== 'done' &&
      t.status !== 'completed'
  ).length;
  const highPriority = tasks.filter(
    (t: any) => t.priority === 'high' || t.priority === 'critical'
  ).length;

  pack.key_points.push(
    `Tasks: ${completed}/${total} completed, ${overdue} overdue, ${highPriority} high-priority.`
  );

  for (const task of tasks) {
    pack.data_points.push({
      label: task.title,
      value: task.status || 'Unknown',
      source_artifact_id: ref.artifact_id,
    });
  }

  pack.data_points.push(
    { label: 'Total Tasks', value: total, source_artifact_id: ref.artifact_id },
    { label: 'Completed Tasks', value: completed, source_artifact_id: ref.artifact_id },
    { label: 'Overdue Tasks', value: overdue, source_artifact_id: ref.artifact_id }
  );

  pack.charts_available.push({
    chart_type: 'pie',
    title: 'Task Status Breakdown',
    data_summary: `${total} tasks: ${completed} completed, ${overdue} overdue`,
    source_artifact_id: ref.artifact_id,
  });
}

async function extractDecisionData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const decisions = await dbAll(
    `SELECT title, status, description, impact, decision_date, owner
     FROM decisions WHERE organization_id = ? AND (id = ? OR ? IS NULL)
     ORDER BY decision_date DESC LIMIT 20`,
    [orgId, ref.artifact_id || null, ref.artifact_id || null]
  );

  for (const d of decisions) {
    const statusLabel = d.status || 'pending';
    const impactLabel = d.impact ? ` (impact: ${d.impact})` : '';
    pack.key_points.push(
      `Decision "${d.title}" — ${statusLabel}${impactLabel}: ${d.description || 'No description'}`
    );
  }

  const approved = decisions.filter(
    (d: any) => d.status === 'approved' || d.status === 'decided'
  ).length;
  pack.data_points.push(
    { label: 'Total Decisions', value: decisions.length, source_artifact_id: ref.artifact_id },
    { label: 'Approved/Decided', value: approved, source_artifact_id: ref.artifact_id }
  );
}

async function extractBenefitsData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const benefits = await dbAll(
    `SELECT title, category, status, target_value, current_value, unit, currency, trend_direction, period
     FROM benefits WHERE organization_id = ? AND (id = ? OR ? IS NULL)
     ORDER BY updated_at DESC LIMIT 20`,
    [orgId, ref.artifact_id || null, ref.artifact_id || null]
  );

  for (const b of benefits) {
    const achievedPct =
      b.target_value && b.current_value
        ? Math.round((Number(b.current_value) / Number(b.target_value)) * 100)
        : null;
    pack.data_points.push({
      label: b.title,
      value: b.current_value ?? 0,
      unit: b.unit || b.currency || undefined,
      trend: b.trend_direction || undefined,
      period: b.period || undefined,
      source_artifact_id: ref.artifact_id,
    });
    if (achievedPct !== null) {
      pack.key_points.push(`Benefit "${b.title}": ${achievedPct}% of target achieved.`);
    }
  }

  if (benefits.length > 0) {
    const onTrack = benefits.filter(
      (b: any) => b.status === 'on_track' || b.status === 'achieved'
    ).length;
    pack.key_points.push(`${benefits.length} benefits tracked; ${onTrack} on track/achieved.`);
    pack.charts_available.push({
      chart_type: 'bar',
      title: 'Benefits Realisation',
      data_summary: `${benefits.length} benefits with target vs current values`,
      source_artifact_id: ref.artifact_id,
    });
  }
}

async function extractEconomicAnalysisData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  if (!ref.artifact_id) return;

  const rows = await dbAll(
    `SELECT title, status, total_budget, spent, remaining, currency, period, category
     FROM financial_analyses WHERE organization_id = ? AND id = ? LIMIT 1`,
    [orgId, ref.artifact_id]
  );

  for (const row of rows) {
    pack.headings.push(row.title || 'Economic Analysis');
    const currency = row.currency || 'PLN';
    if (row.total_budget != null) {
      pack.data_points.push({
        label: 'Total Budget',
        value: row.total_budget,
        unit: currency,
        source_artifact_id: ref.artifact_id,
      });
    }
    if (row.spent != null) {
      pack.data_points.push({
        label: 'Spent',
        value: row.spent,
        unit: currency,
        source_artifact_id: ref.artifact_id,
      });
    }
    if (row.remaining != null) {
      pack.data_points.push({
        label: 'Remaining',
        value: row.remaining,
        unit: currency,
        source_artifact_id: ref.artifact_id,
      });
    }
    if (row.total_budget && row.spent) {
      const utilisation = Math.round((Number(row.spent) / Number(row.total_budget)) * 100);
      pack.key_points.push(
        `Budget utilisation: ${utilisation}% (${row.spent} of ${row.total_budget} ${currency})`
      );
    }
  }

  const budgetLines = await dbAll(
    `SELECT name, amount, category
     FROM budget_lines WHERE organization_id = ? AND analysis_id = ?
     ORDER BY amount DESC LIMIT 15`,
    [orgId, ref.artifact_id]
  );

  for (const line of budgetLines) {
    pack.data_points.push({
      label: line.name,
      value: line.amount,
      unit: rows[0]?.currency || 'PLN',
      source_artifact_id: ref.artifact_id,
    });
  }

  if (budgetLines.length > 0) {
    pack.charts_available.push({
      chart_type: 'bar',
      title: 'Budget Breakdown',
      data_summary: `${budgetLines.length} budget line items`,
      source_artifact_id: ref.artifact_id,
    });
  }
}

/**
 * Extract P18 artifact governance data (trust-state) for AI context enrichment.
 * Provides the AI with knowledge of artifact lifecycle state: whether it's
 * validated, in review, published, private, etc.
 */
async function extractArtifactGovernanceData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const artifact = await dbGet(
    `SELECT artifact_id, title, artifact_type, visibility_scope,
            publish_state, validation_state, execution_run_id, execution_state
     FROM v8_output_artifacts
     WHERE organization_id = ? AND artifact_id = ?`,
    [orgId, ref.artifact_id]
  );

  if (!artifact) return;

  const parts: string[] = [];
  if (artifact.title)
    parts.push(`Artifact "${artifact.title}" (${artifact.artifact_type || ref.artifact_type})`);
  if (artifact.visibility_scope) parts.push(`visibility: ${artifact.visibility_scope}`);
  if (artifact.validation_state) parts.push(`validation: ${artifact.validation_state}`);
  if (artifact.publish_state) parts.push(`publish state: ${artifact.publish_state}`);
  if (artifact.execution_state) parts.push(`execution: ${artifact.execution_state}`);
  if (artifact.execution_run_id) parts.push(`execution run: ${artifact.execution_run_id}`);

  if (parts.length > 0) {
    pack.key_points.push(`[Governance] ${parts.join(' | ')}`);
  }
}

/**
 * Load a previously saved ContextPack snapshot from the database.
 * Returns null when no snapshot exists (e.g., deck was generated before snapshots were introduced).
 */
export async function getContextPackSnapshot(deckId: string): Promise<ContextPack | null> {
  try {
    const row = (await dbAll(
      `SELECT pack_data FROM context_pack_snapshots WHERE deck_id = ? LIMIT 1`,
      [deckId]
    )) as any[];
    if (!row || row.length === 0) return null;
    return JSON.parse(row[0].pack_data) as ContextPack;
  } catch (error) {
    logger.warn('[ContextPack] Failed to load snapshot', { error });
    return null;
  }
}

/**
 * Save a ContextPack snapshot to the database for refresh/audit purposes.
 */
export async function saveContextPackSnapshot(deckId: string, pack: ContextPack): Promise<void> {
  try {
    await dbAll(
      `INSERT INTO context_pack_snapshots (deck_id, pack_id, pack_data, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(deck_id) DO UPDATE SET pack_data = excluded.pack_data, created_at = excluded.created_at`,
      [deckId, pack.pack_id, JSON.stringify(pack), pack.created_at]
    );
  } catch (error) {
    logger.warn('[ContextPack] Failed to save snapshot', { error });
  }
}
