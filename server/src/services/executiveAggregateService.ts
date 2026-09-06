import { z } from 'zod';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  type ExecutiveInsightsPayload,
  executiveInsightsService,
} from './executiveInsightsService.js';
import { getHealthSnapshot } from './pmoHealthService.js';
import { detectRiskSignals } from './riskDetectionService.js';

export type ExecPeriod = 'week' | 'month' | 'quarter' | 'custom';

export type ExecutiveAggregateSnapshot = {
  project: { id: string; name: string | null };
  generatedAt: string;
  period: ExecPeriod;
  overview: {
    progressPercent: number;
    phaseLabel: string | null;
    pmoHealth: Awaited<ReturnType<typeof getHealthSnapshot>> | null;
    priorityAlerts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
    nextMilestones: Array<{
      id: string;
      initiativeId: string;
      initiativeName: string;
      name: string;
      targetDate: string | null;
      status: string;
    }>;
  };
  workstreams: {
    items: Array<{
      id: string;
      name: string;
      status: string;
      ownerId: string | null;
      ownerName: string | null;
      initiativeCount: number;
      progressAvg: number;
      onTrackCount: number;
      atRiskCount: number;
      delayedCount: number;
    }>;
    unassignedInitiatives: number;
  };
  kpis: {
    highlights: Array<{
      id: string;
      name: string;
      currentValue: number | null;
      targetValue: number | null;
      unit: string | null;
    }>;
    dataQuality: 'none' | 'partial' | 'good';
  };
  roi: {
    summary: {
      totalProjected: number;
      totalRealized: number;
      totalVariance: number;
      coveragePercent: number;
      initiativeCount: number;
    } | null;
    items: Array<{
      initiativeId: string;
      initiativeName: string;
      projectedBenefit: number;
      realizedBenefit: number;
      variance: number;
      confidence: string | null;
      hasRealized: boolean;
    }>;
  };
  risks: {
    heatmap: Record<string, number>; // key: `${probability}:${impact}`
    topRisks: Array<{
      id: string;
      title: string;
      probability: string | null;
      impact: string | null;
      score: number;
      ownerId: string | null;
      // Kokpit menedżera (1.1-E-1, DEC-426): kolumny Właściciel/Inicjatywa/Status
      // wymagają realnych pól, nie samych ID — dopisane obok ownerId/dueDate
      // istniejących wcześniej (bez zmiany kształtu zastanych pól).
      ownerName: string | null;
      initiativeId: string | null;
      initiativeName: string | null;
      status: string | null;
      dueDate: string | null;
      mitigationStatus: string | null;
    }>;
    signals: {
      riskSignals: Array<any>;
      delaySignals: Array<any>;
      overspendSignals: Array<any>;
    };
  };
  ai: {
    enabled: boolean;
    insights: ExecutiveInsightsPayload | null;
  };
};

export const ExecAggregateOptionsSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  period: z.enum(['week', 'month', 'quarter', 'custom']).default('week'),
  includeAI: z.boolean().default(true),
  refresh: z.boolean().default(false),
  userId: z.string().optional(),
  modelId: z.string().optional(),
});

