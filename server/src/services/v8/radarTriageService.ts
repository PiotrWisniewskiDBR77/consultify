/**
 * P06-B: Radar Triage Cockpit Service
 *
 * Internal operational radar — NOT the external intelligence radar.
 * Implements: ranking grammar, why-now, handoff, degraded states.
 *
 * Canon: FINAL_IMPLEMENTATION_PLAN_06_RADAR_2026-03-29.md
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[V8:RadarTriage]';

// ==========================================
// TYPES (frozen per §2.3)
// ==========================================

export const RadarCategoryValues = [
  'execution_delivery',
  'decision_alignment',
  'finance_kpi',
  'governance_compliance',
  'external_change',
] as const;
export type RadarCategory = (typeof RadarCategoryValues)[number];

export type PriorityLevel = 'P0' | 'P1' | 'P2';
export type PrimaryDriver = 'deadline' | 'blocker' | 'variance' | 'escalation' | 'opportunity';
export type TimeWindow = 'next_24h' | 'this_week' | 'this_month';
export type HandoffIntent = 'open' | 'create' | 'append';
export type TargetModule = 'Inicjatywy' | 'Wdrożenia' | 'Notatki';

export type P0Archetype =
  | 'critical_path_blocker'
  | 'decision_needed'
  | 'stakeholder_escalation'
  | 'compliance_deadline'
  | 'kpi_finance_anomaly';

export const P0_ARCHETYPES: Record<
  P0Archetype,
  {
    category: RadarCategory;
    ownerRole: string;
    primaryTarget: TargetModule;
    fallbackTarget: string;
  }
> = {
  critical_path_blocker: {
    category: 'execution_delivery',
    ownerRole: 'Delivery Lead / PMO',
    primaryTarget: 'Wdrożenia',
    fallbackTarget: 'Notatki — capture blockers checklist',
  },
  decision_needed: {
    category: 'decision_alignment',
    ownerRole: 'PMO / Initiative Owner',
    primaryTarget: 'Inicjatywy',
    fallbackTarget: 'Notatki',
  },
  stakeholder_escalation: {
    category: 'decision_alignment',
    ownerRole: 'Program Lead / PMO',
    primaryTarget: 'Notatki',
    fallbackTarget: 'Inicjatywy — if decision required',
  },
  compliance_deadline: {
    category: 'governance_compliance',
    ownerRole: 'Governance Owner / PMO',
    primaryTarget: 'Wdrożenia',
    fallbackTarget: 'Notatki',
  },
  kpi_finance_anomaly: {
    category: 'finance_kpi',
    ownerRole: 'Finance Lead / PMO',
    primaryTarget: 'Inicjatywy',
    fallbackTarget: 'Notatki — analysis',
  },
};
export const TriageStateValues = [
  'ready',
  'degraded_missing_data',
  'degraded_conflict',
  'degraded_stale',
  'blocked_permission',
] as const;
export type TriageState = (typeof TriageStateValues)[number];

export interface RadarBands {
  impact: 1 | 2 | 3;
  urgency: 1 | 2 | 3;
  scope: 1 | 2 | 3;
  confidence: 0 | 1 | 2 | 3;
  freshness: 0 | 1 | 2 | 3;
  actionability: 0 | 1 | 2;
}

export interface RadarTriageSignal {
  signalId: string;
  organizationId: string;
  category: RadarCategory;
  priorityLevel: PriorityLevel;
  score: number;
  bands: RadarBands;
  triggeredRules: string[];
  rank: {
    bands: RadarBands;
    triggeredRules: string[];
  };
  whyNow: {
    rationaleText: string;
    timeWindow: TimeWindow;
    primaryDriver: PrimaryDriver;
  };
  evidence: {
    evidencePointers: Array<{ type: string; ref: string }>;
    lastObservedAt: string;
    sourceCoverage: 'complete' | 'partial';
  };
  uncertaintyBoundary: {
    missingInputs: string[];
    conflicts: string[];
    whatWouldChangeRanking: string[];
  };
  ownership: {
    ownerRole: string;
    queueHint: 'execution' | 'decision' | 'governance';
  };
  nextAction: {
    targetModule: TargetModule;
    handoffIntent: HandoffIntent;
    handoffPayload: Record<string, unknown>;
    safeFallback: string;
  };
  triageState: TriageState;
  createdAt: string;
  updatedAt: string;
}

export interface RadarHandoffContext {
  origin: 'radar';
  signalId: string;
  category: RadarCategory;
  priorityLevel: PriorityLevel;
  whyNow: RadarTriageSignal['whyNow'];
  evidencePointers: RadarTriageSignal['evidence']['evidencePointers'];
  lastObservedAt: string;
  uncertaintyBoundary: RadarTriageSignal['uncertaintyBoundary'];
  ownerRole: string;
  triggeredRules: string[];
  rank: RadarTriageSignal['rank'];
  radarDeeplink: string;
}

// ==========================================
// RANKING ENGINE (§2.3.2)
// ==========================================

const CONF_MAP: Record<number, number> = { 3: 1.0, 2: 0.8, 1: 0.6, 0: 0.4 };
const FRESH_MAP: Record<number, number> = { 3: 3, 2: 2, 1: 1, 0: -3 };

function computeScore(bands: RadarBands, isDuplicate: boolean): number {
  const base = 4 * bands.impact + 3 * bands.urgency + 2 * bands.scope + 2 * bands.actionability;
  const conf = CONF_MAP[bands.confidence] ?? 0.4;
  const fresh = FRESH_MAP[bands.freshness] ?? -3;
  const dup = isDuplicate ? 4 : 0;
  return Math.round(base * conf + fresh - dup);
}

/** P06 §2.3.2 — exported for contract tests (same implementation as runtime ranking). */
export function computeRadarTriageScore(bands: RadarBands, isDuplicate: boolean): number {
  return computeScore(bands, isDuplicate);
}

