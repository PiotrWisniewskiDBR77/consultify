import crypto from 'crypto';
import { ZodError } from 'zod';

import {
  runOnboardingPersonaPipeline,
  unsafeOnboardingPersonaPipelineRunId,
} from '../../../models/v10/pipelines/OnboardingPersonaPipeline.js';
import type {
  OnboardingKpiMetricKey,
  OnboardingKpiMetricValue,
  OnboardingKpiRow,
  OnboardingKpiSummaryResponse,
  OnboardingPersonaRequest,
  OnboardingPersonaResponse,
  OnboardingResumeRequest,
  OnboardingResumeResponse,
  OnboardingSessionSnapshot,
  OnboardingSnapshotSaveRequest,
  OnboardingSnapshotSaveResponse,
  OnboardingTelemetryEventRequest,
  OnboardingTelemetryEventResponse,
  OnboardingTelemetryProps,
} from '../../../types/v10/onboarding-runtime.js';
import {
  OnboardingPersonaRequestSchema,
  OnboardingResumeRequestSchema,
  OnboardingSnapshotSaveRequestSchema,
  OnboardingTelemetryEventRequestSchema,
} from '../../../types/v10/onboarding-runtime.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../../utils/DbPromise.js';

type OnboardingStatus =
  | 'in_progress'
  | 'paused'
  | 'abandoned'
  | 'completed'
  | 'resumed'
  | 'expired';

type StoredSessionRow = {
  onboardingId: string;
  tenantId: string;
  userId: string;
  persona: string | null;
  personaConfidence: string | null;
  status: OnboardingStatus;
  currentStep: string | null;
  resumeToken: string;
  resumeExpiresAt: string;
  snapshot: OnboardingSessionSnapshot | null;
  startedAt: string;
  lastEventAt: string | null;
  lastSnapshotAt: string | null;
  abandonedAt: string | null;
  activationReachedAt: string | null;
};

type StoredEventRow = {
  id: string;
  tenantId: string;
  onboardingId: string;
  eventName: string;
  recordedAt: string;
  props: OnboardingTelemetryProps;
};

type PersonaTargetMatrix = Record<OnboardingKpiMetricKey, number>;

const KPI_TARGETS: Record<string, PersonaTargetMatrix> = {
  overall: {
    activation_rate: 40,
    median_time_to_first_artifact: 240,
    connector_attach_rate_at_aha: 50,
    first_artifact_approved_rate: 35,
  },
  Partner: {
    activation_rate: 45,
    median_time_to_first_artifact: 210,
    connector_attach_rate_at_aha: 50,
    first_artifact_approved_rate: 40,
  },
  CFO: {
    activation_rate: 55,
    median_time_to_first_artifact: 180,
    connector_attach_rate_at_aha: 60,
    first_artifact_approved_rate: 45,
  },
  CEO: {
    activation_rate: 35,
    median_time_to_first_artifact: 240,
    connector_attach_rate_at_aha: 40,
    first_artifact_approved_rate: 30,
  },
  COO: {
    activation_rate: 42,
    median_time_to_first_artifact: 240,
    connector_attach_rate_at_aha: 55,
    first_artifact_approved_rate: 38,
  },
  CISO: {
    activation_rate: 30,
    median_time_to_first_artifact: 300,
    connector_attach_rate_at_aha: 30,
    first_artifact_approved_rate: 35,
  },
  Transformation: {
    activation_rate: 45,
    median_time_to_first_artifact: 240,
    connector_attach_rate_at_aha: 50,
    first_artifact_approved_rate: 40,
  },
  unknown: {
    activation_rate: 40,
    median_time_to_first_artifact: 240,
    connector_attach_rate_at_aha: 50,
    first_artifact_approved_rate: 35,
  },
};

let ensureOnboardingRuntimeTablesPromise: Promise<void> | null = null;

function plusDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function parseJson<T>(raw: unknown): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

function normalizePersona(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  const lowered = raw.toLowerCase();
  if (lowered === 'transformation officer') return 'Transformation';
  if (lowered === 'consultant') return 'Transformation';
  if (lowered === 'partner') return 'Partner';
  if (lowered === 'cfo') return 'CFO';
  if (lowered === 'ceo') return 'CEO';
  if (lowered === 'coo') return 'COO';
  if (lowered === 'ciso') return 'CISO';
  if (lowered === 'transformation') return 'Transformation';
  return raw;
}