function clampPercent(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function cacheId(params: {
  organizationId: string;
  projectId: string;
  period: ExecPeriod;
  includeAI: boolean;
}): string {
  return `${params.organizationId}:${params.projectId}:${params.period}:${params.includeAI ? 'ai' : 'noai'}`;
}

function riskLevelToScore(level: string | null | undefined): number {
  const v = String(level || '').toUpperCase();
  if (v === 'CRITICAL') return 4;
  if (v === 'HIGH') return 3;
  if (v === 'MEDIUM') return 2;
  if (v === 'LOW') return 1;
  return 1;
}

export class ExecutiveAggregateService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  private async generateInsightsWithTimeout(
    params: Parameters<typeof executiveInsightsService.generateInsights>[0],
    timeoutMs: number
  ): Promise<ExecutiveInsightsPayload | null> {
    try {
      const timeout = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), Math.max(500, timeoutMs));
      });

      const result = await Promise.race([
        executiveInsightsService.generateInsights(params),
        timeout,
      ]);
      return (result as any) || null;
    } catch (e: any) {
      logger.warn(
        '[ExecutiveAggregateService] generateInsights failed (non-fatal):',
        e?.message || e
      );
      return null;
    }
  }

  private async getDerivedKpiHighlights(
    organizationId: string,
    projectId: string
  ): Promise<ExecutiveAggregateSnapshot['kpis']['highlights']> {
    const nowIso = new Date().toISOString();

    const [executing, blocked, overdueTasks, pendingDecisions] = await Promise.all([
      DbPromise.get<{ c: number }>(
        this.db,
        `SELECT COUNT(*)::int as c FROM initiatives WHERE organization_id = ? AND project_id = ? AND UPPER(status) = 'EXECUTING'`,
        [organizationId, projectId]
      ).catch(() => ({ c: 0 })),
      DbPromise.get<{ c: number }>(
        this.db,
        `SELECT COUNT(*)::int as c FROM initiatives WHERE organization_id = ? AND project_id = ? AND UPPER(status) = 'BLOCKED'`,
        [organizationId, projectId]
      ).catch(() => ({ c: 0 })),
      DbPromise.get<{ c: number }>(
        this.db,
        `
        SELECT COUNT(*)::int as c
        FROM tasks
        WHERE organization_id = ?
          AND project_id = ?
          AND due_date IS NOT NULL
          AND due_date < ?
          AND LOWER(COALESCE(status, '')) NOT IN ('completed', 'done', 'closed', 'cancelled')
      `,
        [organizationId, projectId, nowIso]
      ).catch(() => ({ c: 0 })),
      DbPromise.get<{ c: number }>(
        this.db,
        `
        SELECT COUNT(*)::int as c
        FROM decisions
        WHERE organization_id = ?
          AND project_id = ?
          AND LOWER(COALESCE(status, '')) IN ('pending', 'escalated')
      `,
        [organizationId, projectId]
      ).catch(() => ({ c: 0 })),
    ]);

    return [
      {
        id: 'derived_initiatives_executing',
        name: 'Initiatives executing',
        currentValue: executing?.c ?? 0,
        targetValue: null,
        unit: null,
      },
      {
        id: 'derived_initiatives_blocked',
        name: 'Initiatives blocked',
        currentValue: blocked?.c ?? 0,
        targetValue: null,
        unit: null,
      },
      {
        id: 'derived_tasks_overdue',
        name: 'Overdue tasks',
        currentValue: overdueTasks?.c ?? 0,
        targetValue: null,
        unit: null,
      },
      {
        id: 'derived_decisions_pending',
        name: 'Pending decisions',
        currentValue: pendingDecisions?.c ?? 0,
        targetValue: null,
        unit: null,
      },
    ];
  }

  async ensureSchema(): Promise<void> {
    try {
      await DbPromise.run(
        this.db,
        `
        CREATE TABLE IF NOT EXISTS executive_aggregate_cache (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          period TEXT NOT NULL,
          include_ai INTEGER NOT NULL DEFAULT 1,
          payload_json TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          UNIQUE(organization_id, project_id, period, include_ai)
        )
      `
      );
      await DbPromise.run(
        this.db,
        `CREATE INDEX IF NOT EXISTS idx_exec_agg_cache_lookup ON executive_aggregate_cache(organization_id, project_id, period, include_ai)`
      );
      await DbPromise.run(
        this.db,
        `CREATE INDEX IF NOT EXISTS idx_exec_agg_cache_exp ON executive_aggregate_cache(expires_at)`
      );

      // Self-heal: ensure core executive dependencies exist (some envs rely on raw migrations).
      await DbPromise.run(
        this.db,
        `
        CREATE TABLE IF NOT EXISTS workstreams (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          owner_id TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          color TEXT DEFAULT '#3B82F6',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      );
      await DbPromise.run(
        this.db,
        `CREATE INDEX IF NOT EXISTS idx_workstreams_project ON workstreams(project_id)`
      );

      await DbPromise.run(
        this.db,
        `
        CREATE TABLE IF NOT EXISTS initiative_milestones (
          id TEXT PRIMARY KEY,
          initiative_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          target_date DATE,
          actual_date DATE,
          status TEXT DEFAULT 'PENDING',
          order_index INTEGER DEFAULT 0,
          is_gate INTEGER DEFAULT 0,
          gate_decision_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT
        )
      `
      );
      await DbPromise.run(
        this.db,
        `CREATE INDEX IF NOT EXISTS idx_milestones_org ON initiative_milestones(organization_id)`
      );
      await DbPromise.run(
        this.db,
        `CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON initiative_milestones(target_date)`
      );

      await executiveInsightsService.ensureSchema();
    } catch (e: any) {
      logger.warn('[ExecutiveAggregateService] ensureSchema failed:', e?.message || e);
    }
  }

  private async getCached(params: {
    organizationId: string;
    projectId: string;
    period: ExecPeriod;
    includeAI: boolean;
  }): Promise<ExecutiveAggregateSnapshot | null> {
    await this.ensureSchema();
    const row = await DbPromise.get<any>(
      this.db,
      `
      SELECT payload_json, expires_at
      FROM executive_aggregate_cache
      WHERE organization_id = ? AND project_id = ? AND period = ? AND include_ai = ?
      LIMIT 1
    `,
      [params.organizationId, params.projectId, params.period, params.includeAI ? 1 : 0]
    );
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
    try {
      return JSON.parse(row.payload_json) as ExecutiveAggregateSnapshot;
    } catch {
      return null;
    }
  }

  private async upsertCache(params: {
    organizationId: string;
    projectId: string;
    period: ExecPeriod;
    includeAI: boolean;
    payload: ExecutiveAggregateSnapshot;
    ttlSeconds: number;
  }): Promise<void> {
    await this.ensureSchema();
    const id = cacheId(params);
    const expiresAt = new Date(Date.now() + Math.max(30, params.ttlSeconds) * 1000).toISOString();
    await DbPromise.run(
      this.db,
      `
      INSERT INTO executive_aggregate_cache (id, organization_id, project_id, period, include_ai, payload_json, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, project_id, period, include_ai) DO UPDATE SET
        payload_json = excluded.payload_json,
        expires_at = excluded.expires_at
    `,
      [
        id,
        params.organizationId,
        params.projectId,
        params.period,
        params.includeAI ? 1 : 0,
        JSON.stringify(params.payload),
        expiresAt,
      ]
    );
  }

  async getSnapshot(
    raw: z.input<typeof ExecAggregateOptionsSchema>
  ): Promise<ExecutiveAggregateSnapshot> {
    const opts = ExecAggregateOptionsSchema.parse(raw);
    await this.ensureSchema();

    if (!opts.refresh) {
      const cached = await this.getCached({
        organizationId: opts.organizationId,
        projectId: opts.projectId,
        period: opts.period,
        includeAI: opts.includeAI,
      });
      if (cached) return cached;
    }

    const project = await DbPromise.get<any>(
      this.db,
      `SELECT id, name, progress_pct, current_phase FROM projects WHERE id = ? AND organization_id = ?`,
      [opts.projectId, opts.organizationId],
      { fallback: false }
    );

    const pmoHealth = await getHealthSnapshot(opts.projectId).catch(() => null);

    const [riskSignals, delaySignals, overspendSignals] = await Promise.all([
      detectRiskSignals(opts.organizationId, opts.projectId).catch(() => []),
      DbPromise.all<any>(
        this.db,
        `
        SELECT *
        FROM delay_signals
        WHERE organization_id = ?
          AND (project_id = ? OR project_id IS NULL)
          AND is_dismissed = FALSE
        ORDER BY created_at DESC
        LIMIT 30
      `,
        [opts.organizationId, opts.projectId]
      ).catch(() => []),
      DbPromise.all<any>(
        this.db,
        `
        SELECT *
        FROM budget_overspend_signals
        WHERE organization_id = ?
          AND (project_id = ? OR project_id IS NULL)
          AND is_dismissed = FALSE
        ORDER BY created_at DESC
        LIMIT 30
      `,
        [opts.organizationId, opts.projectId]
      ).catch(() => []),
    ]);

    const [
      nextMilestones,
      workstreams,
      unassigned,
      roiPortfolio,
      raidRisks,
      kpiHighlights,
      rolloutKpiHighlights,
    ] = await Promise.all([
      this.getNextMilestones(opts.organizationId, opts.projectId).catch(() => []),
      this.getWorkstreamsWithStats(opts.projectId).catch(() => []),
      DbPromise.get<{ c: number }>(
        this.db,
        `SELECT COUNT(*)::int as c FROM initiatives WHERE project_id = ? AND organization_id = ? AND (workstream_id IS NULL OR workstream_id = '')`,
        [opts.projectId, opts.organizationId]
      ).catch(() => ({ c: 0 })),
      this.getRoiPortfolioSummary(opts.organizationId).catch(() => ({
        summary: null,
        items: [],
      })),
      this.getProjectRaidRisks(opts.organizationId, opts.projectId).catch(() => []),
      this.getKpiHighlights(opts.organizationId, opts.projectId).catch(() => ({
        highlights: [],
        dataQuality: 'none' as const,
      })),
      this.getRolloutKpiHighlights(opts.organizationId, opts.projectId).catch(() => []),
    ]);

    const baseKpis =
      (kpiHighlights?.highlights || []).length > 0
        ? kpiHighlights
        : {
            highlights: await this.getDerivedKpiHighlights(
              opts.organizationId,
              opts.projectId
            ).catch(() => []),
            dataQuality: 'partial' as const,
          };

    // Merge Module 06 rollout KPIs into the highlights additively. When there are
    // no initiative KPIs, rollout KPIs become the source of data quality.
    const mergedHighlights = [...baseKpis.highlights, ...(rolloutKpiHighlights || [])];
    const effectiveKpis: ExecutiveAggregateSnapshot['kpis'] = {
      highlights: mergedHighlights,
      dataQuality:
        mergedHighlights.length === 0
          ? 'none'
          : baseKpis.highlights.length === 0 && (rolloutKpiHighlights || []).length > 0
            ? (rolloutKpiHighlights || []).some((h) => h.currentValue === null)
              ? 'partial'
              : 'good'
            : baseKpis.dataQuality,
    };

    const progressPercent = clampPercent(
      typeof project.progress_pct === 'number'
        ? project.progress_pct
        : await this.computeProgressFromInitiatives(opts.organizationId, opts.projectId).catch(
            () => 0
          )
    );

    const priorityAlerts = this.buildPriorityAlerts({
      pmoHealth,
      riskSignals,
      delaySignals,
      overspendSignals,
      nextMilestones,
    });

    const workstreamItems = await this.enrichWorkstreamHealth({
      workstreams,
      projectId: opts.projectId,
      organizationId: opts.organizationId,
      delaySignals,
      riskSignals,
    });

    const aiEnabled = Boolean(opts.includeAI);
    const aiInsights =
      aiEnabled && opts.userId
        ? await this.generateInsightsWithTimeout(
            {
              organizationId: opts.organizationId,
              projectId: opts.projectId,
              period: opts.period,
              generatedBy: opts.userId,
              modelId: opts.modelId,
              context: {
                projectName: project.name || null,
                phase: pmoHealth?.phase?.name || project.current_phase || null,
                progressPercent,
                pmoBlockers: (pmoHealth?.blockers || []).map((b: any) => ({
                  type: String(b.type || ''),
                  message: String(b.message || ''),
                })),
                risks: (raidRisks || []).slice(0, 10).map((r: any) => ({
                  title: r.title,
                  severity: r.impact,
                  type: r.type,
                })),
                delaySignals: (delaySignals || []).slice(0, 10).map((s: any) => ({
                  entityName: s.entity_name,
                  deviationType: s.deviation_type,
                  severity: s.severity,
                  daysDeviation: s.days_deviation,
                })),
                overspendSignals: (overspendSignals || []).slice(0, 10).map((s: any) => ({
                  signalType: s.signal_type,
                  severity: s.severity,
                  message: s.message,
                })),
                kpiHighlights: (effectiveKpis.highlights || []).slice(0, 4).map((k: any) => ({
                  name: k.name,
                  current: k.currentValue,
                  target: k.targetValue,
                  unit: k.unit,
                })),
                roiSummary: roiPortfolio?.summary || undefined,
              },
            },
            6500
          )
        : null;

    const snapshot: ExecutiveAggregateSnapshot = {
      project: { id: opts.projectId, name: project.name || null },
      generatedAt: new Date().toISOString(),
      period: opts.period,
      overview: {
        progressPercent,
        phaseLabel: pmoHealth?.phase?.name || project.current_phase || null,
        pmoHealth,
        priorityAlerts,
        nextMilestones,
      },
      workstreams: {
        items: workstreamItems,
        unassignedInitiatives: unassigned?.c || 0,
      },
      kpis: effectiveKpis,
      roi: roiPortfolio,
      risks: {
        heatmap: this.buildRiskHeatmap(raidRisks),
        topRisks: this.buildTopRisks(raidRisks),
        signals: {
          riskSignals,
          delaySignals,
          overspendSignals,
        },
      },
      ai: {
        enabled: aiEnabled,
        insights: aiInsights,
      },
    };

    await this.upsertCache({
      organizationId: opts.organizationId,
      projectId: opts.projectId,
      period: opts.period,
      includeAI: opts.includeAI,
      payload: snapshot,
      ttlSeconds: 120,
    }).catch((err: unknown) => logger.warn('[ExecutiveAggregate] cache upsert failed', err));

    return snapshot;
  }

  private async computeProgressFromInitiatives(orgId: string, projectId: string): Promise<number> {
    const rows = await DbPromise.all<any>(
      this.db,
      `SELECT COALESCE(AVG(COALESCE(progress, 0)), 0) as avg_progress FROM initiatives WHERE organization_id = ? AND project_id = ?`,
      [orgId, projectId]
    );
    const avg = rows?.[0]?.avg_progress;
    return clampPercent(Number(avg || 0));
  }

  private buildPriorityAlerts(params: {
    pmoHealth: any;
    riskSignals: any[];
    delaySignals: any[];
    overspendSignals: any[];
    nextMilestones: any[];
  }): ExecutiveAggregateSnapshot['overview']['priorityAlerts'] {
    const alerts: ExecutiveAggregateSnapshot['overview']['priorityAlerts'] = [];

    const blockers = (params.pmoHealth?.blockers || []) as Array<any>;
    for (const b of blockers.slice(0, 3)) {
      alerts.push({ type: 'blocker', severity: 'high', message: String(b.message || '') });
    }

    const criticalDelay = (params.delaySignals || []).filter(
      (s: any) => String(s.severity || '').toUpperCase() === 'CRITICAL'
    );
    if (criticalDelay.length > 0) {
      alerts.push({
        type: 'delay',
        severity: 'critical',
        message: `${criticalDelay.length} critical delay signals`,
      });
    }

    const highOverspend = (params.overspendSignals || []).filter((s: any) =>
      ['HIGH', 'CRITICAL'].includes(String(s.severity || '').toUpperCase())
    );
    if (highOverspend.length > 0) {
      alerts.push({
        type: 'budget',
        severity: 'high',
        message: `${highOverspend.length} overspend warnings`,
      });
    }

    const severeRisks = (params.riskSignals || []).filter((s: any) =>
      ['HIGH', 'CRITICAL'].includes(String(s.severity || '').toUpperCase())
    );
    if (severeRisks.length > 0) {
      alerts.push({
        type: 'risk',
        severity: 'high',
        message: `${severeRisks.length} risk signals`,
      });
    }

    if (params.pmoHealth?.stageGate && params.pmoHealth.stageGate.isReady === false) {
      alerts.push({
        type: 'gate',
        severity: 'medium',
        message: `Stage gate not ready (${params.pmoHealth.stageGate.gateType || 'N/A'})`,
      });
    }

    const overdueMilestones = (params.nextMilestones || []).filter(
      (m: any) => m.targetDate && new Date(m.targetDate).getTime() < Date.now()
    );
    if (overdueMilestones.length > 0) {
      alerts.push({
        type: 'milestone',
        severity: 'medium',
        message: `${overdueMilestones.length} overdue milestones`,
      });
    }

    return alerts.slice(0, 6);
  }

  private async getNextMilestones(
    orgId: string,
    projectId: string
  ): Promise<ExecutiveAggregateSnapshot['overview']['nextMilestones']> {
    const rows = await DbPromise.all<any>(
      this.db,
      `
      SELECT m.id, m.initiative_id, i.name as initiative_name, m.name, m.target_date, m.status
      FROM initiative_milestones m
      JOIN initiatives i ON i.id = m.initiative_id
      WHERE m.organization_id = ?
        AND i.project_id = ?
        AND COALESCE(m.status, 'PENDING') NOT IN ('COMPLETED', 'DONE')
      ORDER BY m.target_date ASC NULLS LAST, m.order_index ASC
      LIMIT 6
    `,
      [orgId, projectId]
    );
    const mapped = (rows || []).map((r: any) => ({
      id: String(r.id),
      initiativeId: String(r.initiative_id),
      initiativeName: String(r.initiative_name || ''),
      name: String(r.name || ''),
      targetDate: r.target_date || null,
      status: String(r.status || 'PENDING'),
    }));

    // Fallback: if milestones are not used yet, derive "next milestones" from initiative planned end dates.
    if (mapped.length > 0) return mapped;

    const ini = await DbPromise.all<any>(
      this.db,
      `
      SELECT id, COALESCE(title, name) as initiative_name, planned_end_date, end_date, status
      FROM initiatives
      WHERE organization_id = ?
        AND project_id = ?
        AND UPPER(COALESCE(status, '')) NOT IN ('COMPLETED', 'DONE')
        AND (planned_end_date IS NOT NULL OR end_date IS NOT NULL)
      ORDER BY COALESCE(planned_end_date, end_date) ASC NULLS LAST
      LIMIT 6
    `,
      [orgId, projectId]
    ).catch(() => []);

    return (ini || []).map((r: any) => ({
      id: `derived-milestone-${String(r.id)}`,
      initiativeId: String(r.id),
      initiativeName: String(r.initiative_name || ''),
      name: 'Planned end',
      targetDate: r.planned_end_date || r.end_date || null,
      status: String(r.status || 'PENDING'),
    }));
  }

  private async getWorkstreamsWithStats(projectId: string): Promise<any[]> {
    return (
      (await DbPromise.all<any>(
        this.db,
        `
        SELECT
          w.*,
          COALESCE(u.first_name || ' ' || u.last_name, NULL) as owner_name,
          COUNT(i.id) as initiative_count,
          COALESCE(AVG(COALESCE(i.progress, 0)), 0) as avg_progress
        FROM workstreams w
        LEFT JOIN users u ON u.id = w.owner_id
        LEFT JOIN initiatives i ON i.workstream_id = w.id
        WHERE w.project_id = ?
        GROUP BY w.id, u.first_name, u.last_name
        ORDER BY w.sort_order ASC, w.created_at ASC
      `,
        [projectId]
      )) || []
    );
  }

  private async enrichWorkstreamHealth(params: {
    workstreams: any[];
    projectId: string;
    organizationId: string;
    delaySignals: any[];
    riskSignals: any[];
  }): Promise<ExecutiveAggregateSnapshot['workstreams']['items']> {
    const delayByInitiative = new Map<string, boolean>();
    for (const s of params.delaySignals || []) {
      if (String(s.entity_type || '').toUpperCase() === 'INITIATIVE') {
        delayByInitiative.set(String(s.entity_id), true);
      }
    }

    const riskByInitiative = new Map<string, boolean>();
    for (const s of params.riskSignals || []) {
      if (s?.initiativeId) riskByInitiative.set(String(s.initiativeId), true);
    }

    const initiatives = await DbPromise.all<any>(
      this.db,
      `SELECT id, workstream_id, status, progress FROM initiatives WHERE project_id = ? AND organization_id = ?`,
      [params.projectId, params.organizationId]
    ).catch(() => []);

    const byWorkstream = new Map<string, any[]>();
    for (const i of initiatives || []) {
      const wsId = String(i.workstream_id || '');
      if (!wsId) continue;
      const list = byWorkstream.get(wsId) || [];
      list.push(i);
      byWorkstream.set(wsId, list);
    }

    return (params.workstreams || []).map((w: any) => {
      const wsId = String(w.id);
      const items = byWorkstream.get(wsId) || [];

      let onTrack = 0;
      let atRisk = 0;
      let delayed = 0;
      for (const it of items) {
        const id = String(it.id);
        if (delayByInitiative.get(id)) delayed += 1;
        else if (riskByInitiative.get(id) || String(it.status || '').toUpperCase() === 'BLOCKED')
          atRisk += 1;
        else onTrack += 1;
      }

      return {
        id: wsId,
        name: String(w.name || ''),
        status: String(w.status || 'ACTIVE'),
        ownerId: w.owner_id ? String(w.owner_id) : null,
        ownerName: w.owner_name ? String(w.owner_name) : null,
        initiativeCount: Number(w.initiative_count || 0),
        progressAvg: clampPercent(Number(w.avg_progress || 0)),
        onTrackCount: onTrack,
        atRiskCount: atRisk,
        delayedCount: delayed,
      };
    });
  }

  private buildRiskHeatmap(rows: any[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const r of rows || []) {
      const p = String(r.probability || 'UNKNOWN').toUpperCase();
      const i = String(r.impact || 'UNKNOWN').toUpperCase();
      const key = `${p}:${i}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }

  private buildTopRisks(rows: any[]): ExecutiveAggregateSnapshot['risks']['topRisks'] {
    const enriched = (rows || []).map((r: any) => {
      const score = riskLevelToScore(r.probability) * riskLevelToScore(r.impact);
      return {
        id: String(r.id),
        title: String(r.title || ''),
        probability: r.probability ? String(r.probability) : null,
        impact: r.impact ? String(r.impact) : null,
        score,
        ownerId: r.owner_id ? String(r.owner_id) : null,
        ownerName: r.owner_name ? String(r.owner_name) : null,
        initiativeId: r.initiative_id ? String(r.initiative_id) : null,
        initiativeName: r.initiative_name ? String(r.initiative_name) : null,
        status: r.status ? String(r.status) : null,
        dueDate: r.due_date ? String(r.due_date) : null,
        // POMIAR (1.1-E-1): kolumna wcześniej czytała `r.mitigation_status`, ale
        // migracja 063 nazwała kolumnę `mitigation_plan` — to pole było WIĘC
        // ZAWSZE `null` (ZNALEZISKO, nie naprawiane tu — poza zakresem tego
        // zlecenia, „Mitygacja" nie jest już kolumną kokpitu po DEC-426).
        mitigationStatus: r.mitigation_status ? String(r.mitigation_status) : null,
      };
    });
    enriched.sort((a, b) => b.score - a.score);
    return enriched.slice(0, 10);
  }

  private async getProjectRaidRisks(orgId: string, projectId: string): Promise<any[]> {
    return (
      (await DbPromise.all<any>(
        this.db,
        `
        SELECT r.*,
               i.name as initiative_name,
               u.first_name || ' ' || u.last_name as owner_name
        FROM raid_items r
        JOIN initiatives i ON i.id = r.initiative_id
        LEFT JOIN users u ON u.id = r.owner_id
        WHERE r.organization_id = ?
          AND i.project_id = ?
          AND r.type = 'RISK'
          AND COALESCE(r.status, 'OPEN') IN ('OPEN', 'IN_PROGRESS')
      `,
        [orgId, projectId]
      )) || []
    );
  }

  private async getKpiHighlights(
    orgId: string,
    projectId: string
  ): Promise<ExecutiveAggregateSnapshot['kpis']> {
    const rows = await DbPromise.all<any>(
      this.db,
      `
      SELECT ik.id, ik.name, ik.target_value, ik.unit,
             (SELECT value FROM kpi_time_series kts
              WHERE kts.kpi_id = ik.id AND kts.organization_id = ?
              ORDER BY kts.period_start DESC LIMIT 1) as current_value
      FROM initiative_kpis ik
      JOIN initiatives i ON i.id = ik.initiative_id
      WHERE i.project_id = ? AND i.organization_id = ?
      ORDER BY COALESCE(ik.is_primary, 0) DESC, COALESCE(ik.sort_order, 0) ASC
      LIMIT 4
    `,
      [orgId, projectId, orgId]
    ).catch(() => []);

    const highlights = (rows || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name || ''),
      currentValue:
        r.current_value === null || r.current_value === undefined ? null : Number(r.current_value),
      targetValue:
        r.target_value === null || r.target_value === undefined ? null : Number(r.target_value),
      unit: r.unit ? String(r.unit) : null,
    }));

    const dataQuality: 'none' | 'partial' | 'good' =
      highlights.length === 0
        ? 'none'
        : highlights.some((h) => h.currentValue === null)
          ? 'partial'
          : 'good';

    return { highlights, dataQuality };
  }

  /**
   * Module 06 Realizacja (Execution) rollout KPIs — surfaced in the executive
   * snapshot so ExecutionHub shows Rollout-tab KPI tracking alongside the
   * initiative KPIs. Scoped to the org and either the project or org-wide
   * (project_id IS NULL) rollout KPIs. Backed by rollout_kpis
   * (server/migrations/20260608_rollout_tables.sql).
   */
  private async getRolloutKpiHighlights(
    orgId: string,
    projectId: string
  ): Promise<ExecutiveAggregateSnapshot['kpis']['highlights']> {
    const rows = await DbPromise.all<any>(
      this.db,
      `
      SELECT id, name, current_value, target, unit
      FROM rollout_kpis
      WHERE organization_id = ? AND (project_id = ? OR project_id IS NULL)
      ORDER BY created_at ASC
      LIMIT 4
    `,
      [orgId, projectId]
    ).catch(() => []);

    return (rows || []).map((r: any) => ({
      id: `rollout_${String(r.id)}`,
      name: String(r.name || ''),
      currentValue:
        r.current_value === null || r.current_value === undefined ? null : Number(r.current_value),
      targetValue: r.target === null || r.target === undefined ? null : Number(r.target),
      unit: r.unit ? String(r.unit) : null,
    }));
  }

  private async getRoiPortfolioSummary(orgId: string): Promise<ExecutiveAggregateSnapshot['roi']> {
    const assumptions = await DbPromise.all<any>(
      this.db,
      `
      SELECT ra.*, i.name as initiative_name
      FROM roi_assumptions ra
      JOIN initiatives i ON i.id = ra.initiative_id
      WHERE ra.organization_id = ?
    `,
      [orgId]
    ).catch(() => []);

    if (!assumptions || assumptions.length === 0) {
      return { summary: null, items: [] };
    }

    const realized = await DbPromise.all<any>(
      this.db,
      `
      SELECT initiative_id,
             SUM(COALESCE(realized_revenue_delta,0)) as total_rev,
             SUM(COALESCE(realized_cost_delta,0)) as total_cost,
             SUM(COALESCE(realized_savings,0)) as total_savings,
             COUNT(*)::int as data_points
      FROM roi_realized_values
      WHERE organization_id = ?
      GROUP BY initiative_id
    `,
      [orgId]
    ).catch(() => []);

    const realizedMap: Record<string, any> = {};
    for (const r of realized || []) {
      realizedMap[String(r.initiative_id)] = r;
    }

    const items = (assumptions || []).map((a: any) => {
      const r = realizedMap[String(a.initiative_id)];
      const projectedBenefit =
        Number(a.expected_revenue_delta || 0) + Number(a.expected_cost_delta || 0);
      const realizedBenefit = r
        ? Number(r.total_rev || 0) + Number(r.total_cost || 0) + Number(r.total_savings || 0)
        : 0;
      return {
        initiativeId: String(a.initiative_id),
        initiativeName: String(a.initiative_name || ''),
        projectedBenefit,
        realizedBenefit,
        variance: realizedBenefit - projectedBenefit,
        confidence: a.confidence ? String(a.confidence) : null,
        hasRealized: Boolean(r),
      };
    });

    const totalProjected = items.reduce((s, i) => s + i.projectedBenefit, 0);
    const totalRealized = items.reduce((s, i) => s + i.realizedBenefit, 0);
    const coveragePercent =
      items.length > 0
        ? Math.round((items.filter((i) => i.hasRealized).length / items.length) * 100)
        : 0;

    return {
      summary: {
        totalProjected,
        totalRealized,
        totalVariance: totalRealized - totalProjected,
        coveragePercent,
        initiativeCount: items.length,
      },
      items,
    };
  }
}

export const executiveAggregateService = new ExecutiveAggregateService();