/** P06 §2.3.2 hard gates — exported for contract tests. */
export function checkRadarTriageHardGates(category: RadarCategory, bands: RadarBands): string[] {
  return checkHardGates(category, bands);
}

function checkHardGates(category: RadarCategory, bands: RadarBands): string[] {
  const rules: string[] = [];

  if (category === 'governance_compliance' && bands.urgency >= 2 && bands.impact >= 2) {
    rules.push('HARD_GATE_GOVERNANCE_DEADLINE_7D');
  }
  if (category === 'execution_delivery' && bands.urgency >= 2 && bands.impact >= 2) {
    rules.push('HARD_GATE_EXECUTION_BLOCKER_D7');
  }
  if (category === 'decision_alignment' && bands.urgency >= 3 && bands.impact >= 2) {
    rules.push('HARD_GATE_DECISION_72H');
  }
  if (category === 'finance_kpi' && bands.impact >= 2 && bands.urgency >= 2) {
    rules.push('HARD_GATE_KPI_THRESHOLD');
  }

  return rules;
}

function determinePriority(
  score: number,
  bands: RadarBands,
  hardGateRules: string[]
): PriorityLevel {
  if (hardGateRules.length > 0) return 'P0';
  if (
    bands.impact >= 2 &&
    bands.urgency >= 2 &&
    bands.freshness >= 1 &&
    bands.confidence >= 1 &&
    score >= 18
  )
    return 'P0';
  if (bands.impact >= 2 && bands.urgency >= 1 && score >= 12) return 'P1';
  return 'P2';
}

const PERMISSION_BLOCK_PATTERN =
  /permission|access\s*denied|unauthorized|forbidden|\b403\b|insufficient\s*privilege/i;

function hasPermissionBlock(ub: RadarTriageSignal['uncertaintyBoundary'] | undefined): boolean {
  if (!ub?.missingInputs?.length) return false;
  return ub.missingInputs.some((m) => PERMISSION_BLOCK_PATTERN.test(m));
}

function determineTriageState(signal: Partial<RadarTriageSignal>): TriageState {
  const ub = signal.uncertaintyBoundary;
  if (!ub) return 'ready';
  if (hasPermissionBlock(ub)) return 'blocked_permission';
  if (ub.missingInputs && ub.missingInputs.length > 0) return 'degraded_missing_data';
  if (ub.conflicts && ub.conflicts.length > 0) return 'degraded_conflict';

  // §2.3.6: stale detection based on freshness band
  if (signal.bands && signal.bands.freshness === 0) return 'degraded_stale';

  // §2.3.6: evidence staleness
  if (signal.evidence?.lastObservedAt) {
    const age = Date.now() - Date.parse(signal.evidence.lastObservedAt);
    if (!Number.isNaN(age) && age > 30 * 24 * 3600 * 1000) return 'degraded_stale';
  }

  return 'ready';
}

