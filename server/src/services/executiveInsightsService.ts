import { z } from 'zod';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { llmService } from './ai/llmService.js';

export type ExecutiveInsightType = 'OVERVIEW_PARAGRAPH' | 'RECOMMENDED_ACTIONS';

export interface ExecutiveInsightsPayload {
  paragraph: string;
  recommendedActions: Array<{
    title: string;
    rationale: string;
    ownerHint?: string;
    urgency: 'low' | 'medium' | 'high';
  }>;
  warnings: string[];
}

const RecommendedActionsSchema = z.object({
  paragraph: z.string().min(1),
  recommendedActions: z
    .array(
      z.object({
        title: z.string().min(1),
        rationale: z.string().min(1),
        ownerHint: z.string().optional(),
        urgency: z.enum(['low', 'medium', 'high']),
      })
    )
    .min(0)
    .max(5),
  warnings: z.array(z.string()).max(10).default([]),
});

function cacheKey(params: {
  organizationId: string;
  projectId: string;
  type: ExecutiveInsightType;
  period: string;
}): string {
  return `${params.organizationId}:${params.projectId}:${params.type}:${params.period}`;
}

export class ExecutiveInsightsService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  async ensureSchema(): Promise<void> {
    try {
      await DbPromise.run(
        this.db,
        `
        CREATE TABLE IF NOT EXISTS executive_insights_cache (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          insight_type TEXT NOT NULL,
          period TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          model_id TEXT,
          generated_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          UNIQUE(organization_id, project_id, insight_type, period)
        )
      `,
        []
      );
      await DbPromise.run(
        this.db,
        `CREATE INDEX IF NOT EXISTS idx_exec_insights_cache_lookup ON executive_insights_cache(organization_id, project_id, insight_type, period)`,
        []
      );
      await DbPromise.run(
        this.db,
        `CREATE INDEX IF NOT EXISTS idx_exec_insights_cache_exp ON executive_insights_cache(expires_at)`,
        []
      );
    } catch (e: any) {
      logger.warn('[ExecutiveInsightsService] ensureSchema failed:', e?.message || e);
    }
  }

  async getCached(params: {
    organizationId: string;
    projectId: string;
    type: ExecutiveInsightType;
    period: string;
  }): Promise<ExecutiveInsightsPayload | null> {
    await this.ensureSchema();
    const row = await DbPromise.get<any>(
      this.db,
      `
      SELECT payload_json, expires_at
      FROM executive_insights_cache
      WHERE organization_id = ? AND project_id = ? AND insight_type = ? AND period = ?
      LIMIT 1
    `,
      [params.organizationId, params.projectId, params.type, params.period]
    );
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
    try {
      const parsed = JSON.parse(row.payload_json || '{}');
      const validated = RecommendedActionsSchema.safeParse(parsed);
      return validated.success ? (validated.data as ExecutiveInsightsPayload) : null;
    } catch {
      return null;
    }
  }

  async upsertCache(params: {
    organizationId: string;
    projectId: string;
    type: ExecutiveInsightType;
    period: string;
    payload: ExecutiveInsightsPayload;
    ttlSeconds: number;
    modelId?: string;
    generatedBy?: string;
  }): Promise<void> {
    await this.ensureSchema();
    const id = cacheKey(params);
    const expiresAt = new Date(Date.now() + Math.max(60, params.ttlSeconds) * 1000).toISOString();
    await DbPromise.run(
      this.db,
      `
      INSERT INTO executive_insights_cache (id, organization_id, project_id, insight_type, period, payload_json, model_id, generated_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, project_id, insight_type, period) DO UPDATE SET
        payload_json = excluded.payload_json,
        model_id = excluded.model_id,
        generated_by = excluded.generated_by,
        expires_at = excluded.expires_at
    `,
      [
        id,
        params.organizationId,
        params.projectId,
        params.type,
        params.period,
        JSON.stringify(params.payload),
        params.modelId || null,
        params.generatedBy || null,
        expiresAt,
      ]
    );
  }

  async generateInsights(params: {
    organizationId: string;
    projectId: string;
    period: string;
    context: {
      projectName?: string;
      phase?: string;
      progressPercent?: number;
      pmoBlockers?: Array<{ type: string; message: string }>;
      risks?: Array<{ title: string; severity?: string; type?: string }>;
      delaySignals?: Array<{
        entityName: string;
        deviationType: string;
        severity: string;
        daysDeviation: number;
      }>;
      overspendSignals?: Array<{ signalType: string; severity: string; message?: string }>;
      kpiHighlights?: Array<{ name: string; current?: number; target?: number; unit?: string }>;
      roiSummary?: {
        totalProjected?: number;
        totalRealized?: number;
        coveragePercent?: number;
        totalVariance?: number;
      };
    };
    ttlSeconds?: number;
    modelId?: string;
    generatedBy?: string;
  }): Promise<ExecutiveInsightsPayload> {
    await this.ensureSchema();

    const cached = await this.getCached({
      organizationId: params.organizationId,
      projectId: params.projectId,
      type: 'RECOMMENDED_ACTIONS',
      period: params.period,
    });
    if (cached) return cached;

    const sys = `You are an executive PMO advisor. Write a concise executive paragraph and 3 recommended actions.
Rules:
- Be honest about uncertainty; never invent numbers.
- Use only facts provided in CONTEXT.
- Keep the paragraph max 80 words.
- Recommended actions must be specific and feasible within 7 days.
- Output must match the JSON schema.`;

    const user = `CONTEXT (JSON):
${JSON.stringify(params.context, null, 2)}
`;

    try {
      const response = await llmService.call({
        type: 'structured',
        modelConfig: { id: params.modelId || 'default' },
        systemPrompt: sys,
        messages: [{ role: 'user', content: user }],
        schema: RecommendedActionsSchema,
        cache: true,
        cacheTtl: 3600,
      });

      const obj = (response as any)?.object;
      const validated = RecommendedActionsSchema.safeParse(obj);
      const payload: ExecutiveInsightsPayload = validated.success
        ? (validated.data as any)
        : {
            paragraph: 'AI insights unavailable.',
            recommendedActions: [],
            warnings: ['LLM returned invalid schema'],
          };

      await this.upsertCache({
        organizationId: params.organizationId,
        projectId: params.projectId,
        type: 'RECOMMENDED_ACTIONS',
        period: params.period,
        payload,
        ttlSeconds: params.ttlSeconds || 6 * 3600,
        modelId: params.modelId,
        generatedBy: params.generatedBy,
      });

      return payload;
    } catch (e: any) {
      logger.warn('[ExecutiveInsightsService] LLM generation failed:', e?.message || e);
      const payload: ExecutiveInsightsPayload = {
        paragraph: 'AI insights unavailable.',
        recommendedActions: [],
        warnings: ['AI service unavailable'],
      };
      await this.upsertCache({
        organizationId: params.organizationId,
        projectId: params.projectId,
        type: 'RECOMMENDED_ACTIONS',
        period: params.period,
        payload,
        ttlSeconds: Math.max(600, params.ttlSeconds || 3600),
        modelId: params.modelId,
        generatedBy: params.generatedBy,
      });
      return payload;
    }
  }
}

export const executiveInsightsService = new ExecutiveInsightsService();
