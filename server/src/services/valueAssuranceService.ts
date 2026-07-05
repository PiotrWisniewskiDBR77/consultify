/**
 * Value Assurance Service (M16/3.7)
 *
 * CFO-grade attestation of value evidence. Pure, side-effect-free functions
 * that grade whether a claimed value figure is *trustworthy* — i.e. attested
 * by an accountable owner, backed by provenance, and reconciled against the
 * underlying evidence. This is the assurance layer a CFO relies on before a
 * realized benefit is reported as "banked".
 *
 * Three public functions:
 *   1. assuranceStatus  — per-item attestation verdict + flags
 *   2. assuranceAlerts  — portfolio-level red flags (3 alert types)
 *   3. assuranceSummary — CFO dashboard aggregate
 *
 * No I/O, no DB, no logging. Deterministic given inputs.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Verdict for a single value claim. */
export type AssuranceStatusValue = 'attested' | 'unverified' | 'disputed';

/** Alert categories surfaced to the CFO dashboard. */
export type AssuranceAlertType =
  | 'PAST_GATE_NO_EVIDENCE'
  | 'TARGET_REALIZED_GAP'
  | 'UNATTESTED_VALUE';

/** Severity ranking for alerts (high = needs CFO attention now). */
export type AssuranceSeverity = 'high' | 'medium' | 'low';

/** Minimal shape consumed by {@link assuranceStatus}. */
export interface AssuranceStatusItem {
  /** Claimed value figure (currency units). */
  value: number;
  /** Accountable owner who signed off on the figure. */
  attestedBy?: string | null;
  /** Source/lineage reference for the figure (doc id, system, etc.). */
  provenance?: string | null;
  /** Whether the initiative has passed its value gate. */
  gatePassed?: boolean;
  /**
   * Reconciliation result of the claimed value against evidence:
   *   - true  → claim matches the evidence (reconciled)
   *   - false → claim diverges from evidence (mismatch → disputed)
   *   - undefined/null → not yet reconciled
   */
  evidenceReconciled?: boolean | null;
}

/** Full portfolio item shape consumed by alerts + summary. */
export interface AssuranceItem extends AssuranceStatusItem {
  initiativeId: string;
  /** Planned/target value for the initiative. */
  targetValue?: number | null;
  /** Actually realized value to date. */
  realizedValue?: number | null;
}

export interface AssuranceStatusResult {
  status: AssuranceStatusValue;
  flags: string[];
}

export interface AssuranceAlert {
  initiativeId: string;
  type: AssuranceAlertType;
  severity: AssuranceSeverity;
}

export interface AssuranceSummary {
  /** Share of attested value over total value, 0..1, rounded to 4dp. */
  attestedPct: number;
  /** Sum of value across attested items. */
  attestedValue: number;
  /** Sum of value across unverified items. */
  unverifiedValue: number;
  /** Count of disputed items. */
  disputedCount: number;
  /** Share of items carrying provenance, 0..1, rounded to 4dp. */
  coverage: number;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Material gap threshold: realized within ±10% of target is acceptable. */
const TARGET_GAP_TOLERANCE = 0.1;

function isNonEmpty(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e4) / 1e4;
}

// ─── 1. assuranceStatus ──────────────────────────────────────────────────────

/**
 * Grade a single value claim.
 *
 *   - `disputed`   when reconciliation explicitly failed (evidence mismatch).
 *   - `attested`   when attestedBy + provenance are present AND evidence
 *                  reconciled === true.
 *   - `unverified` otherwise (missing attestation, provenance, or not yet
 *                  reconciled).
 *
 * `flags` enumerates every reason the item is not fully attested, so the CFO
 * sees exactly what is missing.
 */
export function assuranceStatus(item: AssuranceStatusItem): AssuranceStatusResult {
  const flags: string[] = [];

  const hasAttestor = isNonEmpty(item.attestedBy);
  const hasProvenance = isNonEmpty(item.provenance);
  const reconciled = item.evidenceReconciled === true;
  const reconciliationMismatch = item.evidenceReconciled === false;

  if (!hasAttestor) flags.push('NO_ATTESTOR');
  if (!hasProvenance) flags.push('NO_PROVENANCE');
  if (reconciliationMismatch) {
    flags.push('RECONCILIATION_MISMATCH');
  } else if (!reconciled) {
    flags.push('NOT_RECONCILED');
  }
  if (!isFiniteNumber(item.value)) flags.push('NO_VALUE');

  // Disputed dominates: a reconciliation mismatch means the figure is actively
  // contested regardless of who signed it.
  if (reconciliationMismatch) {
    return { status: 'disputed', flags };
  }

  if (hasAttestor && hasProvenance && reconciled) {
    return { status: 'attested', flags };
  }

  return { status: 'unverified', flags };
}