function determineTargetModule(
  category: RadarCategory,
  archetype: P0Archetype | null
): TargetModule {
  if (archetype) return P0_ARCHETYPES[archetype].primaryTarget;
  switch (category) {
    case 'execution_delivery':
      return 'Wdrożenia';
    case 'decision_alignment':
      return 'Inicjatywy';
    case 'governance_compliance':
      return 'Wdrożenia';
    case 'finance_kpi':
      return 'Inicjatywy';
    case 'external_change':
      return 'Notatki';
  }
}

function determineFallback(_category: RadarCategory, archetype: P0Archetype | null): string {
  if (archetype) return P0_ARCHETYPES[archetype].fallbackTarget;
  return 'Notatki — capture context for later review';
}

function determineOwnerRole(category: RadarCategory): string {
  switch (category) {
    case 'execution_delivery':
      return 'Delivery Lead / PMO';
    case 'decision_alignment':
      return 'PMO / Initiative Owner';
    case 'governance_compliance':
      return 'Governance Owner / PMO';
    case 'finance_kpi':
      return 'Finance Lead / PMO';
    case 'external_change':
      return 'Program Lead / PMO';
  }
}

function determineQueueHint(category: RadarCategory): 'execution' | 'decision' | 'governance' {
  switch (category) {
    case 'execution_delivery':
      return 'execution';
    case 'decision_alignment':
      return 'decision';
    case 'governance_compliance':
      return 'governance';
    case 'finance_kpi':
      return 'decision';
    case 'external_change':
      return 'decision';
  }
}

// ==========================================
// CRUD
// ==========================================

