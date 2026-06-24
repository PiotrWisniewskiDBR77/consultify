/**
 * M14/F5 — Stage-Boundary cross-register gate (pure).
 *
 * The go/no-go decision at a rollout stage boundary must be evidence-based
 * (Sopheon Accolade gate / PRINCE2 end-stage assessment), not a hunch. It pulls
 * three registers into one verdict:
 *   - KPI gate-metrics met (Closure-grade exit criteria),
 *   - no open gate-blocking risks,
 *   - closure sign-offs done.
 * Returns Go / Conditional-Go / Hold / Kill with cited evidence. The data
 * loading is a follow-up; this is the evaluation core, fully unit-tested.
 */

export type GateDecision = 'GO' | 'CONDITIONAL_GO' | 'HOLD' | 'KILL';

export interface GateInputs {
  /** KPI rows flagged is_gate_metric and whether they currently meet target. */
  gateMetrics?: Array<{ name: string; met: boolean }>;
  /** Risk rows flagged is_gate_blocker and whether they are still open. */
  gateBlockers?: Array<{ name: string; open: boolean }>;
  /** Closure sign-off items and whether they are done. */
  signOffs?: Array<{ name: string; done: boolean }>;
}

export interface GateResult {
  decision: GateDecision;
  reasons: string[];
  unmetMetrics: string[];
  openBlockers: string[];
  pendingSignOffs: string[];
}

/**
 * Evaluate a stage-boundary gate. Decision precedence:
 *  KILL  — every gate KPI failed AND blockers are open (failing on all fronts).
 *  HOLD  — any open gate-blocking risk, or any unmet gate KPI.
 *  CONDITIONAL_GO — KPIs + risks clear, but sign-offs still pending.
 *  GO    — all criteria met.
 */
export function evaluateStageGate(inputs: GateInputs): GateResult {
  const gateMetrics = inputs.gateMetrics ?? [];
  const gateBlockers = inputs.gateBlockers ?? [];
  const signOffs = inputs.signOffs ?? [];

  const unmetMetrics = gateMetrics.filter((m) => !m.met).map((m) => m.name);
  const openBlockers = gateBlockers.filter((b) => b.open).map((b) => b.name);
  const pendingSignOffs = signOffs.filter((s) => !s.done).map((s) => s.name);

  const reasons: string[] = [];
  let decision: GateDecision;

  const allMetricsFailed = gateMetrics.length > 0 && unmetMetrics.length === gateMetrics.length;

  if (allMetricsFailed && openBlockers.length > 0) {
    decision = 'KILL';
    reasons.push('all gate KPIs failed with open blocking risks — recommend kill/recycle');
  } else if (openBlockers.length > 0) {
    decision = 'HOLD';
    reasons.push(`${openBlockers.length} open gate-blocking risk(s)`);
  } else if (unmetMetrics.length > 0) {
    decision = 'HOLD';
    reasons.push(`${unmetMetrics.length} gate KPI(s) below target`);
  } else if (pendingSignOffs.length > 0) {
    decision = 'CONDITIONAL_GO';
    reasons.push(`proceed pending ${pendingSignOffs.length} sign-off(s)`);
  } else {
    decision = 'GO';
    reasons.push('all gate criteria met');
  }

  return { decision, reasons, unmetMetrics, openBlockers, pendingSignOffs };
}
