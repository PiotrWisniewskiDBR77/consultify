/**
 * Presentation Weekly Digest Service
 *
 * Pure aggregation that converts already-fetched rows (decks, runtime events,
 * exports, agent ops, governance verdicts) for a single organization into a
 * structured `DigestReport` plus an optional Markdown rendering.
 *
 * Side-effect-free. No DB access, no `Date.now()`, no I/O. The caller (the
 * `weekly-presentation-digest.ts` script) is responsible for fetching rows
 * and persisting outputs.
 *
 * Cross-check precedence for proposal lifecycle counters:
 *   - Telemetry-first: runtime events (`presentation_runtime_events`) are the
 *     primary source of truth for `proposalsCreated`, `proposalsApplied`,
 *     `proposalsRejected`, and `proposalsReverted`.
 *   - Ops fallback: when a category has zero matching runtime events but the
 *     `presentation_ai_operations` rows for the same window contain matching
 *     statuses (`applied`, `rejected`, `reverted`), the ops-derived count is
 *     used and a warning (`telemetry_fallback_to_ops:<category>`) is emitted.
 *   - `proposalsCreated` is telemetry-only (no equivalent ops status).
 */

export interface DigestInputDeck {
  id: string;
  title: string;
  updatedAt: string | null;
}

export interface DigestInputRuntimeEvent {
  deckId: string;
  eventType: string;
  createdAt: string;
}

export interface DigestInputExport {
  deckId: string;
  status: string;
  format: string;
  createdAt: string;
}

export interface DigestInputAgentOp {
  deckId: string;
  status: string;
  operationType: string;
  createdAt: string;
}

export interface DigestInputGovernanceVerdict {
  deckId: string;
  verdict: string;
}

export interface DigestInput {
  organizationId: string;
  windowStart: string;
  windowEnd: string;
  decks: DigestInputDeck[];
  runtimeEvents: DigestInputRuntimeEvent[];
  exports: DigestInputExport[];
  agentOps: DigestInputAgentOp[];
  governanceVerdicts: DigestInputGovernanceVerdict[];
}

export interface DigestGovernanceTotals {
  pass: number;
  passWithP2: number;
  blockedP1: number;
  blockedP0: number;
  inconclusive: number;
}

export interface DigestTotals {
  decks: number;
  proposalsCreated: number;
  proposalsApplied: number;
  proposalsRejected: number;
  proposalsReverted: number;
  exportsAttempted: number;
  exportsBlocked: number;
  exportsSucceeded: number;
  governance: DigestGovernanceTotals;
}

export interface DigestTopActiveDeck {
  deckId: string;
  title: string;
  activityCount: number;
}

export interface DigestTopBlockedDeck {
  deckId: string;
  title: string;
  verdict: string;
}