export async function createTriageSignal(params: {
  organizationId: string;
  category: RadarCategory;
  bands: RadarBands;
  whyNow: { rationaleText: string; timeWindow: TimeWindow; primaryDriver: PrimaryDriver };
  evidence: {
    evidencePointers: Array<{ type: string; ref: string }>;
    lastObservedAt: string;
    sourceCoverage: 'complete' | 'partial';
  };
  uncertaintyBoundary?: {
    missingInputs?: string[];
    conflicts?: string[];
    whatWouldChangeRanking?: string[];
  };
  handoffPayload?: Record<string, unknown>;
}): Promise<RadarTriageSignal> {
  const signalId = uuidv4();
  const now = new Date().toISOString();

  const hardGateRules = checkHardGates(params.category, params.bands);

  // §2.3.7: near-duplicate detection — check for same category + similar rationale in last 24h
  const recentDuplicates = await dbAll<any>(
    `SELECT signal_id, why_now_json FROM v8_radar_triage_signals 
     WHERE organization_id = ? AND category = ? 
     AND created_at > datetime('now', '-24 hours')
     ORDER BY created_at DESC LIMIT 5`,
    [params.organizationId, params.category],
    { fallback: true }
  );

  let isDuplicate = false;
  if (recentDuplicates && recentDuplicates.length > 0) {
    const inputWords = new Set(
      params.whyNow.rationaleText
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
    for (const dup of recentDuplicates) {
      const dupWhyNow = safeJsonParse<any>(dup.why_now_json, {});
      const dupWords = new Set(
        String(dupWhyNow.rationaleText || '')
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
      );
      const overlap = [...inputWords].filter((w) => dupWords.has(w)).length;
      if (inputWords.size > 0 && overlap / inputWords.size > 0.6) {
        isDuplicate = true;
        break;
      }
    }
  }

  const score = computeScore(params.bands, isDuplicate);
  const priorityLevel = determinePriority(score, params.bands, hardGateRules);

  // §2.3.4: detect P0 archetype
  let archetype: P0Archetype | null = null;
  if (priorityLevel === 'P0') {
    if (params.category === 'execution_delivery') archetype = 'critical_path_blocker';
    else if (
      params.category === 'decision_alignment' &&
      params.whyNow.primaryDriver === 'escalation'
    )
      archetype = 'stakeholder_escalation';
    else if (params.category === 'decision_alignment') archetype = 'decision_needed';
    else if (params.category === 'governance_compliance') archetype = 'compliance_deadline';
    else if (params.category === 'finance_kpi') archetype = 'kpi_finance_anomaly';
  }

  const targetModule = determineTargetModule(params.category, archetype);
  const ownerRole =
    archetype != null ? P0_ARCHETYPES[archetype].ownerRole : determineOwnerRole(params.category);

  const ub = {
    missingInputs: params.uncertaintyBoundary?.missingInputs || [],
    conflicts: params.uncertaintyBoundary?.conflicts || [],
    whatWouldChangeRanking: params.uncertaintyBoundary?.whatWouldChangeRanking || [],
  };

  const signal: RadarTriageSignal = {
    signalId,
    organizationId: params.organizationId,
    category: params.category,
    priorityLevel,
    score,
    bands: params.bands,
    triggeredRules: hardGateRules,
    rank: { bands: params.bands, triggeredRules: hardGateRules },
    whyNow: params.whyNow,
    evidence: params.evidence,
    uncertaintyBoundary: ub,
    ownership: {
      ownerRole,
      queueHint: determineQueueHint(params.category),
    },
    nextAction: {
      targetModule,
      handoffIntent: 'open',
      handoffPayload: params.handoffPayload || {},
      safeFallback: determineFallback(params.category, archetype),
    },
    triageState: 'ready',
    createdAt: now,
    updatedAt: now,
  };

  signal.triageState = determineTriageState(signal);

  await dbRun(
    `INSERT INTO v8_radar_triage_signals (
      signal_id, organization_id, category, priority_level, score,
      bands_json, triggered_rules_json, why_now_json, evidence_json,
      uncertainty_json, ownership_json, next_action_json, triage_state,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      signal.signalId,
      signal.organizationId,
      signal.category,
      signal.priorityLevel,
      signal.score,
      JSON.stringify(signal.bands),
      JSON.stringify(signal.triggeredRules),
      JSON.stringify(signal.whyNow),
      JSON.stringify(signal.evidence),
      JSON.stringify(signal.uncertaintyBoundary),
      JSON.stringify(signal.ownership),
      JSON.stringify(signal.nextAction),
      signal.triageState,
      signal.createdAt,
      signal.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created triage signal ${signalId} P=${priorityLevel} cat=${params.category}`
  );
  return signal;
}

export async function getTriageSignals(
  organizationId: string,
  filters?: { category?: RadarCategory; priorityLevel?: PriorityLevel; triageState?: TriageState }
): Promise<RadarTriageSignal[]> {
  let sql = `SELECT * FROM v8_radar_triage_signals WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];
  if (filters?.category) {
    sql += ` AND category = ?`;
    params.push(filters.category);
  }
  if (filters?.priorityLevel) {
    sql += ` AND priority_level = ?`;
    params.push(filters.priorityLevel);
  }
  if (filters?.triageState) {
    sql += ` AND triage_state = ?`;
    params.push(filters.triageState);
  }
  sql += ` ORDER BY priority_level ASC, 
  CASE WHEN json_extract(triggered_rules_json, '$[0]') IS NOT NULL THEN 0 ELSE 1 END ASC,
  json_extract(bands_json, '$.urgency') DESC,
  json_extract(bands_json, '$.impact') DESC,
  json_extract(bands_json, '$.actionability') DESC,
  score DESC,
  created_at DESC`;

  const rows = await dbAll<any>(sql, params, { fallback: true });
  return (rows || []).map(rowToTriageSignal);
}

export async function getTriageSignal(
  signalId: string,
  organizationId: string
): Promise<RadarTriageSignal | null> {
  const row = await dbGet<any>(
    `SELECT * FROM v8_radar_triage_signals WHERE signal_id = ? AND organization_id = ?`,
    [signalId, organizationId],
    { fallback: true }
  );
  if (!row) return null;
  return rowToTriageSignal(row);
}

export function buildHandoffContext(signal: RadarTriageSignal): RadarHandoffContext {
  return {
    origin: 'radar',
    signalId: signal.signalId,
    category: signal.category,
    priorityLevel: signal.priorityLevel,
    whyNow: signal.whyNow,
    evidencePointers: signal.evidence.evidencePointers,
    lastObservedAt: signal.evidence.lastObservedAt,
    uncertaintyBoundary: signal.uncertaintyBoundary,
    ownerRole: signal.ownership.ownerRole,
    triggeredRules: signal.triggeredRules,
    rank: signal.rank,
    radarDeeplink: `/radar/signals/${signal.signalId}`,
  };
}

export async function executeHandoff(
  signalId: string,
  organizationId: string
): Promise<{
  handoffContext: RadarHandoffContext;
  targetModule: TargetModule;
  targetPayload: Record<string, unknown>;
}> {
  const signal = await getTriageSignal(signalId, organizationId);
  if (!signal) throw Object.assign(new Error('Signal not found'), { code: 'P06_SIGNAL_NOT_FOUND' });

  const handoffContext = buildHandoffContext(signal);
  const targetModule = signal.nextAction.targetModule;

  let targetPayload: Record<string, unknown> = {
    ...signal.nextAction.handoffPayload,
    radar_handoff_context: handoffContext,
  };

  if (targetModule === 'Inicjatywy') {
    targetPayload = {
      ...targetPayload,
      initiative_suggestion: {
        problem_statement: signal.whyNow.rationaleText,
        proposed_outcome: `Address ${signal.category} signal within ${signal.whyNow.timeWindow}`,
        time_window: signal.whyNow.timeWindow,
        suggested_owner_role: signal.ownership.ownerRole,
        open_questions: signal.uncertaintyBoundary.missingInputs,
      },
    };
  } else if (targetModule === 'Wdrożenia') {
    targetPayload = {
      ...targetPayload,
      deployment_suggestion: {
        affected_milestone_area:
          signal.evidence.evidencePointers.map((p) => p.ref).join(', ') || 'TBD',
        blocker_summary: signal.whyNow.rationaleText,
        next_step: `Resolve ${signal.category} issue`,
        expected_unblock: signal.whyNow.timeWindow,
      },
    };
  } else {
    targetPayload = {
      ...targetPayload,
      note_suggestion: {
        summary: [signal.whyNow.rationaleText],
        assumptions: signal.uncertaintyBoundary.missingInputs,
        decision_needed: signal.category === 'decision_alignment',
        links: signal.evidence.evidencePointers.map((p) => p.ref),
      },
    };
  }

  const now = new Date().toISOString();
  await dbRun(
    `UPDATE v8_radar_triage_signals SET updated_at = ? WHERE signal_id = ? AND organization_id = ?`,
    [now, signalId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Executed handoff for signal ${signalId} → ${targetModule}`);
  return { handoffContext, targetModule, targetPayload };
}

