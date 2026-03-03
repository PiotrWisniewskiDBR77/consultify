/**
 * ContextPack Builder — constructs a standardized structured input for AI generation.
 * Replaces raw text dumps with organized data packages containing:
 * headings, key_points, data_points, charts_available, images_available, metadata.
 */

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

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
    },
  };

  for (const ref of sourceRefs) {
    try {
      await extractFromSource(pack, ref, organizationId);
    } catch (error) {
      logger.warn(`[ContextPack] Failed to extract from ${ref.artifact_type}:${ref.artifact_id}`, { error });
      pack.metadata.extraction_warnings.push(
        `Failed to extract data from ${ref.artifact_name} (${ref.artifact_type})`
      );
      pack.metadata.confidence_score -= 0.1;
    }
  }

  pack.metadata.confidence_score = Math.max(0, pack.metadata.confidence_score);

  return pack;
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
    default:
      pack.metadata.extraction_warnings.push(`Unknown artifact type: ${ref.artifact_type}`);
  }
}

async function extractInitiativeData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const initiatives = await dbAll(
    `SELECT id, name AS title, description, status, priority, owner, started_at, target_date,
            COALESCE(progress, 0) AS progress
     FROM initiatives WHERE organization_id = ? AND (id = ? OR ? IS NULL)
     ORDER BY priority DESC LIMIT 20`,
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
    pack.key_points.push(`${kpis.length} KPIs tracked; ${kpis.filter((k: any) => k.trend_direction === 'up').length} trending up.`);
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
  const completed = tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
  const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;

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

async function extractRiskData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const risks = await dbAll(
    `SELECT title, severity, probability, status, mitigation_plan, owner
     FROM risks WHERE organization_id = ?
     ORDER BY severity DESC, probability DESC LIMIT 15`,
    [orgId]
  );

  const critical = risks.filter((r: any) => r.severity === 'critical' || r.severity === 'high').length;

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
    const output = typeof session.output_data === 'string'
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
    const results = typeof v.results === 'string' ? JSON.parse(v.results || '{}') : (v.results || {});
    const dcf = results?.dcf;
    if (dcf) {
      if (dcf.enterpriseValue != null) pack.data_points.push({ label: 'Enterprise Value', value: dcf.enterpriseValue, unit: v.currency || 'PLN', source_artifact_id: ref.artifact_id });
      if (dcf.equityValue != null) pack.data_points.push({ label: 'Equity Value', value: dcf.equityValue, unit: v.currency || 'PLN', source_artifact_id: ref.artifact_id });
      if (dcf.impliedMultiple != null) pack.data_points.push({ label: 'EV/EBITDA', value: dcf.impliedMultiple, unit: 'x', source_artifact_id: ref.artifact_id });
      if (dcf.wacc != null) pack.data_points.push({ label: 'WACC', value: dcf.wacc, unit: '%', source_artifact_id: ref.artifact_id });
    }
    if (results?.sensitivity) {
      pack.key_points.push(`Sensitivity analysis: ${JSON.stringify(results.sensitivity.rowHeaders || [])} WACC vs growth rates`);
    }
    const advisory = typeof v.advisory === 'string' ? JSON.parse(v.advisory || '{}') : (v.advisory || {});
    const recs = Array.isArray(advisory?.recommendations) ? advisory.recommendations : [];
    for (const rec of recs.slice(0, 5)) {
      pack.key_points.push(`Advisory: ${rec.title || rec.description || ''} (${rec.priority || 'medium'})`);
    }
    pack.metadata.confidence_score += 3;
  }
}

async function extractTaskData(
  pack: ContextPack,
  ref: SourceRef,
  orgId: string
): Promise<void> {
  const tasks = await dbAll(
    `SELECT title, status, priority, assignee, due_date
     FROM tasks WHERE organization_id = ? AND (id = ? OR ? IS NULL)
     ORDER BY due_date ASC LIMIT 30`,
    [orgId, ref.artifact_id || null, ref.artifact_id || null]
  );

  const total = tasks.length;
  const completed = tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
  const overdue = tasks.filter(
    (t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' && t.status !== 'completed'
  ).length;
  const highPriority = tasks.filter((t: any) => t.priority === 'high' || t.priority === 'critical').length;

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
    pack.key_points.push(`Decision "${d.title}" — ${statusLabel}${impactLabel}: ${d.description || 'No description'}`);
  }

  const approved = decisions.filter((d: any) => d.status === 'approved' || d.status === 'decided').length;
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
    const onTrack = benefits.filter((b: any) => b.status === 'on_track' || b.status === 'achieved').length;
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
      pack.data_points.push({ label: 'Total Budget', value: row.total_budget, unit: currency, source_artifact_id: ref.artifact_id });
    }
    if (row.spent != null) {
      pack.data_points.push({ label: 'Spent', value: row.spent, unit: currency, source_artifact_id: ref.artifact_id });
    }
    if (row.remaining != null) {
      pack.data_points.push({ label: 'Remaining', value: row.remaining, unit: currency, source_artifact_id: ref.artifact_id });
    }
    if (row.total_budget && row.spent) {
      const utilisation = Math.round((Number(row.spent) / Number(row.total_budget)) * 100);
      pack.key_points.push(`Budget utilisation: ${utilisation}% (${row.spent} of ${row.total_budget} ${currency})`);
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
 * Save a ContextPack snapshot to the database for refresh/audit purposes.
 */
export async function saveContextPackSnapshot(
  deckId: string,
  pack: ContextPack
): Promise<void> {
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
