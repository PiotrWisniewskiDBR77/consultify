import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { canWriteMemory, getUserPrivacySettings } from './ai/userPrivacyService.js';

export type Wave6SnapshotType = 'org' | 'project' | 'user';
export type Wave6AssistantScope = 'anna_public' | 'teresa_tenant';
export type Wave6MemoryScope = 'public_product' | 'tenant' | 'user' | 'project';
export type Wave6MemoryStatus =
  | 'captured'
  | 'candidate'
  | 'approved'
  | 'rejected'
  | 'retained'
  | 'applied'
  | 'expired';

export interface CaptureWave6ContextSnapshotInput {
  organizationId: string;
  userId: string;
  snapshotType: Wave6SnapshotType;
  projectId?: string | null;
  facts: Record<string, unknown>;
  sourceRefs?: unknown[];
  permissions?: Record<string, unknown>;
  freshnessAt?: string | null;
  privateMode?: boolean;
}

export interface CaptureWave6MemoryCandidateInput {
  organizationId: string;
  userId: string;
  assistantScope: Wave6AssistantScope;
  memoryScope: Wave6MemoryScope;
  key: string;
  value: string;
  projectId?: string | null;
  sourceLabel?: string | null;
  sourceRefs?: unknown[];
  privateMode?: boolean;
  retentionDays?: number | null;
}

export interface DecideWave6MemoryCandidateInput {
  organizationId: string;
  userId: string;
  candidateId: string;
  decision: 'approve' | 'reject' | 'apply' | 'expire';
  reason?: string | null;
}

export interface Wave6UserWorkProfile {
  userId: string;
  organizationId: string;
  projectId: string | null;
  preferences: Array<{ key: string; value: string; sourceLabel: string | null; status: string }>;
  sourceLabel: 'wave6_memory_stewardship';
}

