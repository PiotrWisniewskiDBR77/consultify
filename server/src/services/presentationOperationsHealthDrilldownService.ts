/**
 * presentationOperationsHealthDrilldownService
 *
 * Pure aggregation logic for the SuperAdmin "Operations Health" drill-down
 * panel. Given an SLO id and the same shape of raw rows that
 * `presentationOperationsHealthService` consumes, this service produces:
 *
 *   - a 30-day (configurable 1..90) trend bucketed at 1..7 day granularity,
 *   - a list of up to 5 "most problematic" decks for that SLO,
 *   - up to 8 most-recent event samples with a SHORT, allow-listed excerpt
 *     line (never raw payload JSON — privacy/security).
 *
 * Status thresholds and metric definitions are intentionally identical to
 * the Sprint 10 service so the drill-down can never disagree with the card
 * grid for the same window. To keep the math obvious and side-effect free
 * we duplicate the formulas here rather than reusing private helpers from
 * the parent service. The classifier `classifySloStatus` is exported so
 * tests can pin the thresholds explicitly.
 *
 * The route layer is responsible for fetching rows. This service NEVER
 * calls the database, NEVER reads `Date.now()`, and NEVER fabricates
 * numbers when the underlying input is missing or too small to be
 * statistically meaningful (small samples → `inconclusive`).
 */

import type { SloStatus } from './presentationOperationsHealthService.js';

export type DrilldownSloId =
  | 'generation_success_rate'
  | 'export_success_rate'
  | 'p95_generation_latency_ms'
  | 'agent_edit_success_rate'
  | 'export_blocked_rate';

export interface TrendPoint {
  bucketStart: string;
  bucketEnd: string;
  observedNumeric: number | null;
  status: SloStatus;
  sampleSize: number;
}

export interface TopProblematicDeck {
  deckId: string;
  title: string;
  observedNumeric: number | null;
  failureCount: number;
  totalCount: number;
}

export interface DrilldownEventSample {
  occurredAt: string;
  deckId: string;
  type: string;
  status: string | null;
  durationMs: number | null;
  excerpt: string | null;
}

export interface BuildSloDrilldownInput {
  sloId: DrilldownSloId;
  windowDays: number;
  bucketDays: number;
  nowIso: string;
  runtimeEvents: {
    deckId: string;
    eventType: string;
    payloadJson: string | null;
    createdAt: string;
  }[];
  exportRecords: {
    deckId: string;
    status: string;
    format: string;
    durationMs: number | null;
    createdAt: string;
  }[];
  agentOperations: {
    deckId: string;
    status: string;
    operationType: string;
    createdAt: string;
  }[];
  decks: { id: string; title: string }[];
}

