#!/usr/bin/env tsx
/**
 * Rich demo dataset seeder for Interview Insights + Initiatives.
 *
 * Goal:
 * - Provide realistic, diverse and content-rich test data for QA/demo.
 * - Cover multiple statuses, confidence levels, source lineage and readiness states.
 * - Keep script idempotent (deterministic IDs + UPSERT).
 *
 * Usage (repo root):
 *   ENV_FILE=.env.local npx tsx server/scripts/seed-insights-initiatives-rich-demo.ts
 *
 * Optional:
 *   SEED_ORG_ID=<org_id>
 *   SEED_PROJECT_ID=<project_id>
 *   SEED_USER_EMAIL=<email>
 *   SEED_CONFIRM=YES
 */

import dotenv from 'dotenv';
import path from 'node:path';

import * as DbPromise from '../src/utils/DbPromise.js';
import { getDatabase } from '../src/database/Database.js';

type AnyRow = Record<string, unknown>;

type SeedInsight = {
  id: string;
  title: string;
  promptType: string;
  status: 'completed' | 'failed' | 'generating';
  reviewStatus?: 'draft' | 'in_review' | 'published';
  impactLevel: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high' | 'contradicted';
  sourceSessionIds: string[];
  exportedToAssessment?: boolean;
  exportedToTools?: boolean;
  content: string;
};

type SeedInitiative = {
  id: string;
  name: string;
  summary: string;
  status:
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'REVIEW'
    | 'PROMOTED'
    | 'PLANNING'
    | 'APPROVED'
    | 'SCHEDULED'
    | 'EXECUTING'
    | 'BLOCKED'
    | 'DONE'
    | 'TRACKING'
    | 'CANCELLED'
    | 'ARCHIVED';
  priority: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  confidenceLevel: 'low' | 'medium' | 'high' | 'contradicted';
  sourceInsightId: string;
  sourceRefs: Array<{ type: string; id: string; title?: string }>;
  evidenceRefs: string[];
  category?: string;
  progress?: number;
};