export interface DigestReport {
  organizationId: string;
  windowStart: string;
  windowEnd: string;
  totals: DigestTotals;
  topActiveDecks: DigestTopActiveDeck[];
  topBlockedDecks: DigestTopBlockedDeck[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUNTIME_EVENT_PROPOSAL_CREATED = 'agent_edit_proposal_created';
const RUNTIME_EVENT_APPLIED = 'agent_edit_applied';
const RUNTIME_EVENT_REJECTED = 'agent_edit_rejected';
const RUNTIME_EVENT_REVERTED = 'agent_edit_reverted';

const OPS_STATUS_APPLIED = 'applied';
const OPS_STATUS_REJECTED = 'rejected';
const OPS_STATUS_REVERTED = 'reverted';

const EXPORT_STATUS_COMPLETED = 'completed';
const EXPORT_STATUS_BLOCKED = 'blocked';

const VERDICT_PASS = 'PASS';
const VERDICT_PASS_WITH_P2 = 'PASS_WITH_P2';
const VERDICT_BLOCKED_P1 = 'BLOCKED_P1';
const VERDICT_BLOCKED_P0 = 'BLOCKED_P0';
const VERDICT_INCONCLUSIVE = 'INCONCLUSIVE';

const TOP_ACTIVE_LIMIT = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeString(value: string | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

function buildDeckTitleIndex(decks: DigestInputDeck[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const deck of decks) {
    if (deck && typeof deck.id === 'string' && deck.id.length > 0) {
      map.set(
        deck.id,
        typeof deck.title === 'string' && deck.title.length > 0 ? deck.title : deck.id
      );
    }
  }
  return map;
}

function countRuntimeEvents(events: DigestInputRuntimeEvent[], type: string): number {
  let n = 0;
  for (const event of events) {
    if (event && safeString(event.eventType) === type) n += 1;
  }
  return n;
}

function countOpsByStatus(ops: DigestInputAgentOp[], status: string): number {
  let n = 0;
  const target = status.toLowerCase();
  for (const op of ops) {
    if (op && safeString(op.status).toLowerCase() === target) n += 1;
  }
  return n;
}

function countExportsByStatus(exports: DigestInputExport[], status: string): number {
  let n = 0;
  const target = status.toLowerCase();
  for (const exp of exports) {
    if (exp && safeString(exp.status).toLowerCase() === target) n += 1;
  }
  return n;
}

function buildActivityCounts(input: DigestInput): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (deckId: string | null | undefined): void => {
    const id = safeString(deckId);
    if (!id) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  };
  for (const event of safeArray(input.runtimeEvents)) bump(event?.deckId);
  for (const op of safeArray(input.agentOps)) bump(op?.deckId);
  for (const exp of safeArray(input.exports)) bump(exp?.deckId);
  return counts;
}

function buildTopActiveDecks(
  counts: Map<string, number>,
  titleIndex: Map<string, string>
): DigestTopActiveDeck[] {
  const entries: DigestTopActiveDeck[] = [];
  for (const [deckId, activityCount] of counts.entries()) {
    if (activityCount <= 0) continue;
    entries.push({
      deckId,
      title: titleIndex.get(deckId) || deckId,
      activityCount,
    });
  }
  entries.sort((a, b) => {
    if (b.activityCount !== a.activityCount) return b.activityCount - a.activityCount;
    return a.deckId.localeCompare(b.deckId);
  });
  return entries.slice(0, TOP_ACTIVE_LIMIT);
}

function verdictBlockedRank(verdict: string): number {
  if (verdict === VERDICT_BLOCKED_P0) return 0;
  if (verdict === VERDICT_BLOCKED_P1) return 1;
  return 2;
}

function buildTopBlockedDecks(
  verdicts: DigestInputGovernanceVerdict[],
  titleIndex: Map<string, string>
): DigestTopBlockedDeck[] {
  const blocked: DigestTopBlockedDeck[] = [];
  for (const entry of verdicts) {
    const verdict = safeString(entry?.verdict);
    if (verdict !== VERDICT_BLOCKED_P0 && verdict !== VERDICT_BLOCKED_P1) continue;
    const deckId = safeString(entry?.deckId);
    if (!deckId) continue;
    blocked.push({
      deckId,
      title: titleIndex.get(deckId) || deckId,
      verdict,
    });
  }
  blocked.sort((a, b) => {
    const rankDelta = verdictBlockedRank(a.verdict) - verdictBlockedRank(b.verdict);
    if (rankDelta !== 0) return rankDelta;
    return a.deckId.localeCompare(b.deckId);
  });
  return blocked;
}

function buildGovernanceTotals(verdicts: DigestInputGovernanceVerdict[]): DigestGovernanceTotals {
  const totals: DigestGovernanceTotals = {
    pass: 0,
    passWithP2: 0,
    blockedP1: 0,
    blockedP0: 0,
    inconclusive: 0,
  };
  for (const entry of verdicts) {
    const verdict = safeString(entry?.verdict);
    if (verdict === VERDICT_PASS) totals.pass += 1;
    else if (verdict === VERDICT_PASS_WITH_P2) totals.passWithP2 += 1;
    else if (verdict === VERDICT_BLOCKED_P1) totals.blockedP1 += 1;
    else if (verdict === VERDICT_BLOCKED_P0) totals.blockedP0 += 1;
    else if (verdict === VERDICT_INCONCLUSIVE) totals.inconclusive += 1;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a deterministic, side-effect-free weekly digest report for a single
 * organization from already-fetched rows. See file-level JSDoc for the
 * telemetry-first / ops-fallback precedence applied to proposal counters.
 */
export function buildWeeklyDigest(input: DigestInput): DigestReport {
  const warnings: string[] = [];
  const runtimeEvents = safeArray(input.runtimeEvents);
  const exportsRows = safeArray(input.exports);
  const agentOps = safeArray(input.agentOps);
  const verdicts = safeArray(input.governanceVerdicts);
  const decks = safeArray(input.decks);

  const titleIndex = buildDeckTitleIndex(decks);

  const proposalsCreated = countRuntimeEvents(runtimeEvents, RUNTIME_EVENT_PROPOSAL_CREATED);

  const appliedFromTelemetry = countRuntimeEvents(runtimeEvents, RUNTIME_EVENT_APPLIED);
  const rejectedFromTelemetry = countRuntimeEvents(runtimeEvents, RUNTIME_EVENT_REJECTED);
  const revertedFromTelemetry = countRuntimeEvents(runtimeEvents, RUNTIME_EVENT_REVERTED);

  const appliedFromOps = countOpsByStatus(agentOps, OPS_STATUS_APPLIED);
  const rejectedFromOps = countOpsByStatus(agentOps, OPS_STATUS_REJECTED);
  const revertedFromOps = countOpsByStatus(agentOps, OPS_STATUS_REVERTED);

  let proposalsApplied = appliedFromTelemetry;
  let proposalsRejected = rejectedFromTelemetry;
  let proposalsReverted = revertedFromTelemetry;

  if (appliedFromTelemetry === 0 && appliedFromOps > 0) {
    proposalsApplied = appliedFromOps;
    warnings.push('telemetry_fallback_to_ops:applied');
  }
  if (rejectedFromTelemetry === 0 && rejectedFromOps > 0) {
    proposalsRejected = rejectedFromOps;
    warnings.push('telemetry_fallback_to_ops:rejected');
  }
  if (revertedFromTelemetry === 0 && revertedFromOps > 0) {
    proposalsReverted = revertedFromOps;
    warnings.push('telemetry_fallback_to_ops:reverted');
  }

  const exportsAttempted = exportsRows.length;
  const exportsBlocked = countExportsByStatus(exportsRows, EXPORT_STATUS_BLOCKED);
  const exportsSucceeded = countExportsByStatus(exportsRows, EXPORT_STATUS_COMPLETED);

  const governance = buildGovernanceTotals(verdicts);
  const activityCounts = buildActivityCounts(input);
  const topActiveDecks = buildTopActiveDecks(activityCounts, titleIndex);
  const topBlockedDecks = buildTopBlockedDecks(verdicts, titleIndex);

  const totals: DigestTotals = {
    decks: decks.length,
    proposalsCreated,
    proposalsApplied,
    proposalsRejected,
    proposalsReverted,
    exportsAttempted,
    exportsBlocked,
    exportsSucceeded,
    governance,
  };

  return {
    organizationId: input.organizationId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    totals,
    topActiveDecks,
    topBlockedDecks,
    warnings,
  };
}

/**
 * Render a DigestReport as a Markdown document for runbooks, ops channels, or
 * email digests. Deterministic and stable for the same input.
 */
export function digestToMarkdown(report: DigestReport): string {
  const lines: string[] = [];
  lines.push('# Presentation Weekly Digest');
  lines.push('');
  lines.push(`- Organization: \`${report.organizationId}\``);
  lines.push(`- Window start: \`${report.windowStart}\``);
  lines.push(`- Window end: \`${report.windowEnd}\``);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Decks (catalog snapshot) | ${report.totals.decks} |`);
  lines.push(`| Proposals created | ${report.totals.proposalsCreated} |`);
  lines.push(`| Proposals applied | ${report.totals.proposalsApplied} |`);
  lines.push(`| Proposals rejected | ${report.totals.proposalsRejected} |`);
  lines.push(`| Proposals reverted | ${report.totals.proposalsReverted} |`);
  lines.push(`| Exports attempted | ${report.totals.exportsAttempted} |`);
  lines.push(`| Exports succeeded | ${report.totals.exportsSucceeded} |`);
  lines.push(`| Exports blocked | ${report.totals.exportsBlocked} |`);
  lines.push(`| Governance PASS | ${report.totals.governance.pass} |`);
  lines.push(`| Governance PASS_WITH_P2 | ${report.totals.governance.passWithP2} |`);
  lines.push(`| Governance BLOCKED_P1 | ${report.totals.governance.blockedP1} |`);
  lines.push(`| Governance BLOCKED_P0 | ${report.totals.governance.blockedP0} |`);
  lines.push(`| Governance INCONCLUSIVE | ${report.totals.governance.inconclusive} |`);
  lines.push('');

  lines.push('## Top Active Decks');
  lines.push('');
  if (report.topActiveDecks.length === 0) {
    lines.push('_No deck activity in the window._');
  } else {
    lines.push('| Deck | Title | Activity |');
    lines.push('| --- | --- | ---: |');
    for (const deck of report.topActiveDecks) {
      lines.push(`| \`${deck.deckId}\` | ${deck.title} | ${deck.activityCount} |`);
    }
  }
  lines.push('');

  lines.push('## Top Blocked Decks');
  lines.push('');
  if (report.topBlockedDecks.length === 0) {
    lines.push('_No blocked decks at window end._');
  } else {
    lines.push('| Deck | Title | Verdict |');
    lines.push('| --- | --- | --- |');
    for (const deck of report.topBlockedDecks) {
      lines.push(`| \`${deck.deckId}\` | ${deck.title} | ${deck.verdict} |`);
    }
  }
  lines.push('');

  lines.push('## Warnings');
  lines.push('');
  if (report.warnings.length === 0) {
    lines.push('_None._');
  } else {
    for (const warning of report.warnings) {
      lines.push(`- \`${warning}\``);
    }
  }
  lines.push('');

  return lines.join('\n');
}