// ==========================================
// HELPERS
// ==========================================

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToTriageSignal(row: any): RadarTriageSignal {
  const bands = safeJsonParse(row.bands_json, {
    impact: 1,
    urgency: 1,
    scope: 1,
    confidence: 0,
    freshness: 0,
    actionability: 0,
  }) as RadarBands;
  const triggeredRules = safeJsonParse(row.triggered_rules_json, []);
  return {
    signalId: row.signal_id,
    organizationId: row.organization_id,
    category: row.category,
    priorityLevel: row.priority_level,
    score: row.score,
    bands,
    triggeredRules,
    rank: { bands, triggeredRules },
    whyNow: safeJsonParse(row.why_now_json, {
      rationaleText: '',
      timeWindow: 'this_week',
      primaryDriver: 'blocker',
    }),
    evidence: safeJsonParse(row.evidence_json, {
      evidencePointers: [],
      lastObservedAt: '',
      sourceCoverage: 'partial',
    }),
    uncertaintyBoundary: safeJsonParse(row.uncertainty_json, {
      missingInputs: [],
      conflicts: [],
      whatWouldChangeRanking: [],
    }),
    ownership: safeJsonParse(row.ownership_json, { ownerRole: '', queueHint: 'execution' }),
    nextAction: safeJsonParse(row.next_action_json, {
      targetModule: 'Notatki',
      handoffIntent: 'open',
      handoffPayload: {},
      safeFallback: '',
    }),
    triageState: row.triage_state || 'ready',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