let schemaReady: Promise<void> | null = null;

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function retentionUntil(days?: number | null): string | null {
  if (!days || days <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function mapSnapshot(row: any): any {
  if (!row) return null;
  return {
    snapshotId: row.snapshot_id,
    organizationId: row.organization_id,
    projectId: row.project_id || null,
    userId: row.user_id,
    snapshotType: row.snapshot_type,
    facts: safeJsonParse(row.facts_json, {}),
    sourceRefs: safeJsonParse(row.source_refs_json, []),
    permissions: safeJsonParse(row.permissions_json, {}),
    freshnessAt: row.freshness_at || null,
    privateMode: Number(row.private_mode || 0) === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at || null,
  };
}

function mapLedger(row: any): any {
  if (!row) return null;
  return {
    ledgerId: row.ledger_id,
    organizationId: row.organization_id,
    projectId: row.project_id || null,
    userId: row.user_id,
    sourceType: row.source_type,
    sourceId: row.source_id || null,
    sourceTitle: row.source_title || null,
    sourceUrl: row.source_url || null,
    freshnessAt: row.freshness_at || null,
    permissionScope: row.permission_scope || 'tenant',
    forgottenAt: row.forgotten_at || null,
    createdAt: row.created_at,
  };
}

function mapCandidate(row: any): any {
  if (!row) return null;
  return {
    candidateId: row.candidate_id,
    organizationId: row.organization_id,
    projectId: row.project_id || null,
    userId: row.user_id,
    assistantScope: row.assistant_scope,
    memoryScope: row.memory_scope,
    status: row.status,
    key: row.memory_key,
    value: row.memory_value,
    sourceLabel: row.source_label || null,
    sourceRefs: safeJsonParse(row.source_refs_json, []),
    consentRequired: Number(row.consent_required || 1) === 1,
    privateMode: Number(row.private_mode || 0) === 1,
    retentionUntil: row.retention_until || null,
    decisionReason: row.decision_reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isRetainedMemoryStatus(status: string): boolean {
  return status === 'retained' || status === 'applied';
}

export async function ensureWave6ContextLearningSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave6_context_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        user_id TEXT NOT NULL,
        snapshot_type TEXT NOT NULL,
        facts_json TEXT NOT NULL DEFAULT '{}',
        source_refs_json TEXT NOT NULL DEFAULT '[]',
        permissions_json TEXT NOT NULL DEFAULT '{}',
        freshness_at TEXT,
        private_mode INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave6_context_ledger (
        ledger_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        user_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT,
        source_title TEXT,
        source_url TEXT,
        freshness_at TEXT,
        permission_scope TEXT NOT NULL DEFAULT 'tenant',
        forgotten_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave6_memory_candidates (
        candidate_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        user_id TEXT NOT NULL,
        assistant_scope TEXT NOT NULL,
        memory_scope TEXT NOT NULL,
        status TEXT NOT NULL,
        memory_key TEXT NOT NULL,
        memory_value TEXT NOT NULL,
        source_label TEXT,
        source_refs_json TEXT NOT NULL DEFAULT '[]',
        consent_required INTEGER NOT NULL DEFAULT 1,
        private_mode INTEGER NOT NULL DEFAULT 0,
        retention_until TEXT,
        decision_reason TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave6_memory_stewardship_decisions (
        decision_id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave6_snapshots_org_project ON wave6_context_snapshots(organization_id, project_id, created_at)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave6_memory_queue ON wave6_memory_candidates(organization_id, status, created_at)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export async function captureWave6ContextSnapshot(
  input: CaptureWave6ContextSnapshotInput
): Promise<any> {
  await ensureWave6ContextLearningSchema();
  const snapshotId = `ctx6-${uuidv4()}`;
  const expiresAt = input.privateMode ? retentionUntil(1) : null;
  await dbRun(
    `INSERT INTO wave6_context_snapshots (
      snapshot_id, organization_id, project_id, user_id, snapshot_type, facts_json,
      source_refs_json, permissions_json, freshness_at, private_mode, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshotId,
      input.organizationId,
      input.projectId || null,
      input.userId,
      input.snapshotType,
      safeJsonStringify(input.facts || {}),
      safeJsonStringify(input.sourceRefs || []),
      safeJsonStringify(input.permissions || {}),
      input.freshnessAt || new Date().toISOString(),
      input.privateMode ? 1 : 0,
      expiresAt,
    ]
  );
  const row = await dbGet(`SELECT * FROM wave6_context_snapshots WHERE snapshot_id = ?`, [
    snapshotId,
  ]);
  return mapSnapshot(row);
}

export async function recordWave6ContextLedgerEntry(params: {
  organizationId: string;
  userId: string;
  projectId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  freshnessAt?: string | null;
  permissionScope?: string | null;
}): Promise<any> {
  await ensureWave6ContextLearningSchema();
  const ledgerId = `ctx-ledger-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave6_context_ledger (
      ledger_id, organization_id, project_id, user_id, source_type, source_id,
      source_title, source_url, freshness_at, permission_scope
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ledgerId,
      params.organizationId,
      params.projectId || null,
      params.userId,
      params.sourceType,
      params.sourceId || null,
      params.sourceTitle || null,
      params.sourceUrl || null,
      params.freshnessAt || new Date().toISOString(),
      params.permissionScope || 'tenant',
    ]
  );
  const row = await dbGet(`SELECT * FROM wave6_context_ledger WHERE ledger_id = ?`, [ledgerId]);
  return mapLedger(row);
}

export async function listWave6ContextPanel(params: {
  organizationId: string;
  userId: string;
  projectId?: string | null;
}): Promise<any> {
  await ensureWave6ContextLearningSchema();
  const projectFilter = params.projectId ? `AND (project_id IS NULL OR project_id = ?)` : '';
  const values = params.projectId
    ? [params.organizationId, params.userId, params.projectId]
    : [params.organizationId, params.userId];
  const snapshots = await dbAll(
    `SELECT * FROM wave6_context_snapshots
     WHERE organization_id = ? AND user_id = ? ${projectFilter}
     ORDER BY created_at DESC LIMIT 25`,
    values
  );
  const ledger = await dbAll(
    `SELECT * FROM wave6_context_ledger
     WHERE organization_id = ? AND user_id = ? ${projectFilter} AND forgotten_at IS NULL
     ORDER BY created_at DESC LIMIT 50`,
    values
  );
  const memories = await dbAll(
    `SELECT * FROM wave6_memory_candidates
     WHERE organization_id = ? AND user_id = ? ${projectFilter}
     ORDER BY created_at DESC LIMIT 50`,
    values
  );
  return {
    organizationId: params.organizationId,
    userId: params.userId,
    projectId: params.projectId || null,
    snapshots: (snapshots || []).map(mapSnapshot),
    ledger: (ledger || []).map(mapLedger),
    memories: (memories || []).map(mapCandidate),
  };
}

export async function buildWave6UserWorkProfile(params: {
  organizationId: string;
  userId: string;
  projectId?: string | null;
  privateMode?: boolean;
}): Promise<Wave6UserWorkProfile> {
  await ensureWave6ContextLearningSchema();
  if (params.privateMode) {
    return {
      userId: params.userId,
      organizationId: params.organizationId,
      projectId: params.projectId || null,
      preferences: [],
      sourceLabel: 'wave6_memory_stewardship',
    };
  }
  const projectFilter = params.projectId ? `AND (project_id IS NULL OR project_id = ?)` : '';
  const values = params.projectId
    ? [params.organizationId, params.userId, params.projectId]
    : [params.organizationId, params.userId];
  const rows = await dbAll(
    `SELECT * FROM wave6_memory_candidates
     WHERE organization_id = ? AND user_id = ? ${projectFilter}
       AND status IN ('retained', 'applied')
     ORDER BY updated_at DESC LIMIT 20`,
    values
  );
  return {
    userId: params.userId,
    organizationId: params.organizationId,
    projectId: params.projectId || null,
    preferences: (rows || []).map((row: any) => ({
      key: row.memory_key,
      value: row.memory_value,
      sourceLabel: row.source_label || null,
      status: row.status,
    })),
    sourceLabel: 'wave6_memory_stewardship',
  };
}

export function buildWave6UserWorkProfilePrompt(profile: Wave6UserWorkProfile): string {
  const retained = profile.preferences.filter((memory) => isRetainedMemoryStatus(memory.status));
  if (retained.length === 0) return '';
  return [
    '## USER WORK PROFILE (Wave 6 approved memory)',
    '- Use only these approved memories. Each item has a source label.',
    '- Do not infer new memories from this answer. New memories require stewardship approval.',
    ...retained.map(
      (memory) =>
        `- ${memory.key}: ${memory.value} (source: ${memory.sourceLabel || profile.sourceLabel})`
    ),
  ].join('\n');
}

export function extractWave6MemoryRequest(message: string): { key: string; value: string } | null {
  const raw = String(message || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const triggers = ['remember', 'zapamiętaj', 'zapamietaj', 'save this preference'];
  if (!triggers.some((trigger) => lower.includes(trigger))) return null;
  const cleaned = raw
    .replace(/^(please\s+)?remember[:\s-]*/i, '')
    .replace(/^zapami[eę]taj[:\s-]*/i, '')
    .trim();
  return {
    key: 'user_requested_memory',
    value: cleaned || raw,
  };
}

export async function captureWave6MemoryCandidate(
  input: CaptureWave6MemoryCandidateInput
): Promise<any> {
  await ensureWave6ContextLearningSchema();
  if (input.privateMode) {
    return {
      blocked: true,
      reason: 'private_mode_blocks_learning',
      candidate: null,
    };
  }
  if (input.assistantScope === 'anna_public' && input.memoryScope !== 'public_product') {
    return {
      blocked: true,
      reason: 'anna_cannot_learn_tenant_or_user_data',
      candidate: null,
    };
  }
  if (input.assistantScope === 'teresa_tenant' && input.memoryScope === 'public_product') {
    return {
      blocked: true,
      reason: 'teresa_memory_must_stay_in_tenant_scope',
      candidate: null,
    };
  }
  const candidateId = `mem6-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave6_memory_candidates (
      candidate_id, organization_id, project_id, user_id, assistant_scope, memory_scope,
      status, memory_key, memory_value, source_label, source_refs_json, consent_required,
      private_mode, retention_until
    ) VALUES (?, ?, ?, ?, ?, ?, 'candidate', ?, ?, ?, ?, 1, 0, ?)`,
    [
      candidateId,
      input.organizationId,
      input.projectId || null,
      input.userId,
      input.assistantScope,
      input.memoryScope,
      input.key,
      input.value,
      input.sourceLabel || 'user_requested_memory',
      safeJsonStringify(input.sourceRefs || []),
      retentionUntil(input.retentionDays || null),
    ]
  );
  const row = await dbGet(`SELECT * FROM wave6_memory_candidates WHERE candidate_id = ?`, [
    candidateId,
  ]);
  return { blocked: false, candidate: mapCandidate(row) };
}

export async function decideWave6MemoryCandidate(
  input: DecideWave6MemoryCandidateInput
): Promise<any> {
  await ensureWave6ContextLearningSchema();
  const row = await dbGet(
    `SELECT * FROM wave6_memory_candidates WHERE candidate_id = ? AND organization_id = ?`,
    [input.candidateId, input.organizationId]
  );
  const candidate = mapCandidate(row);
  if (!candidate) throw new Error('Memory candidate not found');
  let status: Wave6MemoryStatus = 'rejected';
  if (input.decision === 'approve') status = 'retained';
  if (input.decision === 'apply') status = 'applied';
  if (input.decision === 'expire') status = 'expired';
  if (status === 'retained' || status === 'applied') {
    const privacy = await getUserPrivacySettings(candidate.userId);
    if (!canWriteMemory(privacy, false)) {
      throw new Error('Memory writes are disabled by privacy settings');
    }
    await dbRun(
      `INSERT INTO ai_user_memory (id, user_id, organization_id, key, value, source, confidence, context, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'wave6_stewardship', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, key) DO UPDATE SET
         value = excluded.value,
         source = excluded.source,
         confidence = excluded.confidence,
         context = excluded.context,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `ai-memory-${uuidv4()}`,
        candidate.userId,
        candidate.organizationId,
        candidate.key,
        candidate.value,
        safeJsonStringify({
          sourceLabel: candidate.sourceLabel,
          assistantScope: candidate.assistantScope,
          memoryScope: candidate.memoryScope,
          candidateId: candidate.candidateId,
        }),
      ]
    );
  }
  await dbRun(
    `UPDATE wave6_memory_candidates
     SET status = ?, decision_reason = ?, updated_at = CURRENT_TIMESTAMP
     WHERE candidate_id = ? AND organization_id = ?`,
    [status, input.reason || null, input.candidateId, input.organizationId]
  );
  await dbRun(
    `INSERT INTO wave6_memory_stewardship_decisions (
      decision_id, candidate_id, organization_id, actor_user_id, decision, reason
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `mem6-decision-${uuidv4()}`,
      input.candidateId,
      input.organizationId,
      input.userId,
      input.decision,
      input.reason || null,
    ]
  );
  const updated = await dbGet(
    `SELECT * FROM wave6_memory_candidates WHERE candidate_id = ? AND organization_id = ?`,
    [input.candidateId, input.organizationId]
  );
  return mapCandidate(updated);
}

export async function forgetWave6ContextLedgerEntry(params: {
  organizationId: string;
  userId: string;
  ledgerId: string;
}): Promise<{ success: true }> {
  await ensureWave6ContextLearningSchema();
  await dbRun(
    `UPDATE wave6_context_ledger
     SET forgotten_at = CURRENT_TIMESTAMP
     WHERE ledger_id = ? AND organization_id = ? AND user_id = ?`,
    [params.ledgerId, params.organizationId, params.userId]
  );
  return { success: true };
}