// ─── 2. assuranceAlerts ──────────────────────────────────────────────────────

/**
 * Scan a portfolio of value items and emit CFO red flags.
 *
 * Alert types:
 *   - PAST_GATE_NO_EVIDENCE — initiative passed its value gate but carries no
 *     provenance/attestation to back the claimed value (high severity: a banked
 *     benefit with no audit trail).
 *   - TARGET_REALIZED_GAP — realized value materially diverges from target
 *     (> ±10%). Severity scales with the size of the shortfall.
 *   - UNATTESTED_VALUE — a non-trivial value figure that is neither attested nor
 *     disputed (medium severity).
 *
 * A single initiative may raise multiple distinct alert types.
 */
export function assuranceAlerts(items: AssuranceItem[]): AssuranceAlert[] {
  const alerts: AssuranceAlert[] = [];
  if (!Array.isArray(items)) return alerts;

  for (const item of items) {
    if (!item || !isNonEmpty(item.initiativeId)) continue;

    const { status } = assuranceStatus(item);
    const hasEvidence = isNonEmpty(item.provenance) || isNonEmpty(item.attestedBy);
    const hasValue = isFiniteNumber(item.value) && item.value !== 0;

    // PAST_GATE_NO_EVIDENCE — gate passed but nothing backs the figure.
    if (item.gatePassed === true && !hasEvidence) {
      alerts.push({
        initiativeId: item.initiativeId,
        type: 'PAST_GATE_NO_EVIDENCE',
        severity: 'high',
      });
    }

    // TARGET_REALIZED_GAP — material divergence target vs realized.
    if (isFiniteNumber(item.targetValue) && isFiniteNumber(item.realizedValue)) {
      const target = item.targetValue;
      const realized = item.realizedValue;
      if (target !== 0) {
        const gap = Math.abs(realized - target) / Math.abs(target);
        if (gap > TARGET_GAP_TOLERANCE) {
          alerts.push({
            initiativeId: item.initiativeId,
            type: 'TARGET_REALIZED_GAP',
            // > 30% drift is a high-severity miss, otherwise medium.
            severity: gap > 0.3 ? 'high' : 'medium',
          });
        }
      } else if (realized !== 0) {
        // Target was zero but value was realized — definitionally off-plan.
        alerts.push({
          initiativeId: item.initiativeId,
          type: 'TARGET_REALIZED_GAP',
          severity: 'high',
        });
      }
    }

    // UNATTESTED_VALUE — real money on the table without attestation.
    // Disputed items are surfaced by their own status, so exclude them here.
    if (hasValue && status === 'unverified') {
      alerts.push({
        initiativeId: item.initiativeId,
        type: 'UNATTESTED_VALUE',
        severity: 'medium',
      });
    }
  }

  return alerts;
}

// ─── 3. assuranceSummary ─────────────────────────────────────────────────────

/**
 * Aggregate a portfolio into a CFO dashboard summary.
 *
 *   - attestedPct    — attested value / total value (0..1).
 *   - attestedValue  — sum of value over attested items.
 *   - unverifiedValue— sum of value over unverified items.
 *   - disputedCount  — number of disputed items.
 *   - coverage       — share of items carrying provenance (evidence coverage).
 */
export function assuranceSummary(items: AssuranceItem[]): AssuranceSummary {
  const empty: AssuranceSummary = {
    attestedPct: 0,
    attestedValue: 0,
    unverifiedValue: 0,
    disputedCount: 0,
    coverage: 0,
  };
  if (!Array.isArray(items) || items.length === 0) return empty;

  let attestedValue = 0;
  let unverifiedValue = 0;
  let disputedCount = 0;
  let totalValue = 0;
  let withProvenance = 0;
  let counted = 0;

  for (const item of items) {
    if (!item) continue;
    counted += 1;

    const value = isFiniteNumber(item.value) ? item.value : 0;
    totalValue += value;
    if (isNonEmpty(item.provenance)) withProvenance += 1;

    const { status } = assuranceStatus(item);
    if (status === 'attested') attestedValue += value;
    else if (status === 'unverified') unverifiedValue += value;
    else disputedCount += 1;
  }

  if (counted === 0) return empty;

  return {
    attestedPct: totalValue !== 0 ? round4(attestedValue / totalValue) : 0,
    attestedValue,
    unverifiedValue,
    disputedCount,
    coverage: round4(withProvenance / counted),
  };
}