function defaultTelemetryProps(args: {
  persona: string;
  sourceType?: string;
  trustMode?: string;
  residencyRegion?: string;
  approvalRequired?: boolean;
}): OnboardingTelemetryProps {
  return {
    persona: normalizePersona(args.persona),
    sourceType: args.sourceType?.trim() || 'unknown',
    dataClassification: 'internal',
    trustMode: args.trustMode?.trim() || 'guardrailed',
    residencyRegion: args.residencyRegion?.trim() || 'unknown',
    secondsSinceStart: 0,
    artifactType: 'unknown',
    citationCount: 0,
    validationStatus: 'pending',
    approvalRequired: Boolean(args.approvalRequired),
    ahaReached: false,
  };
}

function defaultSnapshot(args: {
  persona: string;
  personaConfidence?: string | null;
}): OnboardingSessionSnapshot {
  return {
    persona: normalizePersona(args.persona),
    personaConfidence:
      args.personaConfidence === 'low' ||
      args.personaConfidence === 'medium' ||
      args.personaConfidence === 'high'
        ? args.personaConfidence
        : null,
    overrideHistory: [],
    connectorTarget: null,
    connectorScopes: [],
    uploadedFiles: [],
    currentDraft: null,
    approvalHistory: [],
    trustBanner: {
      viewedAt: null,
      acknowledged: false,
    },
    unresolvedValidationBlockers: [],
    currentStep: 'persona_capture',
    deltaHint: null,
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] || 0;
  return ((sorted[middle - 1] || 0) + (sorted[middle] || 0)) / 2;
}

function metricStatus(
  actual: number,
  target: number,
  lowerIsBetter = false
): 'green' | 'amber' | 'red' {
  if (lowerIsBetter) {
    if (actual <= target) return 'green';
    if (actual <= target * 1.1) return 'amber';
    return 'red';
  }
  if (actual >= target) return 'green';
  if (actual >= target * 0.9) return 'amber';
  return 'red';
}

function buildMetricValue(
  key: OnboardingKpiMetricKey,
  actual: number,
  target: number
): OnboardingKpiMetricValue {
  const lowerIsBetter = key === 'median_time_to_first_artifact';
  return {
    actual: Number(actual.toFixed(2)),
    target,
    status: metricStatus(actual, target, lowerIsBetter),
  };
}

function extractSourceHashes(snapshot: OnboardingSessionSnapshot | null): Record<string, string> {
  const entries = Array.isArray(snapshot?.uploadedFiles) ? snapshot.uploadedFiles : [];
  return Object.fromEntries(entries.map((file) => [String(file.id), String(file.hash)]));
}

function requireScope(
  scope: { tenantId?: string; userId?: string; userRole?: string | null } | undefined
): { tenantId: string; userId: string; userRole: string | null } {
  const tenantId = String(scope?.tenantId || '').trim();
  const userId = String(scope?.userId || '').trim();
  if (!tenantId || !userId) {
    throw new OnboardingRuntimeInputError(
      'ONBOARDING_RUNTIME_SCOPE_REQUIRED',
      'tenantId and userId are required',
      422
    );
  }
  return {
    tenantId,
    userId,
    userRole: scope?.userRole ? String(scope.userRole) : null,
  };
}

export class OnboardingRuntimeInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'OnboardingRuntimeInputError';
    this.code = code;
    this.status = status;
  }
}

export function mapOnboardingRuntimeError(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof OnboardingRuntimeInputError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  if (error instanceof ZodError) {
    return {
      status: 422,
      body: {
        error: error.issues.map((issue) => issue.message).join('; '),
        code: 'ONBOARDING_RUNTIME_VALIDATION_ERROR',
      },
    };
  }
  return {
    status: 500,
    body: {
      error: error instanceof Error ? error.message : 'Onboarding runtime request failed',
      code: 'ONBOARDING_RUNTIME_REQUEST_FAILED',
    },
  };
}