export interface SloDrilldownReport {
  sloId: DrilldownSloId;
  windowStart: string;
  windowEnd: string;
  bucketDays: number;
  trend: TrendPoint[];
  topProblematicDecks: TopProblematicDeck[];
  recentSamples: DrilldownEventSample[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal constants (mirrors of presentationOperationsHealthService)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

const AGENT_EDIT_OPERATION_TYPES = new Set<string>([
  'agent_edit',
  'agent_bulk_revert',
  'agent_revert',
]);

const AGENT_SUCCESS_STATUSES = new Set<string>(['applied', 'accepted']);

const MIN_LATENCY_SAMPLES_FOR_VERDICT = 10;

const MAX_TOP_DECKS = 5;
const MAX_RECENT_SAMPLES = 8;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function safeParseDate(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * UTC midnight of the start of the day immediately AFTER the given timestamp.
 * Used so the bucket containing `now` is closed on its right edge at the
 * start of "tomorrow UTC", which keeps the newest bucket inclusive of `now`.
 */
function nextUtcMidnight(ms: number): number {
  const day = new Date(ms);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1, 0, 0, 0, 0);
}

function clampPositiveInt(value: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  const rounded = Math.round(value);
  if (rounded < lo) return lo;
  if (rounded > hi) return hi;
  return rounded;
}

function p95(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const value = sorted[idx];
  return typeof value === 'number' ? value : null;
}

function mean(samples: number[]): number | null {
  if (samples.length === 0) return null;
  let sum = 0;
  for (const s of samples) sum += s;
  return sum / samples.length;
}

// ---------------------------------------------------------------------------
// Bucket scaffolding
// ---------------------------------------------------------------------------

interface BucketRange {
  startMs: number;
  endMs: number;
}

function buildBuckets(nowMs: number, windowDays: number, bucketDays: number): BucketRange[] {
  const newestEndMs = nextUtcMidnight(nowMs);
  const bucketCount = Math.max(1, Math.ceil(windowDays / bucketDays));
  const ranges: BucketRange[] = [];
  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const endMs = newestEndMs - i * bucketDays * DAY_MS;
    const startMs = endMs - bucketDays * DAY_MS;
    ranges.push({ startMs, endMs });
  }
  return ranges;
}

function isInBucket(ms: number, bucket: BucketRange): boolean {
  return ms >= bucket.startMs && ms < bucket.endMs;
}

// ---------------------------------------------------------------------------
// Status classification (must match presentationOperationsHealthService)
// ---------------------------------------------------------------------------

function classifyHigherIsBetter(
  pct: number,
  passThreshold: number,
  atRiskThreshold: number
): SloStatus {
  if (pct >= passThreshold) return 'pass';
  if (pct >= atRiskThreshold) return 'at_risk';
  return 'breach';
}

function classifyLowerIsBetter(
  value: number,
  passThreshold: number,
  atRiskThreshold: number
): SloStatus {
  if (value <= passThreshold) return 'pass';
  if (value <= atRiskThreshold) return 'at_risk';
  return 'breach';
}

export function classifySloStatus(
  sloId: DrilldownSloId,
  observed: number | null,
  sampleSize: number
): SloStatus {
  if (observed === null || !Number.isFinite(observed)) return 'inconclusive';
  switch (sloId) {
    case 'generation_success_rate':
      if (sampleSize <= 0) return 'inconclusive';
      return classifyHigherIsBetter(observed, 95, 90);
    case 'export_success_rate':
      if (sampleSize <= 0) return 'inconclusive';
      return classifyHigherIsBetter(observed, 95, 90);
    case 'p95_generation_latency_ms':
      if (sampleSize < MIN_LATENCY_SAMPLES_FOR_VERDICT) return 'inconclusive';
      return classifyLowerIsBetter(observed, 8000, 12000);
    case 'agent_edit_success_rate':
      if (sampleSize <= 0) return 'inconclusive';
      return classifyHigherIsBetter(observed, 70, 50);
    case 'export_blocked_rate':
      if (sampleSize <= 0) return 'inconclusive';
      return classifyLowerIsBetter(observed, 10, 25);
    default:
      return 'inconclusive';
  }
}

// ---------------------------------------------------------------------------
// Per-bucket metric computation
// ---------------------------------------------------------------------------

interface BucketObservation {
  observedNumeric: number | null;
  sampleSize: number;
}

function computeGenerationSuccessForBucket(
  ops: BuildSloDrilldownInput['agentOperations'],
  bucket: BucketRange
): BucketObservation {
  let total = 0;
  let success = 0;
  for (const op of ops) {
    if (!op || !AGENT_EDIT_OPERATION_TYPES.has(op.operationType)) continue;
    const ms = safeParseDate(op.createdAt);
    if (ms === null || !isInBucket(ms, bucket)) continue;
    total += 1;
    if (AGENT_SUCCESS_STATUSES.has(op.status)) success += 1;
  }
  if (total === 0) return { observedNumeric: null, sampleSize: 0 };
  return { observedNumeric: (success / total) * 100, sampleSize: total };
}

function computeExportSuccessForBucket(
  exports: BuildSloDrilldownInput['exportRecords'],
  bucket: BucketRange
): BucketObservation {
  let total = 0;
  let success = 0;
  for (const row of exports) {
    if (!row) continue;
    const ms = safeParseDate(row.createdAt);
    if (ms === null || !isInBucket(ms, bucket)) continue;
    total += 1;
    if (row.status === 'completed') success += 1;
  }
  if (total === 0) return { observedNumeric: null, sampleSize: 0 };
  return { observedNumeric: (success / total) * 100, sampleSize: total };
}

function computeP95LatencyForBucket(
  exports: BuildSloDrilldownInput['exportRecords'],
  bucket: BucketRange
): BucketObservation {
  const samples: number[] = [];
  for (const row of exports) {
    if (!row || row.status !== 'completed') continue;
    const ms = safeParseDate(row.createdAt);
    if (ms === null || !isInBucket(ms, bucket)) continue;
    const dur = typeof row.durationMs === 'number' ? row.durationMs : null;
    if (dur !== null && Number.isFinite(dur) && dur >= 0) samples.push(dur);
  }
  if (samples.length === 0) return { observedNumeric: null, sampleSize: 0 };
  return { observedNumeric: p95(samples) ?? null, sampleSize: samples.length };
}

function computeAgentEditSuccessForBucket(
  events: BuildSloDrilldownInput['runtimeEvents'],
  bucket: BucketRange
): BucketObservation {
  let proposals = 0;
  let applied = 0;
  for (const evt of events) {
    if (!evt) continue;
    const ms = safeParseDate(evt.createdAt);
    if (ms === null || !isInBucket(ms, bucket)) continue;
    if (evt.eventType === 'agent_edit_proposal_created') proposals += 1;
    else if (evt.eventType === 'agent_edit_applied') applied += 1;
  }
  if (proposals === 0) return { observedNumeric: null, sampleSize: 0 };
  return { observedNumeric: (applied / proposals) * 100, sampleSize: proposals };
}

function computeExportBlockedRateForBucket(
  events: BuildSloDrilldownInput['runtimeEvents'],
  exports: BuildSloDrilldownInput['exportRecords'],
  bucket: BucketRange
): BucketObservation {
  let blocked = 0;
  let attempted = 0;
  for (const evt of events) {
    if (!evt) continue;
    const ms = safeParseDate(evt.createdAt);
    if (ms === null || !isInBucket(ms, bucket)) continue;
    if (evt.eventType === 'export_attempted') attempted += 1;
    else if (evt.eventType === 'export_blocked') blocked += 1;
  }
  if (attempted === 0) {
    for (const row of exports) {
      if (!row) continue;
      const ms = safeParseDate(row.createdAt);
      if (ms === null || !isInBucket(ms, bucket)) continue;
      attempted += 1;
    }
  }
  if (attempted === 0) return { observedNumeric: null, sampleSize: 0 };
  return { observedNumeric: (blocked / attempted) * 100, sampleSize: attempted };
}

function computeBucketObservation(
  sloId: DrilldownSloId,
  input: BuildSloDrilldownInput,
  bucket: BucketRange
): BucketObservation {
  switch (sloId) {
    case 'generation_success_rate':
      return computeGenerationSuccessForBucket(input.agentOperations || [], bucket);
    case 'export_success_rate':
      return computeExportSuccessForBucket(input.exportRecords || [], bucket);
    case 'p95_generation_latency_ms':
      return computeP95LatencyForBucket(input.exportRecords || [], bucket);
    case 'agent_edit_success_rate':
      return computeAgentEditSuccessForBucket(input.runtimeEvents || [], bucket);
    case 'export_blocked_rate':
      return computeExportBlockedRateForBucket(
        input.runtimeEvents || [],
        input.exportRecords || [],
        bucket
      );
    default:
      return { observedNumeric: null, sampleSize: 0 };
  }
}

// ---------------------------------------------------------------------------
// Top problematic decks
// ---------------------------------------------------------------------------

function deckTitleMap(decks: BuildSloDrilldownInput['decks']): Map<string, string> {
  const map = new Map<string, string>();
  for (const deck of decks || []) {
    if (!deck || !deck.id) continue;
    map.set(String(deck.id), String(deck.title || deck.id));
  }
  return map;
}

interface DeckAccumulator {
  deckId: string;
  total: number;
  failures: number;
  successes: number;
  durations: number[];
  blocked: number;
}

function ensureDeckAcc(buckets: Map<string, DeckAccumulator>, deckId: string): DeckAccumulator {
  const existing = buckets.get(deckId);
  if (existing) return existing;
  const fresh: DeckAccumulator = {
    deckId,
    total: 0,
    failures: 0,
    successes: 0,
    durations: [],
    blocked: 0,
  };
  buckets.set(deckId, fresh);
  return fresh;
}

function topDecksForSuccessSlo(
  acc: Map<string, DeckAccumulator>,
  titles: Map<string, string>
): TopProblematicDeck[] {
  const rows: TopProblematicDeck[] = [];
  for (const v of acc.values()) {
    if (v.total === 0) continue;
    rows.push({
      deckId: v.deckId,
      title: titles.get(v.deckId) ?? v.deckId,
      observedNumeric: (v.successes / v.total) * 100,
      failureCount: v.failures,
      totalCount: v.total,
    });
  }
  rows.sort((a, b) => {
    if (b.failureCount !== a.failureCount) return b.failureCount - a.failureCount;
    return b.totalCount - a.totalCount;
  });
  return rows.slice(0, MAX_TOP_DECKS);
}

function topDecksForLatency(
  acc: Map<string, DeckAccumulator>,
  titles: Map<string, string>
): TopProblematicDeck[] {
  const rows: TopProblematicDeck[] = [];
  for (const v of acc.values()) {
    if (v.durations.length === 0) continue;
    const observed =
      v.durations.length >= MIN_LATENCY_SAMPLES_FOR_VERDICT ? p95(v.durations) : mean(v.durations);
    rows.push({
      deckId: v.deckId,
      title: titles.get(v.deckId) ?? v.deckId,
      observedNumeric: observed,
      failureCount: v.failures,
      totalCount: v.durations.length,
    });
  }
  rows.sort((a, b) => {
    const an = a.observedNumeric ?? -Infinity;
    const bn = b.observedNumeric ?? -Infinity;
    if (bn !== an) return bn - an;
    return b.totalCount - a.totalCount;
  });
  return rows.slice(0, MAX_TOP_DECKS);
}

function topDecksForBlocked(
  acc: Map<string, DeckAccumulator>,
  titles: Map<string, string>
): TopProblematicDeck[] {
  const rows: TopProblematicDeck[] = [];
  for (const v of acc.values()) {
    if (v.total === 0 && v.blocked === 0) continue;
    const observed = v.total > 0 ? (v.blocked / v.total) * 100 : null;
    rows.push({
      deckId: v.deckId,
      title: titles.get(v.deckId) ?? v.deckId,
      observedNumeric: observed,
      failureCount: v.blocked,
      totalCount: v.total,
    });
  }
  rows.sort((a, b) => {
    if (b.failureCount !== a.failureCount) return b.failureCount - a.failureCount;
    return b.totalCount - a.totalCount;
  });
  return rows.slice(0, MAX_TOP_DECKS);
}

function buildTopDecks(
  sloId: DrilldownSloId,
  input: BuildSloDrilldownInput,
  windowStartMs: number,
  windowEndMs: number
): TopProblematicDeck[] {
  const titles = deckTitleMap(input.decks || []);
  const acc = new Map<string, DeckAccumulator>();
  const inWin = (ms: number | null) => ms !== null && ms >= windowStartMs && ms < windowEndMs;

  switch (sloId) {
    case 'generation_success_rate': {
      for (const op of input.agentOperations || []) {
        if (!op || !AGENT_EDIT_OPERATION_TYPES.has(op.operationType)) continue;
        const ms = safeParseDate(op.createdAt);
        if (!inWin(ms)) continue;
        const deckId = String(op.deckId || '');
        if (!deckId) continue;
        const deck = ensureDeckAcc(acc, deckId);
        deck.total += 1;
        if (AGENT_SUCCESS_STATUSES.has(op.status)) deck.successes += 1;
        else deck.failures += 1;
      }
      return topDecksForSuccessSlo(acc, titles);
    }
    case 'export_success_rate': {
      for (const row of input.exportRecords || []) {
        if (!row) continue;
        const ms = safeParseDate(row.createdAt);
        if (!inWin(ms)) continue;
        const deckId = String(row.deckId || '');
        if (!deckId) continue;
        const deck = ensureDeckAcc(acc, deckId);
        deck.total += 1;
        if (row.status === 'completed') deck.successes += 1;
        else deck.failures += 1;
      }
      return topDecksForSuccessSlo(acc, titles);
    }
    case 'p95_generation_latency_ms': {
      for (const row of input.exportRecords || []) {
        if (!row || row.status !== 'completed') continue;
        const ms = safeParseDate(row.createdAt);
        if (!inWin(ms)) continue;
        const deckId = String(row.deckId || '');
        if (!deckId) continue;
        const dur = typeof row.durationMs === 'number' ? row.durationMs : null;
        if (dur === null || !Number.isFinite(dur) || dur < 0) continue;
        const deck = ensureDeckAcc(acc, deckId);
        deck.durations.push(dur);
      }
      return topDecksForLatency(acc, titles);
    }
    case 'agent_edit_success_rate': {
      for (const evt of input.runtimeEvents || []) {
        if (!evt) continue;
        const ms = safeParseDate(evt.createdAt);
        if (!inWin(ms)) continue;
        const deckId = String(evt.deckId || '');
        if (!deckId) continue;
        if (
          evt.eventType !== 'agent_edit_proposal_created' &&
          evt.eventType !== 'agent_edit_applied'
        ) {
          continue;
        }
        const deck = ensureDeckAcc(acc, deckId);
        if (evt.eventType === 'agent_edit_proposal_created') deck.total += 1;
        else if (evt.eventType === 'agent_edit_applied') deck.successes += 1;
      }
      for (const v of acc.values()) {
        v.failures = Math.max(0, v.total - v.successes);
      }
      return topDecksForSuccessSlo(acc, titles);
    }
    case 'export_blocked_rate': {
      for (const evt of input.runtimeEvents || []) {
        if (!evt) continue;
        const ms = safeParseDate(evt.createdAt);
        if (!inWin(ms)) continue;
        const deckId = String(evt.deckId || '');
        if (!deckId) continue;
        if (evt.eventType !== 'export_attempted' && evt.eventType !== 'export_blocked') {
          continue;
        }
        const deck = ensureDeckAcc(acc, deckId);
        if (evt.eventType === 'export_attempted') deck.total += 1;
        if (evt.eventType === 'export_blocked') deck.blocked += 1;
      }
      // Fallback when explicit attempted events are missing for this deck:
      // count any export row for the deck inside the window as an attempt.
      const hasAnyAttempt = Array.from(acc.values()).some((v) => v.total > 0);
      if (!hasAnyAttempt) {
        for (const row of input.exportRecords || []) {
          if (!row) continue;
          const ms = safeParseDate(row.createdAt);
          if (!inWin(ms)) continue;
          const deckId = String(row.deckId || '');
          if (!deckId) continue;
          const deck = ensureDeckAcc(acc, deckId);
          deck.total += 1;
        }
      }
      return topDecksForBlocked(acc, titles);
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Recent samples — strict allow-listed excerpts
// ---------------------------------------------------------------------------

function formatDurationMs(ms: number): string {
  const rounded = Math.max(0, Math.round(ms));
  return `${rounded.toLocaleString()}ms`;
}

function excerptForExportRow(row: BuildSloDrilldownInput['exportRecords'][number]): string {
  const fmt = (row.format || 'export').toUpperCase();
  const dur =
    typeof row.durationMs === 'number' && Number.isFinite(row.durationMs) && row.durationMs >= 0
      ? formatDurationMs(row.durationMs)
      : null;
  switch (row.status) {
    case 'completed':
      return dur ? `Export completed: ${fmt} ${dur}` : `Export completed: ${fmt}`;
    case 'failed':
      return dur ? `Export failed: ${fmt} ${dur}` : `Export failed: ${fmt}`;
    case 'blocked':
      return `Export blocked: ${fmt}`;
    case 'started':
      return `Export started: ${fmt}`;
    default:
      return `Export ${row.status || 'unknown'}: ${fmt}`;
  }
}

function excerptForAgentOp(op: BuildSloDrilldownInput['agentOperations'][number]): string {
  switch (op.status) {
    case 'applied':
      return 'Edit applied';
    case 'accepted':
      return 'Edit accepted';
    case 'rejected':
      return 'Edit rejected';
    case 'failed':
      return 'Edit failed';
    case 'draft':
      return 'Edit drafted';
    default:
      return 'Edit recorded';
  }
}

function excerptForRuntimeEvent(
  evt: BuildSloDrilldownInput['runtimeEvents'][number]
): string | null {
  switch (evt.eventType) {
    case 'agent_edit_proposal_created':
      return 'Proposal created';
    case 'agent_edit_applied':
      return 'Proposal applied';
    case 'export_attempted':
      return 'Export attempted';
    case 'export_blocked':
      return 'Export blocked';
    default:
      return null;
  }
}

interface RawSampleEntry {
  occurredAt: string;
  occurredMs: number;
  deckId: string;
  type: string;
  status: string | null;
  durationMs: number | null;
  excerpt: string | null;
}

function pushSample(out: RawSampleEntry[], entry: RawSampleEntry): void {
  if (!entry.excerpt) return;
  out.push(entry);
}

function buildRecentSamples(
  sloId: DrilldownSloId,
  input: BuildSloDrilldownInput,
  windowStartMs: number,
  windowEndMs: number
): DrilldownEventSample[] {
  const out: RawSampleEntry[] = [];
  const inWin = (ms: number | null) => ms !== null && ms >= windowStartMs && ms < windowEndMs;

  if (sloId === 'generation_success_rate') {
    for (const op of input.agentOperations || []) {
      if (!op || !AGENT_EDIT_OPERATION_TYPES.has(op.operationType)) continue;
      const ms = safeParseDate(op.createdAt);
      if (!inWin(ms)) continue;
      pushSample(out, {
        occurredAt: op.createdAt,
        occurredMs: ms!,
        deckId: String(op.deckId || ''),
        type: op.operationType,
        status: op.status || null,
        durationMs: null,
        excerpt: excerptForAgentOp(op),
      });
    }
  } else if (sloId === 'export_success_rate' || sloId === 'p95_generation_latency_ms') {
    for (const row of input.exportRecords || []) {
      if (!row) continue;
      const ms = safeParseDate(row.createdAt);
      if (!inWin(ms)) continue;
      pushSample(out, {
        occurredAt: row.createdAt,
        occurredMs: ms!,
        deckId: String(row.deckId || ''),
        type: 'export',
        status: row.status || null,
        durationMs:
          typeof row.durationMs === 'number' && Number.isFinite(row.durationMs)
            ? row.durationMs
            : null,
        excerpt: excerptForExportRow(row),
      });
    }
  } else if (sloId === 'agent_edit_success_rate') {
    for (const evt of input.runtimeEvents || []) {
      if (!evt) continue;
      if (
        evt.eventType !== 'agent_edit_proposal_created' &&
        evt.eventType !== 'agent_edit_applied'
      ) {
        continue;
      }
      const ms = safeParseDate(evt.createdAt);
      if (!inWin(ms)) continue;
      pushSample(out, {
        occurredAt: evt.createdAt,
        occurredMs: ms!,
        deckId: String(evt.deckId || ''),
        type: evt.eventType,
        status: null,
        durationMs: null,
        excerpt: excerptForRuntimeEvent(evt),
      });
    }
  } else if (sloId === 'export_blocked_rate') {
    for (const evt of input.runtimeEvents || []) {
      if (!evt) continue;
      if (evt.eventType !== 'export_attempted' && evt.eventType !== 'export_blocked') {
        continue;
      }
      const ms = safeParseDate(evt.createdAt);
      if (!inWin(ms)) continue;
      pushSample(out, {
        occurredAt: evt.createdAt,
        occurredMs: ms!,
        deckId: String(evt.deckId || ''),
        type: evt.eventType,
        status: null,
        durationMs: null,
        excerpt: excerptForRuntimeEvent(evt),
      });
    }
  }

  out.sort((a, b) => b.occurredMs - a.occurredMs);
  return out.slice(0, MAX_RECENT_SAMPLES).map((e) => ({
    occurredAt: e.occurredAt,
    deckId: e.deckId,
    type: e.type,
    status: e.status,
    durationMs: e.durationMs,
    excerpt: e.excerpt,
  }));
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function buildSloDrilldownReport(input: BuildSloDrilldownInput): SloDrilldownReport {
  const sloId = input.sloId;
  const windowDays = clampPositiveInt(Number(input.windowDays), 1, 90, 30);
  const bucketDays = clampPositiveInt(Number(input.bucketDays), 1, 7, 1);
  const nowMs = safeParseDate(input.nowIso) ?? 0;

  const warnings: string[] = [];
  if (!Array.isArray(input.runtimeEvents)) warnings.push('runtime_events_unavailable');
  if (!Array.isArray(input.exportRecords)) warnings.push('exports_unavailable');
  if (!Array.isArray(input.agentOperations)) warnings.push('agent_operations_unavailable');
  if (!Array.isArray(input.decks)) warnings.push('decks_unavailable');

  const safeInput: BuildSloDrilldownInput = {
    ...input,
    windowDays,
    bucketDays,
    runtimeEvents: Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [],
    exportRecords: Array.isArray(input.exportRecords) ? input.exportRecords : [],
    agentOperations: Array.isArray(input.agentOperations) ? input.agentOperations : [],
    decks: Array.isArray(input.decks) ? input.decks : [],
  };

  const buckets = buildBuckets(nowMs, windowDays, bucketDays);
  const trend: TrendPoint[] = buckets.map((b) => {
    const obs = computeBucketObservation(sloId, safeInput, b);
    return {
      bucketStart: new Date(b.startMs).toISOString(),
      bucketEnd: new Date(b.endMs).toISOString(),
      observedNumeric: obs.observedNumeric,
      status: classifySloStatus(sloId, obs.observedNumeric, obs.sampleSize),
      sampleSize: obs.sampleSize,
    };
  });

  const windowStartMs = buckets.length > 0 ? buckets[0]!.startMs : nowMs;
  const windowEndMs = buckets.length > 0 ? buckets[buckets.length - 1]!.endMs : nowMs;

  const topProblematicDecks = buildTopDecks(sloId, safeInput, windowStartMs, windowEndMs);
  const recentSamples = buildRecentSamples(sloId, safeInput, windowStartMs, windowEndMs);

  return {
    sloId,
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    bucketDays,
    trend,
    topProblematicDecks,
    recentSamples,
    warnings,
  };
}