const CONFIRM = 'YES';
const DEFAULT_PROJECT_NAME = 'Transformation Program 2026';

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ?
      ) as exists`,
      [tableName],
      { fallback: true }
    );
    if (row?.exists) return true;
  } catch {
    // Fallback below.
  }

  try {
    const rows = await DbPromise.all(`PRAGMA table_info(${tableName})`, [], { fallback: true });
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function getColumnSet(tableName: string): Promise<Set<string>> {
  try {
    const rows = await DbPromise.all<{ column_name?: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ?`,
      [tableName],
      { fallback: true }
    );
    const names = rows.map((r) => String(r.column_name || '')).filter(Boolean);
    if (names.length > 0) return new Set(names);
  } catch {
    // Fallback below.
  }

  try {
    const rows = await DbPromise.all<{ name?: string }>(`PRAGMA table_info(${tableName})`, [], {
      fallback: true,
    });
    return new Set(rows.map((r) => String(r.name || '')).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function upsertById(
  tableName: string,
  row: AnyRow,
  allowedColumns: Set<string>
): Promise<void> {
  const cols = Object.keys(row).filter((c) => allowedColumns.has(c) && row[c] !== undefined);
  if (cols.length === 0 || !cols.includes('id')) return;
  const values = cols.map((c) => row[c]);
  const updateCols = cols.filter((c) => c !== 'id');

  const sql = `INSERT INTO ${tableName} (${cols.join(', ')})
               VALUES (${cols.map(() => '?').join(', ')})
               ON CONFLICT(id) DO UPDATE SET ${updateCols
                 .map((c) => `${c}=excluded.${c}`)
                 .join(', ')}`;
  await DbPromise.run(sql, values, { fallback: true });
}

async function resolveContext() {
  const seedOrgId = String(process.env.SEED_ORG_ID || '').trim();
  const seedProjectId = String(process.env.SEED_PROJECT_ID || '').trim();
  const seedUserEmail = String(process.env.SEED_USER_EMAIL || '').trim().toLowerCase();

  const userByEmail = seedUserEmail
    ? await DbPromise.get<{ id: string; organization_id?: string; email: string }>(
        `SELECT id, organization_id, email
         FROM users
         WHERE lower(email) = ?
         LIMIT 1`,
        [seedUserEmail],
        { fallback: true }
      )
    : null;

  if (seedUserEmail && !userByEmail?.id) {
    throw new Error(
      `[seed-insights-initiatives-rich-demo] SEED_USER_EMAIL="${seedUserEmail}" not found (or query timed out). Pass SEED_ORG_ID explicitly to avoid seeding wrong tenant.`
    );
  }

  const fallbackOrg =
    (await DbPromise.get<{ id?: string }>(
      `SELECT id
       FROM organizations
       LIMIT 1`,
      [],
      { fallback: true }
    )) ||
    (await DbPromise.get<{ organization_id?: string }>(
      `SELECT organization_id
       FROM users
       WHERE organization_id IS NOT NULL
       LIMIT 1`,
      [],
      { fallback: true }
    ));

  const orgId =
    seedOrgId || userByEmail?.organization_id || fallbackOrg?.id || fallbackOrg?.organization_id || null;
  if (!orgId) {
    throw new Error(
      '[seed-insights-initiatives-rich-demo] Missing target organization. Set SEED_ORG_ID or SEED_USER_EMAIL.'
    );
  }

  const owner =
    userByEmail ||
    (await DbPromise.get<{ id: string; email: string }>(
      `SELECT id, email
       FROM users
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId],
      { fallback: true }
    ));
  if (!owner?.id) {
    throw new Error('[seed-insights-initiatives-rich-demo] No user found in target organization.');
  }

  const project =
    (seedProjectId
      ? await DbPromise.get<{ id: string; name?: string }>(
          `SELECT id, name FROM projects WHERE id = ? LIMIT 1`,
          [seedProjectId],
          { fallback: true }
        )
      : null) ||
    (await DbPromise.get<{ id: string; name?: string }>(
      `SELECT id, name
       FROM projects
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId],
      { fallback: true }
    ));

  if (!project?.id) {
    throw new Error(
      '[seed-insights-initiatives-rich-demo] No project found in target organization. Create one first or pass SEED_PROJECT_ID.'
    );
  }

  return {
    orgId,
    projectId: project.id,
    projectName: project.name || DEFAULT_PROJECT_NAME,
    ownerId: owner.id,
    ownerEmail: owner.email,
  };
}

function buildInsights(sessionIds: string[]): SeedInsight[] {
  return [
    {
      id: 'seed_ri_insight_exec_summary',
      title: 'Executive synthesis: throughput, margin, and governance gaps',
      promptType: 'summary',
      status: 'completed',
      reviewStatus: 'published',
      impactLevel: 'high',
      confidence: 'high',
      sourceSessionIds: [sessionIds[0], sessionIds[1]],
      exportedToAssessment: true,
      exportedToTools: false,
      content: `## Executive Summary

Main blockers are concentrated in three domains:
1. Approval latency (cross-functional decisions arrive too late).
2. Data trust gaps (different KPI definitions between Ops and Finance).
3. Governance ambiguity (no explicit owner for exception handling).

### Key evidence
- 64% of respondents indicate approval queues as the primary lead-time driver.
- 5 critical KPIs have conflicting definitions across functions.
- Escalation flow is informal and person-dependent.

### Implications
- Margin leakage through expedite, rework, and premium logistics.
- Low predictability of commitments to customers.
- Transformation decisions are delayed by uncertainty in evidence quality.`,
    },
    {
      id: 'seed_ri_insight_trends',
      title: 'Trend map: recurring friction points in planning-to-execution',
      promptType: 'trends',
      status: 'completed',
      reviewStatus: 'in_review',
      impactLevel: 'high',
      confidence: 'high',
      sourceSessionIds: [sessionIds[0], sessionIds[2]],
      content: `## Trend analysis

### Stable recurring themes
- Manual Excel handoffs between ERP, MES, and reporting.
- Capacity planning done weekly, while volatility requires daily updates.
- Incident RCA not connected to initiative portfolio decisions.

### Divergences
- Operations prioritize cycle-time and flow.
- Finance prioritizes ROI certainty and risk exposure.
- IT prioritizes integration debt and supportability.

### Candidate intervention clusters
- Decision rights + SLA for approvals
- KPI harmonization with owners
- Integration and workflow automation for handoffs`,
    },
    {
      id: 'seed_ri_insight_risk_scan',
      title: 'Risk scan: dependency and readiness hotspots',
      promptType: 'risk_assessment',
      status: 'completed',
      reviewStatus: 'draft',
      impactLevel: 'medium',
      confidence: 'medium',
      sourceSessionIds: [sessionIds[1], sessionIds[3]],
      content: `## Risk assessment matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| IT integration bandwidth | High | High | Sequence initiatives by dependency criticality |
| Governance overload | Medium | High | Define gate owners and fast-track criteria |
| Adoption resistance | Medium | Medium | Role-based playbooks and manager coaching |
| Data quality disputes | High | Medium | KPI contract + audit trail for metric lineage |`,
    },
    {
      id: 'seed_ri_insight_opportunity',
      title: 'Opportunity scan: quick wins under 90 days',
      promptType: 'opportunity_scan',
      status: 'completed',
      reviewStatus: 'published',
      impactLevel: 'high',
      confidence: 'high',
      sourceSessionIds: [sessionIds[0], sessionIds[4]],
      content: `## Opportunity scan (90-day horizon)

Quick wins with low effort / high impact:
- Approval SLA + escalation board (daily standup)
- Line 3 SMED pilot and standard work refresh
- KPI dictionary v1 with owner sign-off
- Exception workflow in one unified board

Expected outcomes:
- Lead-time reduction: 8-12%
- Expedite cost reduction: 10-18%
- Weekly governance cycle from ad-hoc to repeatable`,
    },
    {
      id: 'seed_ri_insight_between_lines',
      title: 'Between the lines: hidden tensions in accountability model',
      promptType: 'between_the_lines',
      status: 'completed',
      reviewStatus: 'in_review',
      impactLevel: 'high',
      confidence: 'contradicted',
      sourceSessionIds: [sessionIds[2], sessionIds[5]],
      content: `## Between-the-lines synthesis

Signals suggest hidden accountability conflict:
- Teams report "clear priorities", but operational decisions are repeatedly escalated.
- Respondents avoid naming decision owner when discussing exceptions.
- Finance and Ops use different narratives for the same delays.

Interpretation:
Formal governance exists, but practical decision ownership is unresolved in critical moments.

Note:
Confidence marked as contradicted due to conflicting narratives that need read-back closure.`,
    },
    {
      id: 'seed_ri_insight_maturity',
      title: 'Maturity assessment: decision system and delivery reliability',
      promptType: 'maturity',
      status: 'completed',
      reviewStatus: 'draft',
      impactLevel: 'medium',
      confidence: 'medium',
      sourceSessionIds: [sessionIds[3], sessionIds[4]],
      content: `## Maturity snapshot (1-5 scale)

- Governance clarity: 2.5
- KPI consistency: 2.0
- Automation readiness: 2.8
- Change adoption mechanism: 2.6
- Portfolio traceability: 2.4

Overall maturity: 2.5 / 5

Primary lever:
Connect initiative gates with evidence-readback and explicit owners.`,
    },
    {
      id: 'seed_ri_insight_comparison',
      title: 'Cross-interview comparison: role-based perspective gaps',
      promptType: 'comparison',
      status: 'completed',
      reviewStatus: 'published',
      impactLevel: 'medium',
      confidence: 'high',
      sourceSessionIds: [sessionIds[0], sessionIds[1], sessionIds[2]],
      content: `## Cross-interview comparison

Ops:
- Strong process intuition, weak documentation consistency

Finance:
- Strong economic framing, weak process-level ownership mapping

IT:
- Strong technical constraints perspective, weak business prioritization alignment

Synthesis:
Need one shared transformation operating model to align language, decisions, and sequencing.`,
    },
    {
      id: 'seed_ri_insight_material_quality',
      title: 'Material quality scan: evidence completeness and confidence',
      promptType: 'material_quality_scan',
      status: 'completed',
      reviewStatus: 'draft',
      impactLevel: 'medium',
      confidence: 'medium',
      sourceSessionIds: [sessionIds[1], sessionIds[4], sessionIds[5]],
      content: `## Material quality scan

Strengths:
- Good coverage of operational bottlenecks
- Consistent examples on approval delays

Gaps:
- Weak baseline for cost-to-serve by segment
- Missing hard evidence for two strategic assumptions
- Read-back pending for contradictory claims

Recommendation:
Mark uncertain initiative candidates as needs_evidence before promotion.`,
    },
    {
      id: 'seed_ri_insight_failed',
      title: 'Failure state sample: provider timeout',
      promptType: 'summary',
      status: 'failed',
      reviewStatus: 'draft',
      impactLevel: 'low',
      confidence: 'low',
      sourceSessionIds: [sessionIds[5]],
      content: `Seeded failed insight to validate empty/error/retry UX and test resilience under LLM provider timeout.`,
    },
    {
      id: 'seed_ri_insight_generating',
      title: 'Generating state sample: contradiction scan',
      promptType: 'contradiction_scan',
      status: 'generating',
      reviewStatus: 'draft',
      impactLevel: 'low',
      confidence: 'medium',
      sourceSessionIds: [sessionIds[0], sessionIds[3]],
      content: `Seeded generating insight to validate loading states and asynchronous updates in list/table modes.`,
    },
  ];
}

function buildInitiatives(): SeedInitiative[] {
  return [
    {
      id: 'seed_ri_init_approval_sla',
      name: 'Approval SLA and escalation governance',
      summary: 'Create cross-functional approval SLA with explicit ownership and escalation rules.',
      status: 'DRAFT',
      priority: 'high',
      impact: 'high',
      effort: 'medium',
      confidenceLevel: 'high',
      sourceInsightId: 'seed_ri_insight_exec_summary',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_exec_summary' }],
      evidenceRefs: ['ev-approval-queue-01', 'ev-escalation-gap-02'],
      category: 'interview_insight',
      progress: 0,
    },
    {
      id: 'seed_ri_init_kpi_contract',
      name: 'KPI contract and metric ownership',
      summary: 'Unify KPI definitions and assign clear owners with read-back protocol.',
      status: 'PENDING_APPROVAL',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      confidenceLevel: 'high',
      sourceInsightId: 'seed_ri_insight_trends',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_trends' }],
      evidenceRefs: ['ev-kpi-drift-01', 'ev-owner-gap-01'],
      category: 'interview_insight',
      progress: 8,
    },
    {
      id: 'seed_ri_init_handoff_automation',
      name: 'Planning-to-execution handoff automation',
      summary: 'Reduce manual handoffs by introducing workflow automation and integration rules.',
      status: 'PENDING_APPROVAL',
      priority: 'high',
      impact: 'high',
      effort: 'high',
      confidenceLevel: 'medium',
      sourceInsightId: 'seed_ri_insight_opportunity',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_opportunity' }],
      evidenceRefs: ['ev-excel-handoff-01', 'ev-cycle-delay-03'],
      category: 'interview_insight',
      progress: 12,
    },
    {
      id: 'seed_ri_init_smed_line3',
      name: 'SMED pilot on Line 3',
      summary: 'Run pilot to shorten changeovers and standardize setup procedure.',
      status: 'PENDING_APPROVAL',
      priority: 'medium',
      impact: 'high',
      effort: 'medium',
      confidenceLevel: 'high',
      sourceInsightId: 'seed_ri_insight_opportunity',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_opportunity' }],
      evidenceRefs: ['ev-changeover-01', 'ev-line3-constraints-02'],
      category: 'interview_insight',
      progress: 18,
    },
    {
      id: 'seed_ri_init_decision_rights',
      name: 'Decision rights redesign for exceptions',
      summary: 'Map and simplify decision rights across Ops/Finance/IT for exception handling.',
      status: 'PENDING_APPROVAL',
      priority: 'high',
      impact: 'medium',
      effort: 'medium',
      confidenceLevel: 'medium',
      sourceInsightId: 'seed_ri_insight_between_lines',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_between_lines' }],
      evidenceRefs: ['ev-contradiction-01'],
      category: 'interview_insight',
      progress: 24,
    },
    {
      id: 'seed_ri_init_weekly_portfolio_board',
      name: 'Weekly transformation portfolio board',
      summary: 'Introduce weekly governance board linking evidence, gates and execution priorities.',
      status: 'APPROVED',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      confidenceLevel: 'high',
      sourceInsightId: 'seed_ri_insight_exec_summary',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_exec_summary' }],
      evidenceRefs: ['ev-governance-cycle-01', 'ev-owner-mapping-04'],
      category: 'interview_insight',
      progress: 36,
    },
    {
      id: 'seed_ri_init_data_lineage',
      name: 'Data lineage for critical KPI set',
      summary: 'Create lineage and reconciliation process for top 5 business-critical metrics.',
      status: 'APPROVED',
      priority: 'medium',
      impact: 'high',
      effort: 'medium',
      confidenceLevel: 'high',
      sourceInsightId: 'seed_ri_insight_material_quality',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_material_quality' }],
      evidenceRefs: ['ev-metric-conflict-02', 'ev-report-latency-03'],
      category: 'interview_insight',
      progress: 48,
    },
    {
      id: 'seed_ri_init_it_capacity_buffer',
      name: 'IT capacity buffer and sequencing',
      summary: 'Protect key integration bandwidth by sequencing high-dependency initiatives.',
      status: 'IN_EXECUTION',
      priority: 'high',
      impact: 'medium',
      effort: 'medium',
      confidenceLevel: 'medium',
      sourceInsightId: 'seed_ri_insight_risk_scan',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_risk_scan' }],
      evidenceRefs: ['ev-it-capacity-01', 'ev-dependency-spike-02'],
      category: 'interview_insight',
      progress: 61,
    },
    {
      id: 'seed_ri_init_change_adoption',
      name: 'Change adoption champions network',
      summary: 'Build line-manager champion network to improve adoption consistency.',
      status: 'IN_EXECUTION',
      priority: 'medium',
      impact: 'medium',
      effort: 'medium',
      confidenceLevel: 'medium',
      sourceInsightId: 'seed_ri_insight_risk_scan',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_risk_scan' }],
      evidenceRefs: ['ev-adoption-resistance-01'],
      category: 'interview_insight',
      progress: 40,
    },
    {
      id: 'seed_ri_init_exception_board',
      name: 'Exception management board',
      summary: 'Standardize exception intake, triage and SLA tracking.',
      status: 'CLOSED',
      priority: 'medium',
      impact: 'medium',
      effort: 'low',
      confidenceLevel: 'high',
      sourceInsightId: 'seed_ri_insight_trends',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_trends' }],
      evidenceRefs: ['ev-exception-volume-01', 'ev-rework-cycle-03'],
      category: 'interview_insight',
      progress: 100,
    },
    {
      id: 'seed_ri_init_benefits_tracking',
      name: 'Benefits tracking model',
      summary: 'Create benefits register tied to initiative gates and monthly review cadence.',
      status: 'CLOSED',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      confidenceLevel: 'high',
      sourceInsightId: 'seed_ri_insight_exec_summary',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_exec_summary' }],
      evidenceRefs: ['ev-margin-leak-01', 'ev-expedite-cost-02'],
      category: 'interview_insight',
      progress: 100,
    },
    {
      id: 'seed_ri_init_contradiction_research',
      name: 'Contradiction clarification interviews',
      summary: 'Focused read-back cycle to resolve conflicted narratives before scaling change.',
      status: 'REJECTED',
      priority: 'low',
      impact: 'low',
      effort: 'medium',
      confidenceLevel: 'contradicted',
      sourceInsightId: 'seed_ri_insight_between_lines',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_between_lines' }],
      evidenceRefs: ['ev-contradiction-01'],
      category: 'interview_insight',
      progress: 15,
    },
    {
      id: 'seed_ri_init_archive_example',
      name: 'Legacy reporting cleanup initiative',
      summary: 'Archived sample to validate terminal states and visibility rules.',
      status: 'CLOSED',
      priority: 'low',
      impact: 'low',
      effort: 'low',
      confidenceLevel: 'medium',
      sourceInsightId: 'seed_ri_insight_comparison',
      sourceRefs: [{ type: 'interview_insight', id: 'seed_ri_insight_comparison' }],
      evidenceRefs: ['ev-legacy-report-01'],
      category: 'interview_insight',
      progress: 100,
    },
  ];
}

async function ensureSessions(
  orgId: string,
  projectId: string,
  ownerId: string
): Promise<string[]> {
  if (!(await tableExists('interview_sessions'))) return [];
  const cols = await getColumnSet('interview_sessions');
  const sessionIds = [
    'seed_ri_session_01',
    'seed_ri_session_02',
    'seed_ri_session_03',
    'seed_ri_session_04',
    'seed_ri_session_05',
    'seed_ri_session_06',
  ];

  const names = [
    'Ops flow & approvals',
    'Finance metrics and margin leakage',
    'IT integration constraints',
    'People and adoption readiness',
    'Customer-facing SLA reliability',
    'Governance and escalation map',
  ];

  for (let i = 0; i < sessionIds.length; i += 1) {
    await upsertById(
      'interview_sessions',
      {
        id: sessionIds[i],
        organization_id: orgId,
        project_id: projectId,
        name: `Seed session: ${names[i]}`,
        owner_id: ownerId,
        status: 'completed',
        total_questions: 12,
        answered_questions: 12,
        template_id: null,
        started_at: daysAgo(30 - i * 2),
        completed_at: daysAgo(28 - i * 2),
        last_activity_at: daysAgo(28 - i * 2),
        created_at: daysAgo(30 - i * 2),
        updated_at: nowIso(),
      },
      cols
    );
  }

  return sessionIds;
}

async function seedInsights(
  orgId: string,
  ownerId: string,
  sessionIds: string[]
): Promise<{ seeded: number; ids: string[] }> {
  if (!(await tableExists('interview_insights'))) {
    return { seeded: 0, ids: [] };
  }
  const cols = await getColumnSet('interview_insights');
  const insights = buildInsights(sessionIds);

  for (let i = 0; i < insights.length; i += 1) {
    const insight = insights[i];
    const createdAt = daysAgo(20 - i);
    await upsertById(
      'interview_insights',
      {
        id: insight.id,
        session_id: insight.sourceSessionIds[0] || null,
        organization_id: orgId,
        category: 'consulting',
        title: insight.title,
        description: insight.content.slice(0, 600),
        prompt_type: insight.promptType,
        source_session_ids: JSON.stringify(insight.sourceSessionIds),
        source_session_count: insight.sourceSessionIds.length,
        content: insight.content,
        status: insight.status,
        review_status: insight.reviewStatus || 'draft',
        error_message:
          insight.status === 'failed'
            ? 'Seeded provider timeout sample for retry-state testing.'
            : null,
        generated_recommendations:
          insight.status === 'completed'
            ? JSON.stringify([
                'Define owner + SLA for top blocker path.',
                'Run read-back for contradicted evidence.',
                'Convert ready candidates to governed initiative drafts.',
              ])
            : null,
        confidence: insight.confidence,
        confidence_level: insight.confidence,
        impact_level: insight.impactLevel,
        source_type: 'interview_session',
        source_id: insight.sourceSessionIds[0] || null,
        exported_to_assessment: insight.exportedToAssessment ? 1 : 0,
        exported_to_tools: insight.exportedToTools ? 1 : 0,
        created_by: ownerId,
        created_at: createdAt,
        updated_at: nowIso(),
      },
      cols
    );
  }

  return { seeded: insights.length, ids: insights.map((x) => x.id) };
}

async function seedInitiatives(
  orgId: string,
  projectId: string,
  ownerId: string
): Promise<{ seeded: number }> {
  if (!(await tableExists('initiatives'))) return { seeded: 0 };
  const cols = await getColumnSet('initiatives');
  const limit = Number(process.env.SEED_INITIATIVE_LIMIT || 0);
  const initiatives = limit > 0 ? buildInitiatives().slice(0, limit) : buildInitiatives();

  for (let i = 0; i < initiatives.length; i += 1) {
    const item = initiatives[i];
    const createdAt = daysAgo(16 - i);
    await upsertById(
      'initiatives',
      {
        id: item.id,
        organization_id: orgId,
        project_id: projectId,
        name: item.name,
        title: item.name,
        summary: item.summary,
        description: item.summary,
        hypothesis: item.summary,
        category: item.category || 'interview_insight',
        axis: 'transformational',
        status: item.status,
        priority: item.priority,
        impact: item.impact,
        effort: item.effort,
        confidence_level: item.confidenceLevel,
        progress: typeof item.progress === 'number' ? item.progress : 0,
        source_type: 'interview_insight',
        source_id: item.sourceInsightId,
        created_from: 'interview_insight',
        source_assessment_id: null,
        problem_statement: item.summary,
        key_risks:
          // DEC-424: was `item.status === 'BLOCKED'`, but 'BLOCKED' collapsed into
          // 'IN_EXECUTION' when the seed status literal was fixed to the canonical
          // 7-value dictionary (server/src/constants/initiativeStatuses.ts) — match
          // by id so this specific initiative keeps its dependency-risk content.
          item.id === 'seed_ri_init_change_adoption'
            ? JSON.stringify([
                'Dependency owner not assigned',
                'Missing integration capacity window',
              ])
            : JSON.stringify([]),
        success_criteria: JSON.stringify([
          'Owner assigned',
          'Gate-ready evidence package',
          'Monthly tracking in portfolio board',
        ]),
        action_contract_json: JSON.stringify({
          target: 'initiative',
          mode: 'generate_from_evidence',
          proposalOnly: true,
          approvedCandidateStatus: item.status,
        }),
        source_pack_json: JSON.stringify({
          seed: 'rich-demo',
          sourceRefs: item.sourceRefs,
          evidenceRefs: item.evidenceRefs,
        }),
        evidence_refs_json: JSON.stringify(item.evidenceRefs),
        owner_business_id: ownerId,
        owner_execution_id: ownerId,
        created_at: createdAt,
        updated_at: nowIso(),
      },
      cols
    );
  }

  return { seeded: initiatives.length };
}

async function main() {
  const envFile = String(process.env.ENV_FILE || '.env.local');
  dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('Refusing to run with NODE_ENV=production');
  }

  if (String(process.env.SEED_CONFIRM || '') !== CONFIRM) {
    throw new Error(`Set SEED_CONFIRM=${CONFIRM} to run this seeder.`);
  }

  await getDatabase();
  const { orgId, projectId, projectName, ownerId, ownerEmail } = await resolveContext();
  const sessionIds = await ensureSessions(orgId, projectId, ownerId);
  const insights = await seedInsights(orgId, ownerId, sessionIds);
  const initiatives = await seedInitiatives(orgId, projectId, ownerId);

  const insightStatusCounts = await DbPromise.all<{ status: string; c: number }>(
    `SELECT status, COUNT(*) as c
     FROM interview_insights
     WHERE organization_id = ? AND id LIKE 'seed_ri_insight_%'
     GROUP BY status
     ORDER BY status`,
    [orgId],
    { fallback: true }
  );

  const initiativeStatusCounts = await DbPromise.all<{ status: string; c: number }>(
    `SELECT status, COUNT(*) as c
     FROM initiatives
     WHERE organization_id = ? AND id LIKE 'seed_ri_init_%'
     GROUP BY status
     ORDER BY status`,
    [orgId],
    { fallback: true }
  );

  console.log('[seed-insights-initiatives-rich-demo] DONE', {
    organizationId: orgId,
    projectId,
    projectName,
    ownerId,
    ownerEmail,
    seededSessions: sessionIds.length,
    seededInsights: insights.seeded,
    seededInitiatives: initiatives.seeded,
    insightStatusCounts,
    initiativeStatusCounts,
  });
}

main()
  .catch((error) => {
    console.error('[seed-insights-initiatives-rich-demo] FAILED', error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  });