export async function ensureOnboardingRuntimeTables(): Promise<void> {
  if (!ensureOnboardingRuntimeTablesPromise) {
    ensureOnboardingRuntimeTablesPromise = (async () => {
      await dbRun(
        `CREATE TABLE IF NOT EXISTS v10_onboarding_sessions (
          onboarding_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          persona TEXT NULL,
          persona_confidence TEXT NULL,
          status TEXT NOT NULL,
          current_step TEXT NULL,
          snapshot_json TEXT NULL,
          resume_token TEXT NOT NULL,
          resume_expires_at TEXT NOT NULL,
          started_at TEXT NOT NULL,
          last_event_at TEXT NULL,
          last_snapshot_at TEXT NULL,
          abandoned_at TEXT NULL,
          activation_reached_at TEXT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS v10_onboarding_events (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          onboarding_id TEXT NOT NULL,
          event_name TEXT NOT NULL,
          recorded_at TEXT NOT NULL,
          props_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_v10_onboarding_sessions_tenant_status
           ON v10_onboarding_sessions (tenant_id, status, started_at)`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_v10_onboarding_sessions_resume_token
           ON v10_onboarding_sessions (tenant_id, resume_token)`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_v10_onboarding_events_tenant_onboarding
           ON v10_onboarding_events (tenant_id, onboarding_id, recorded_at)`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_v10_onboarding_events_tenant_event_name
           ON v10_onboarding_events (tenant_id, event_name, recorded_at)`,
        [],
        { fallback: false } as any
      );
    })().catch((error) => {
      ensureOnboardingRuntimeTablesPromise = null;
      throw error;
    });
  }
  await ensureOnboardingRuntimeTablesPromise;
}

function parseSessionRow(row: any): StoredSessionRow | null {
  if (!row?.onboardingId || !row?.tenantId || !row?.userId) return null;
  return {
    onboardingId: String(row.onboardingId),
    tenantId: String(row.tenantId),
    userId: String(row.userId),
    persona: row.persona ? String(row.persona) : null,
    personaConfidence: row.personaConfidence ? String(row.personaConfidence) : null,
    status: String(row.status || 'in_progress') as OnboardingStatus,
    currentStep: row.currentStep ? String(row.currentStep) : null,
    resumeToken: String(row.resumeToken || ''),
    resumeExpiresAt: String(row.resumeExpiresAt || ''),
    snapshot: parseJson<OnboardingSessionSnapshot>(row.snapshotJson),
    startedAt: String(row.startedAt || new Date().toISOString()),
    lastEventAt: row.lastEventAt ? String(row.lastEventAt) : null,
    lastSnapshotAt: row.lastSnapshotAt ? String(row.lastSnapshotAt) : null,
    abandonedAt: row.abandonedAt ? String(row.abandonedAt) : null,
    activationReachedAt: row.activationReachedAt ? String(row.activationReachedAt) : null,
  };
}

function parseEventRow(row: any): StoredEventRow | null {
  if (!row?.id || !row?.tenantId || !row?.onboardingId || !row?.eventName) return null;
  const props = parseJson<OnboardingTelemetryProps>(row.propsJson);
  if (!props) return null;
  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    onboardingId: String(row.onboardingId),
    eventName: String(row.eventName),
    recordedAt: String(row.recordedAt || new Date().toISOString()),
    props,
  };
}

async function getSession(
  onboardingId: string,
  tenantId: string
): Promise<StoredSessionRow | null> {
  await ensureOnboardingRuntimeTables();
  const row = await dbGet(
    `SELECT onboarding_id AS onboardingId,
            tenant_id AS tenantId,
            user_id AS userId,
            persona,
            persona_confidence AS personaConfidence,
            status,
            current_step AS currentStep,
            snapshot_json AS snapshotJson,
            resume_token AS resumeToken,
            resume_expires_at AS resumeExpiresAt,
            started_at AS startedAt,
            last_event_at AS lastEventAt,
            last_snapshot_at AS lastSnapshotAt,
            abandoned_at AS abandonedAt,
            activation_reached_at AS activationReachedAt
       FROM v10_onboarding_sessions
      WHERE onboarding_id = ? AND tenant_id = ?`,
    [onboardingId, tenantId],
    { fallback: false } as any
  );
  return parseSessionRow(row);
}

async function getSessionByResumeToken(
  resumeToken: string,
  tenantId: string
): Promise<StoredSessionRow | null> {
  await ensureOnboardingRuntimeTables();
  const row = await dbGet(
    `SELECT onboarding_id AS onboardingId,
            tenant_id AS tenantId,
            user_id AS userId,
            persona,
            persona_confidence AS personaConfidence,
            status,
            current_step AS currentStep,
            snapshot_json AS snapshotJson,
            resume_token AS resumeToken,
            resume_expires_at AS resumeExpiresAt,
            started_at AS startedAt,
            last_event_at AS lastEventAt,
            last_snapshot_at AS lastSnapshotAt,
            abandoned_at AS abandonedAt,
            activation_reached_at AS activationReachedAt
       FROM v10_onboarding_sessions
      WHERE resume_token = ? AND tenant_id = ?`,
    [resumeToken, tenantId],
    { fallback: false } as any
  );
  return parseSessionRow(row);
}

async function listTenantSessions(tenantId: string): Promise<StoredSessionRow[]> {
  await ensureOnboardingRuntimeTables();
  const rows = (await dbAll(
    `SELECT onboarding_id AS onboardingId,
            tenant_id AS tenantId,
            user_id AS userId,
            persona,
            persona_confidence AS personaConfidence,
            status,
            current_step AS currentStep,
            snapshot_json AS snapshotJson,
            resume_token AS resumeToken,
            resume_expires_at AS resumeExpiresAt,
            started_at AS startedAt,
            last_event_at AS lastEventAt,
            last_snapshot_at AS lastSnapshotAt,
            abandoned_at AS abandonedAt,
            activation_reached_at AS activationReachedAt
       FROM v10_onboarding_sessions
      WHERE tenant_id = ?
      ORDER BY started_at DESC`,
    [tenantId],
    { fallback: false } as any
  )) as any[];
  return rows.map(parseSessionRow).filter(Boolean) as StoredSessionRow[];
}

async function listTenantEvents(tenantId: string): Promise<StoredEventRow[]> {
  await ensureOnboardingRuntimeTables();
  const rows = (await dbAll(
    `SELECT id,
            tenant_id AS tenantId,
            onboarding_id AS onboardingId,
            event_name AS eventName,
            recorded_at AS recordedAt,
            props_json AS propsJson
       FROM v10_onboarding_events
      WHERE tenant_id = ?
      ORDER BY recorded_at ASC`,
    [tenantId],
    { fallback: false } as any
  )) as any[];
  return rows.map(parseEventRow).filter(Boolean) as StoredEventRow[];
}

async function upsertSession(session: StoredSessionRow): Promise<void> {
  await ensureOnboardingRuntimeTables();
  await dbRun(
    `INSERT INTO v10_onboarding_sessions (
       onboarding_id, tenant_id, user_id, persona, persona_confidence, status, current_step,
       snapshot_json, resume_token, resume_expires_at, started_at, last_event_at,
       last_snapshot_at, abandoned_at, activation_reached_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(onboarding_id) DO UPDATE SET
       tenant_id = excluded.tenant_id,
       user_id = excluded.user_id,
       persona = excluded.persona,
       persona_confidence = excluded.persona_confidence,
       status = excluded.status,
       current_step = excluded.current_step,
       snapshot_json = excluded.snapshot_json,
       resume_token = excluded.resume_token,
       resume_expires_at = excluded.resume_expires_at,
       started_at = excluded.started_at,
       last_event_at = excluded.last_event_at,
       last_snapshot_at = excluded.last_snapshot_at,
       abandoned_at = excluded.abandoned_at,
       activation_reached_at = excluded.activation_reached_at,
       updated_at = CURRENT_TIMESTAMP`,
    [
      session.onboardingId,
      session.tenantId,
      session.userId,
      session.persona,
      session.personaConfidence,
      session.status,
      session.currentStep,
      session.snapshot ? JSON.stringify(session.snapshot) : null,
      session.resumeToken,
      session.resumeExpiresAt,
      session.startedAt,
      session.lastEventAt,
      session.lastSnapshotAt,
      session.abandonedAt,
      session.activationReachedAt,
    ],
    { fallback: false } as any
  );
}

async function appendEvent(row: StoredEventRow): Promise<void> {
  await ensureOnboardingRuntimeTables();
  await dbRun(
    `INSERT INTO v10_onboarding_events (
       id, tenant_id, onboarding_id, event_name, recorded_at, props_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.tenantId,
      row.onboardingId,
      row.eventName,
      row.recordedAt,
      JSON.stringify(row.props),
    ],
    { fallback: false } as any
  );
}

function deltaBannerForStep(step: string | null, changedSources: string[]): string | null {
  if (!step) return null;
  const stepLabel = step.replace(/[_-]+/g, ' ');
  if (changedSources.length > 0) {
    return `You stopped after ${stepLabel}; ${changedSources.length} source(s) changed since then.`;
  }
  return `You stopped after ${stepLabel}; ready to continue.`;
}

export class OnboardingRuntimeService {
  async capturePersona(input: OnboardingPersonaRequest): Promise<OnboardingPersonaResponse> {
    const parsed = OnboardingPersonaRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = parsed.now?.trim() || new Date().toISOString();
    const existing =
      parsed.onboardingId && parsed.onboardingId.trim()
        ? await getSession(parsed.onboardingId.trim(), scope.tenantId)
        : null;
    const onboardingId =
      existing?.onboardingId ||
      String(
        runOnboardingPersonaPipeline({
          onboardingId: unsafeOnboardingPersonaPipelineRunId(crypto.randomUUID()),
          persona: parsed.persona,
          now,
        }).onboardingId
      );
    const resumeToken = existing?.resumeToken || crypto.randomUUID();
    const resumeExpiresAt = existing?.resumeExpiresAt || plusDays(now, 7);
    const snapshot: OnboardingSessionSnapshot = {
      ...(existing?.snapshot ||
        defaultSnapshot({
          persona: parsed.persona,
          personaConfidence: parsed.personaConfidence || null,
        })),
      persona: normalizePersona(parsed.persona),
      personaConfidence: parsed.personaConfidence || existing?.personaConfidence || null,
      currentStep: existing?.snapshot?.currentStep || 'persona_capture',
    };
    const session: StoredSessionRow = {
      onboardingId,
      tenantId: scope.tenantId,
      userId: scope.userId,
      persona: normalizePersona(parsed.persona),
      personaConfidence: parsed.personaConfidence || null,
      status: existing ? existing.status : 'in_progress',
      currentStep: snapshot.currentStep,
      resumeToken,
      resumeExpiresAt,
      snapshot,
      startedAt: existing?.startedAt || now,
      lastEventAt: now,
      lastSnapshotAt: existing?.lastSnapshotAt || now,
      abandonedAt: existing?.abandonedAt || null,
      activationReachedAt: existing?.activationReachedAt || null,
    };
    await upsertSession(session);

    if (!existing) {
      await appendEvent({
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        onboardingId,
        eventName: 'onboard.started',
        recordedAt: now,
        props: defaultTelemetryProps({
          persona: parsed.persona,
          sourceType: parsed.sourceType,
          trustMode: parsed.trustMode,
          residencyRegion: parsed.residencyRegion,
          approvalRequired: parsed.approvalRequired,
        }),
      });
    }
    await appendEvent({
      id: crypto.randomUUID(),
      tenantId: session.tenantId,
      onboardingId,
      eventName: 'onboard.persona_confirmed',
      recordedAt: now,
      props: defaultTelemetryProps({
        persona: parsed.persona,
        sourceType: parsed.sourceType,
        trustMode: parsed.trustMode,
        residencyRegion: parsed.residencyRegion,
        approvalRequired: parsed.approvalRequired,
      }),
    });

    return { onboardingId, resumeToken, resumeExpiresAt, now, accepted: true };
  }

  async saveSnapshot(
    input: OnboardingSnapshotSaveRequest
  ): Promise<OnboardingSnapshotSaveResponse> {
    const parsed = OnboardingSnapshotSaveRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = parsed.now?.trim() || new Date().toISOString();
    const existing = await getSession(parsed.onboardingId, scope.tenantId);
    if (!existing) {
      throw new OnboardingRuntimeInputError(
        'ONBOARDING_RUNTIME_SESSION_NOT_FOUND',
        'Onboarding session not found',
        404
      );
    }
    const status = parsed.status || 'in_progress';
    const nextSession: StoredSessionRow = {
      ...existing,
      status,
      currentStep: parsed.snapshot.currentStep,
      snapshot: parsed.snapshot,
      resumeExpiresAt: plusDays(now, 7),
      lastSnapshotAt: now,
      abandonedAt: status === 'abandoned' ? now : existing.abandonedAt,
    };
    await upsertSession(nextSession);

    if (status === 'abandoned') {
      await appendEvent({
        id: crypto.randomUUID(),
        tenantId: nextSession.tenantId,
        onboardingId: nextSession.onboardingId,
        eventName: 'onboard.abandoned',
        recordedAt: now,
        props: {
          ...defaultTelemetryProps({ persona: nextSession.persona || 'unknown' }),
          secondsSinceStart: Math.max(
            0,
            Math.round((new Date(now).getTime() - new Date(nextSession.startedAt).getTime()) / 1000)
          ),
        },
      });
    }

    return {
      onboardingId: nextSession.onboardingId,
      resumeToken: nextSession.resumeToken,
      resumeExpiresAt: nextSession.resumeExpiresAt,
      savedAt: now,
      status,
    };
  }

  async resume(input: OnboardingResumeRequest): Promise<OnboardingResumeResponse> {
    const parsed = OnboardingResumeRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = parsed.now?.trim() || new Date().toISOString();
    const session = parsed.onboardingId
      ? await getSession(parsed.onboardingId, scope.tenantId)
      : await getSessionByResumeToken(String(parsed.resumeToken || ''), scope.tenantId);
    if (!session) {
      return {
        outcome: 'not_found',
        onboardingId: null,
        resumeToken: null,
        resumeExpiresAt: null,
        resumedAt: now,
        snapshot: null,
        currentStep: null,
        deltaBanner: null,
        changedSourceIds: [],
      };
    }
    if (new Date(session.resumeExpiresAt).getTime() < new Date(now).getTime()) {
      await upsertSession({
        ...session,
        status: 'expired',
        snapshot: null,
        currentStep: 'persona_capture',
      });
      return {
        outcome: 'expired',
        onboardingId: session.onboardingId,
        resumeToken: session.resumeToken,
        resumeExpiresAt: session.resumeExpiresAt,
        resumedAt: now,
        snapshot: null,
        currentStep: null,
        deltaBanner: null,
        changedSourceIds: [],
      };
    }

    const previousHashes = extractSourceHashes(session.snapshot);
    const currentHashes = parsed.currentSourceHashes || {};
    const changedSourceIds = Object.keys(previousHashes).filter(
      (id) => currentHashes[id] && currentHashes[id] !== previousHashes[id]
    );
    const nextSession: StoredSessionRow = {
      ...session,
      status: 'resumed',
      lastEventAt: now,
    };
    await upsertSession(nextSession);
    await appendEvent({
      id: crypto.randomUUID(),
      tenantId: session.tenantId,
      onboardingId: session.onboardingId,
      eventName: 'onboard.resume_reentered',
      recordedAt: now,
      props: {
        ...defaultTelemetryProps({ persona: session.persona || 'unknown' }),
        secondsSinceStart: Math.max(
          0,
          Math.round((new Date(now).getTime() - new Date(session.startedAt).getTime()) / 1000)
        ),
        ahaReached: Boolean(session.activationReachedAt),
      },
    });

    return {
      outcome: 'resumed',
      onboardingId: session.onboardingId,
      resumeToken: session.resumeToken,
      resumeExpiresAt: session.resumeExpiresAt,
      resumedAt: now,
      snapshot: session.snapshot,
      currentStep: session.snapshot?.currentStep || session.currentStep,
      deltaBanner: deltaBannerForStep(
        session.snapshot?.currentStep || session.currentStep,
        changedSourceIds
      ),
      changedSourceIds,
    };
  }

  async recordEvent(
    input: OnboardingTelemetryEventRequest
  ): Promise<OnboardingTelemetryEventResponse> {
    const parsed = OnboardingTelemetryEventRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = parsed.now?.trim() || new Date().toISOString();
    const session = await getSession(parsed.onboardingId, scope.tenantId);
    if (!session) {
      throw new OnboardingRuntimeInputError(
        'ONBOARDING_RUNTIME_SESSION_NOT_FOUND',
        'Onboarding session not found',
        404
      );
    }

    const activationReached =
      parsed.eventName === 'onboard.activation_reached' ||
      parsed.props.ahaReached === true ||
      session.activationReachedAt !== null;
    const nextStatus =
      parsed.eventName === 'onboard.abandoned'
        ? 'abandoned'
        : parsed.eventName === 'onboard.activation_reached'
          ? 'completed'
          : session.status;
    await upsertSession({
      ...session,
      status: nextStatus,
      lastEventAt: now,
      activationReachedAt: activationReached
        ? session.activationReachedAt || now
        : session.activationReachedAt,
      abandonedAt: parsed.eventName === 'onboard.abandoned' ? now : session.abandonedAt,
    });
    const eventId = crypto.randomUUID();
    await appendEvent({
      id: eventId,
      tenantId: scope.tenantId,
      onboardingId: parsed.onboardingId,
      eventName: parsed.eventName,
      recordedAt: now,
      props: parsed.props,
    });
    return { onboardingId: parsed.onboardingId, eventId, recordedAt: now };
  }

  async summarizeKpis(scope: {
    tenantId: string;
    now?: string;
  }): Promise<OnboardingKpiSummaryResponse> {
    const now = scope.now?.trim() || new Date().toISOString();
    const sessions = await listTenantSessions(scope.tenantId);
    const events = await listTenantEvents(scope.tenantId);
    const eventsByOnboardingId = new Map<string, StoredEventRow[]>();
    for (const event of events) {
      const list = eventsByOnboardingId.get(event.onboardingId) || [];
      list.push(event);
      eventsByOnboardingId.set(event.onboardingId, list);
    }

    const computeRow = (label: string, subset: StoredSessionRow[]): OnboardingKpiRow => {
      const targets = KPI_TARGETS[label] || KPI_TARGETS.unknown;
      const startedSessions = subset.length;
      const activatedSessions = subset.filter((session) => {
        if (session.activationReachedAt) return true;
        const sessionEvents = eventsByOnboardingId.get(session.onboardingId) || [];
        return sessionEvents.some(
          (event) =>
            event.eventName === 'onboard.activation_reached' ||
            event.props.ahaReached === true ||
            event.eventName === 'onboard.artifact_saved'
        );
      }).length;
      const resumedSessions = subset.filter((session) =>
        (eventsByOnboardingId.get(session.onboardingId) || []).some(
          (event) => event.eventName === 'onboard.resume_reentered'
        )
      ).length;
      const abandonedSessions = subset.filter((session) => {
        if (session.status === 'abandoned' || session.abandonedAt) return true;
        return (eventsByOnboardingId.get(session.onboardingId) || []).some(
          (event) => event.eventName === 'onboard.abandoned'
        );
      }).length;
      const firstArtifactSeconds = subset
        .map(
          (session) =>
            (eventsByOnboardingId.get(session.onboardingId) || []).find(
              (event) => event.eventName === 'onboard.artifact_first_draft_rendered'
            )?.props.secondsSinceStart
        )
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const approvals = subset.filter((session) =>
        (eventsByOnboardingId.get(session.onboardingId) || []).some(
          (event) => event.eventName === 'onboard.artifact_approved'
        )
      ).length;
      const connectorAtAha = subset.filter((session) =>
        (eventsByOnboardingId.get(session.onboardingId) || []).some(
          (event) =>
            (event.eventName === 'onboard.connector_oauth_succeeded' ||
              event.eventName === 'onboard.fallback_upload_used') &&
            event.props.ahaReached === true
        )
      ).length;

      const activationRate = startedSessions > 0 ? (activatedSessions / startedSessions) * 100 : 0;
      const approvalRate = startedSessions > 0 ? (approvals / startedSessions) * 100 : 0;
      const connectorAttachRate =
        activatedSessions > 0 ? (connectorAtAha / activatedSessions) * 100 : 0;
      const artifactMedian = median(firstArtifactSeconds);

      return {
        persona: label,
        startedSessions,
        activatedSessions,
        resumedSessions,
        abandonedSessions,
        metrics: {
          activation_rate: buildMetricValue(
            'activation_rate',
            activationRate,
            targets.activation_rate
          ),
          median_time_to_first_artifact: buildMetricValue(
            'median_time_to_first_artifact',
            artifactMedian,
            targets.median_time_to_first_artifact
          ),
          connector_attach_rate_at_aha: buildMetricValue(
            'connector_attach_rate_at_aha',
            connectorAttachRate,
            targets.connector_attach_rate_at_aha
          ),
          first_artifact_approved_rate: buildMetricValue(
            'first_artifact_approved_rate',
            approvalRate,
            targets.first_artifact_approved_rate
          ),
        },
      };
    };

    const sessionGroups = new Map<string, StoredSessionRow[]>();
    for (const session of sessions) {
      const key = normalizePersona(session.persona);
      const group = sessionGroups.get(key) || [];
      group.push(session);
      sessionGroups.set(key, group);
    }

    const personas = Array.from(sessionGroups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([persona, subset]) => computeRow(persona, subset));
    const totals = computeRow('overall', sessions);
    const last24hCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last24hEventCount = events.filter(
      (event) => new Date(event.recordedAt).getTime() >= last24hCutoff
    ).length;

    return {
      generatedAt: now,
      totals,
      personas,
      last24hEventCount,
    };
  }
}

export const onboardingRuntimeService = new OnboardingRuntimeService();
