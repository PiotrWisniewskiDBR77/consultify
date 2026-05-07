/**
 * Presentation Benchmark Scorecard Service (Epic H1)
 *
 * Pure-logic core for the monthly DBR77/VTS benchmark scorecard cadence.
 * Computes per-dimension averages from per-deck judge scores, derives the
 * verdict against fixed thresholds, builds per-dimension deltas vs the
 * prior run, and renders a deterministic Markdown report.
 *
 * The compute / verdict / render functions are pure: no I/O, no logging,
 * never throw. The DB helpers (`persistBenchmarkRun`,
 * `fetchPriorBenchmarkRun`, `listBenchmarkRunHistory`) are schema-tolerant
 * and return `storage_error` instead of bubbling up missing-table errors.
 *
 * Backed by migration `768_presentation_benchmark_runs.sql`.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BenchmarkDimension =
  | 'content_quality'
  | 'visual_design'
  | 'long_context_processing'
  | 'api_automation'
  | 'conversational_editing';

export type BenchmarkVerdict = 'PASS' | 'PASS_WITH_WARNINGS' | 'BLOCK';

export interface DeckScoreInput {
  deckId: string;
  deckTitle: string;
  contentQuality: number;
  visualDesign: number;
  longContextProcessing: number;
  apiAutomation: number;
  conversationalEditing: number;
  notes?: string;
}

export interface BenchmarkRunInput {
  runLabel: string;
  organizationId: string;
  referenceSet: string;
  reportedBy?: string;
  notes?: string;
  decks: DeckScoreInput[];
  priorRun?: BenchmarkRunRecord | null;
  gammaTarget?: number;
}

export interface BenchmarkRunRecord {
  id?: string;
  organizationId: string;
  runLabel: string;
  referenceSet: string;
  totalDecksScored: number;
  scores: Record<BenchmarkDimension, number>;
  verdict: BenchmarkVerdict;
  deltaVsPrior: Record<BenchmarkDimension, number> | null;
  notes: string | null;
  reportedBy: string | null;
  createdAt: string;
}

export interface PersistResult {
  status: 'ok' | 'duplicate' | 'storage_error';
  id?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GAMMA_TARGET = 4.0;
export const WARNING_THRESHOLD = 3.5;

export const BENCHMARK_DIMENSIONS: ReadonlyArray<BenchmarkDimension> = [
  'content_quality',
  'visual_design',
  'long_context_processing',
  'api_automation',
  'conversational_editing',
];

const DIMENSION_LABELS: Record<BenchmarkDimension, string> = {
  content_quality: 'Content Quality',
  visual_design: 'Visual Design',
  long_context_processing: 'Long-Context Processing',
  api_automation: 'API & Automation',
  conversational_editing: 'Conversational Editing',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyScores(): Record<BenchmarkDimension, number> {
  return {
    content_quality: 0,
    visual_design: 0,
    long_context_processing: 0,
    api_automation: 0,
    conversational_editing: 0,
  };
}

function clamp(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 5) return 5;
  return num;
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function deckDimensionValue(deck: DeckScoreInput, dim: BenchmarkDimension): number {
  switch (dim) {
    case 'content_quality':
      return clamp(deck.contentQuality);
    case 'visual_design':
      return clamp(deck.visualDesign);
    case 'long_context_processing':
      return clamp(deck.longContextProcessing);
    case 'api_automation':
      return clamp(deck.apiAutomation);
    case 'conversational_editing':
      return clamp(deck.conversationalEditing);
    default:
      return 0;
  }
}

function statusFor(score: number, gammaTarget: number): 'OK' | '~' | 'FAIL' {
  if (score >= gammaTarget) return 'OK';
  if (score >= WARNING_THRESHOLD) return '~';
  return 'FAIL';
}

function safeDecks(decks: unknown): DeckScoreInput[] {
  if (!Array.isArray(decks)) return [];
  const out: DeckScoreInput[] = [];
  for (const raw of decks) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Partial<DeckScoreInput>;
    out.push({
      deckId: typeof r.deckId === 'string' ? r.deckId : '',
      deckTitle: typeof r.deckTitle === 'string' ? r.deckTitle : '',
      contentQuality: clamp(r.contentQuality),
      visualDesign: clamp(r.visualDesign),
      longContextProcessing: clamp(r.longContextProcessing),
      apiAutomation: clamp(r.apiAutomation),
      conversationalEditing: clamp(r.conversationalEditing),
      notes: typeof r.notes === 'string' ? r.notes : undefined,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pure logic: verdict, scorecard, render
// ---------------------------------------------------------------------------

export function computeVerdict(
  scores: Record<BenchmarkDimension, number>,
  gammaTarget: number = GAMMA_TARGET
): BenchmarkVerdict {
  const target = Number.isFinite(gammaTarget) ? gammaTarget : GAMMA_TARGET;
  let allMeetTarget = true;
  let anyBelowWarn = false;

  for (const dim of BENCHMARK_DIMENSIONS) {
    const value = Number.isFinite(scores[dim]) ? scores[dim] : 0;
    if (value < target) allMeetTarget = false;
    if (value < WARNING_THRESHOLD) anyBelowWarn = true;
  }

  if (anyBelowWarn) return 'BLOCK';
  if (allMeetTarget) return 'PASS';
  return 'PASS_WITH_WARNINGS';
}

export function computeBenchmarkScorecard(input: BenchmarkRunInput): BenchmarkRunRecord {
  const safeInput: BenchmarkRunInput = {
    runLabel: typeof input?.runLabel === 'string' ? input.runLabel : '',
    organizationId: typeof input?.organizationId === 'string' ? input.organizationId : '',
    referenceSet:
      typeof input?.referenceSet === 'string' && input.referenceSet.trim().length > 0
        ? input.referenceSet
        : 'DBR77+VTS',
    reportedBy: typeof input?.reportedBy === 'string' ? input.reportedBy : undefined,
    notes: typeof input?.notes === 'string' ? input.notes : undefined,
    decks: safeDecks(input?.decks),
    priorRun: input?.priorRun ?? null,
    gammaTarget: typeof input?.gammaTarget === 'number' ? input.gammaTarget : GAMMA_TARGET,
  };

  const scores = emptyScores();
  if (safeInput.decks.length > 0) {
    for (const dim of BENCHMARK_DIMENSIONS) {
      let total = 0;
      for (const deck of safeInput.decks) total += deckDimensionValue(deck, dim);
      scores[dim] = round2(total / safeInput.decks.length);
    }
  }

  const verdict = computeVerdict(scores, safeInput.gammaTarget);

  let deltaVsPrior: Record<BenchmarkDimension, number> | null = null;
  if (safeInput.priorRun && safeInput.priorRun.scores) {
    deltaVsPrior = emptyScores();
    for (const dim of BENCHMARK_DIMENSIONS) {
      const current = Number.isFinite(scores[dim]) ? scores[dim] : 0;
      const priorRaw = (safeInput.priorRun.scores as Record<string, unknown>)[dim];
      const prior = typeof priorRaw === 'number' && Number.isFinite(priorRaw) ? priorRaw : 0;
      deltaVsPrior[dim] = round2(current - prior);
    }
  }

  return {
    organizationId: safeInput.organizationId,
    runLabel: safeInput.runLabel,
    referenceSet: safeInput.referenceSet,
    totalDecksScored: safeInput.decks.length,
    scores,
    verdict,
    deltaVsPrior,
    notes: safeInput.notes ?? null,
    reportedBy: safeInput.reportedBy ?? null,
    createdAt: new Date(0).toISOString(),
  };
}

export function renderBenchmarkScorecardMarkdown(
  record: BenchmarkRunRecord,
  opts?: { gammaTarget?: number }
): string {
  if (!record || typeof record !== 'object') {
    return '# Presentation Benchmark Scorecard\n\nVerdict: BLOCK (invalid record)\n';
  }

  const gammaTarget = opts && typeof opts.gammaTarget === 'number' ? opts.gammaTarget : GAMMA_TARGET;
  const lines: string[] = [];

  const runLabel = record.runLabel || '(unknown run)';
  const referenceSet = record.referenceSet || '(unspecified)';

  lines.push(`# Presentation Benchmark Scorecard - ${runLabel}`);
  lines.push('');
  lines.push(`Verdict: ${record.verdict}`);
  lines.push(`Reference set: ${referenceSet}`);
  lines.push(`Decks scored: ${record.totalDecksScored}`);
  lines.push(`Gamma target: ${gammaTarget.toFixed(2)} (warning floor: ${WARNING_THRESHOLD.toFixed(2)})`);
  lines.push('');
  lines.push('| Dimension | Current | Prior | Delta | Status |');
  lines.push('| --- | ---: | ---: | ---: | --- |');

  const deltaEntries: Array<{ dim: BenchmarkDimension; delta: number }> = [];

  for (const dim of BENCHMARK_DIMENSIONS) {
    const current = Number.isFinite(record.scores?.[dim]) ? record.scores[dim] : 0;
    const status = statusFor(current, gammaTarget);

    let priorCell = '-';
    let deltaCell = '-';
    if (record.deltaVsPrior && Number.isFinite(record.deltaVsPrior[dim])) {
      const delta = record.deltaVsPrior[dim];
      const prior = round2(current - delta);
      priorCell = prior.toFixed(2);
      const sign = delta > 0 ? '+' : '';
      deltaCell = `${sign}${delta.toFixed(2)}`;
      deltaEntries.push({ dim, delta });
    }

    lines.push(
      `| ${DIMENSION_LABELS[dim]} | ${current.toFixed(2)} | ${priorCell} | ${deltaCell} | ${status} |`
    );
  }

  lines.push('');

  if (deltaEntries.length > 0) {
    const movements = [...deltaEntries].sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta)
    );
    const top = movements.slice(0, Math.min(3, movements.length));
    if (top.some((entry) => Math.abs(entry.delta) > 0)) {
      lines.push('## Largest movements vs prior run');
      lines.push('');
      for (const entry of top) {
        const sign = entry.delta > 0 ? '+' : '';
        lines.push(`- ${DIMENSION_LABELS[entry.dim]}: ${sign}${entry.delta.toFixed(2)}`);
      }
      lines.push('');
    } else {
      lines.push('## Largest movements vs prior run');
      lines.push('');
      lines.push('- No dimension changed vs prior run.');
      lines.push('');
    }
  } else {
    lines.push('## Largest movements vs prior run');
    lines.push('');
    lines.push('- No prior run available; treat current scores as the new baseline.');
    lines.push('');
  }

  if (typeof record.notes === 'string' && record.notes.trim().length > 0) {
    lines.push('## Notes');
    lines.push('');
    lines.push(record.notes.trim());
    lines.push('');
  }

  lines.push('---');
  const reportedBy = record.reportedBy && record.reportedBy.length > 0 ? record.reportedBy : 'unknown';
  const createdAt = record.createdAt && record.createdAt.length > 0 ? record.createdAt : 'pending';
  lines.push(`Reported by: ${reportedBy} | Created at: ${createdAt}`);

  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// DB helpers — schema-tolerant
// ---------------------------------------------------------------------------

interface BenchmarkRunRow {
  id?: unknown;
  organization_id?: unknown;
  run_label?: unknown;
  reference_set?: unknown;
  total_decks_scored?: unknown;
  scores?: unknown;
  verdict?: unknown;
  delta_vs_prior?: unknown;
  notes?: unknown;
  reported_by?: unknown;
  created_at?: unknown;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseJsonField(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeDimensionMap(raw: Record<string, unknown> | null): Record<BenchmarkDimension, number> {
  const out = emptyScores();
  if (!raw) return out;
  for (const dim of BENCHMARK_DIMENSIONS) {
    const value = raw[dim];
    if (typeof value === 'number' && Number.isFinite(value)) out[dim] = round2(value);
    else if (typeof value === 'string') {
      const num = Number(value);
      if (Number.isFinite(num)) out[dim] = round2(num);
    }
  }
  return out;
}

function rowToRecord(row: BenchmarkRunRow): BenchmarkRunRecord {
  const verdictRaw = asString(row.verdict).toUpperCase();
  const verdict: BenchmarkVerdict =
    verdictRaw === 'PASS' || verdictRaw === 'PASS_WITH_WARNINGS' || verdictRaw === 'BLOCK'
      ? (verdictRaw as BenchmarkVerdict)
      : 'BLOCK';

  const scores = normalizeDimensionMap(parseJsonField(row.scores));
  const deltaJson = parseJsonField(row.delta_vs_prior);
  const deltaVsPrior = deltaJson === null ? null : normalizeDimensionMap(deltaJson);

  return {
    id: asString(row.id) || undefined,
    organizationId: asString(row.organization_id),
    runLabel: asString(row.run_label),
    referenceSet: asString(row.reference_set),
    totalDecksScored: Math.max(0, Math.round(asNumber(row.total_decks_scored))),
    scores,
    verdict,
    deltaVsPrior,
    notes: row.notes == null ? null : asString(row.notes) || null,
    reportedBy: row.reported_by == null ? null : asString(row.reported_by) || null,
    createdAt: asString(row.created_at),
  };
}

function isDuplicateError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('duplicate key') ||
    lower.includes('unique constraint') ||
    lower.includes('unique violation') ||
    lower.includes('unique')
  );
}

function isSchemaMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('no such table') ||
    lower.includes('does not exist') ||
    lower.includes('relation') ||
    lower.includes('database not initialized')
  );
}

export async function persistBenchmarkRun(record: BenchmarkRunRecord): Promise<PersistResult> {
  if (!record || typeof record !== 'object') {
    return { status: 'storage_error', reason: 'invalid_record' };
  }
  if (!record.organizationId || !record.runLabel) {
    return { status: 'storage_error', reason: 'missing_keys' };
  }

  try {
    const result = await dbRun(
      `INSERT INTO presentation_benchmark_runs (
         organization_id,
         run_label,
         reference_set,
         total_decks_scored,
         scores,
         verdict,
         delta_vs_prior,
         notes,
         reported_by
       ) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?::jsonb, ?, ?)
       RETURNING id`,
      [
        record.organizationId,
        record.runLabel,
        record.referenceSet || 'DBR77+VTS',
        record.totalDecksScored,
        JSON.stringify(record.scores || emptyScores()),
        record.verdict,
        record.deltaVsPrior == null ? null : JSON.stringify(record.deltaVsPrior),
        record.notes,
        record.reportedBy,
      ],
      { fallback: false }
    );

    if (!result.success) {
      const reason = result.error || 'unknown_error';
      if (isDuplicateError(reason)) return { status: 'duplicate', reason };
      if (isSchemaMissing(reason)) return { status: 'storage_error', reason: 'schema_missing' };
      return { status: 'storage_error', reason };
    }

    return { status: 'ok', id: typeof result.lastID === 'string' ? result.lastID : undefined };
  } catch (error) {
    const message = String((error as { message?: unknown })?.message ?? error ?? '');
    if (isDuplicateError(message)) return { status: 'duplicate', reason: message };
    if (isSchemaMissing(message)) return { status: 'storage_error', reason: 'schema_missing' };
    return { status: 'storage_error', reason: message || 'unknown_error' };
  }
}

export async function fetchPriorBenchmarkRun(
  orgId: string,
  runLabel: string,
  referenceSet: string
): Promise<BenchmarkRunRecord | null> {
  if (!orgId || !runLabel) return null;
  try {
    const row = await dbGet<BenchmarkRunRow>(
      `SELECT id, organization_id, run_label, reference_set, total_decks_scored,
              scores, verdict, delta_vs_prior, notes, reported_by, created_at
         FROM presentation_benchmark_runs
        WHERE organization_id = ?
          AND reference_set = ?
          AND run_label < ?
        ORDER BY run_label DESC
        LIMIT 1`,
      [orgId, referenceSet || 'DBR77+VTS', runLabel],
      { fallback: true }
    );
    if (!row) return null;
    return rowToRecord(row);
  } catch {
    return null;
  }
}

export async function listBenchmarkRunHistory(
  orgId: string,
  opts?: { limit?: number; referenceSet?: string }
): Promise<BenchmarkRunRecord[]> {
  if (!orgId) return [];
  const limit = Math.max(1, Math.min(100, Math.round(opts?.limit ?? 12)));

  try {
    const params: unknown[] = [orgId];
    let referenceClause = '';
    if (opts?.referenceSet && opts.referenceSet.trim().length > 0) {
      referenceClause = ' AND reference_set = ?';
      params.push(opts.referenceSet.trim());
    }
    const rows = await dbAll<BenchmarkRunRow>(
      `SELECT id, organization_id, run_label, reference_set, total_decks_scored,
              scores, verdict, delta_vs_prior, notes, reported_by, created_at
         FROM presentation_benchmark_runs
        WHERE organization_id = ?${referenceClause}
        ORDER BY run_label DESC
        LIMIT ${limit}`,
      params,
      { fallback: true }
    );
    return rows.map(rowToRecord);
  } catch {
    return [];
  }
}
