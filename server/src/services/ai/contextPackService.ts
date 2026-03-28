import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { aiLogger } from './logger.js';

export interface ContextArtifact {
  artifactType: string;
  artifactId: string;
  title: string;
  dataSnapshot: unknown;
}

export interface VersionedContextPack {
  id: string;
  organizationId: string;
  version: number;
  intent: string;
  artifacts: ContextArtifact[];
  metadata: {
    createdAt: string;
    expiresAt: string;
    tokenEstimate: number;
  };
}

const CONTEXT_QUERIES: Record<string, { sql: string; type: string }> = {
  tasks: {
    sql: `SELECT id, title, status, priority, assigned_to, due_date
          FROM tasks WHERE organization_id = ? AND status != 'deleted'
          ORDER BY updated_at DESC LIMIT 50`,
    type: 'task',
  },
  initiatives: {
    sql: `SELECT id, title, status, priority, owner_id
          FROM initiatives WHERE organization_id = ?
          ORDER BY updated_at DESC LIMIT 30`,
    type: 'initiative',
  },
  decisions: {
    sql: `SELECT id, title, status, decision_date
          FROM decisions WHERE organization_id = ?
          ORDER BY updated_at DESC LIMIT 30`,
    type: 'decision',
  },
  risks: {
    sql: `SELECT id, title, severity, probability, status
          FROM risks WHERE organization_id = ?
          ORDER BY updated_at DESC LIMIT 30`,
    type: 'risk',
  },
  kpis: {
    sql: `SELECT id, name, current_value, target_value, unit
          FROM kpis WHERE organization_id = ?
          ORDER BY updated_at DESC LIMIT 30`,
    type: 'kpi',
  },
  milestones: {
    sql: `SELECT id, title, due_date, status
          FROM milestones WHERE organization_id = ?
          ORDER BY due_date ASC LIMIT 30`,
    type: 'milestone',
  },
  knowledge: {
    sql: `SELECT id, title, content_preview
          FROM knowledge_items WHERE organization_id = ?
          ORDER BY updated_at DESC LIMIT 20`,
    type: 'knowledge',
  },
};

function estimateTokens(obj: unknown): number {
  const json = JSON.stringify(obj);
  return Math.ceil(json.length / 4);
}

export async function buildContextForIntent(
  orgId: string,
  intent: string,
  requiredContext: string[],
  artifactIds?: string[]
): Promise<VersionedContextPack> {
  const startMs = Date.now();
  const artifacts: ContextArtifact[] = [];

  for (const ctxType of requiredContext) {
    const queryDef = CONTEXT_QUERIES[ctxType];
    if (!queryDef) continue;

    try {
      const rows = await dbAll(queryDef.sql, [orgId], { fallback: true });
      for (const row of rows || []) {
        const r = row as any;
        artifacts.push({
          artifactType: queryDef.type,
          artifactId: r.id || '',
          title: r.title || r.name || '',
          dataSnapshot: r,
        });
      }
    } catch (err: any) {
      aiLogger.warn('ContextPackService', `Failed to query ${ctxType}: ${err?.message}`);
    }
  }

  if (artifactIds && artifactIds.length > 0) {
    for (const id of artifactIds) {
      const alreadyIncluded = artifacts.some((a) => a.artifactId === id);
      if (!alreadyIncluded) {
        artifacts.push({
          artifactType: 'referenced',
          artifactId: id,
          title: '',
          dataSnapshot: null,
        });
      }
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const pack: VersionedContextPack = {
    id: uuidv4(),
    organizationId: orgId,
    version: 1,
    intent,
    artifacts,
    metadata: {
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      tokenEstimate: estimateTokens(artifacts),
    },
  };

  aiLogger.info(
    'ContextPackService',
    `Built context pack: ${artifacts.length} artifacts, ~${pack.metadata.tokenEstimate} tokens, ${Date.now() - startMs}ms`
  );

  return pack;
}

export async function saveContextSnapshot(
  pack: VersionedContextPack,
  conversationId?: string
): Promise<string> {
  await dbRun(
    `INSERT INTO ai_context_snapshots
      (id, organization_id, conversation_id, version, intent, artifacts_json, token_estimate, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pack.id,
      pack.organizationId,
      conversationId || null,
      pack.version,
      pack.intent,
      JSON.stringify(pack.artifacts),
      pack.metadata.tokenEstimate,
      pack.metadata.createdAt,
      pack.metadata.expiresAt,
    ]
  );

  aiLogger.info('ContextPackService', `Saved snapshot ${pack.id}`);
  return pack.id;
}

export async function getContextSnapshot(snapshotId: string): Promise<VersionedContextPack | null> {
  const row = await dbGet<{
    id: string;
    organization_id: string;
    version: number;
    intent: string;
    artifacts_json: string;
    token_estimate: number;
    created_at: string;
    expires_at: string;
  }>(
    `SELECT id, organization_id, version, intent, artifacts_json, token_estimate, created_at, expires_at
     FROM ai_context_snapshots WHERE id = ?`,
    [snapshotId],
    { fallback: true }
  );

  if (!row) return null;

  let artifacts: ContextArtifact[] = [];
  try {
    artifacts = JSON.parse(row.artifacts_json);
  } catch {
    aiLogger.warn('ContextPackService', `Failed to parse artifacts for snapshot ${snapshotId}`);
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    version: row.version,
    intent: row.intent,
    artifacts,
    metadata: {
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      tokenEstimate: row.token_estimate,
    },
  };
}
