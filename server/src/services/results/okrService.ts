/**
 * okrService — OKR functions (Doerr / "Measure What Matters").
 *
 * Objectives are qualitative goals; Key Results are quantitative, measurable
 * outcomes. Scoring follows the classic 0–1 progress scale, with weighted
 * roll-up of Key Results into Objective scores and parent/child cascade.
 *
 * The scoring/rollup section (top of file) is pure (no I/O, no DB) — safe to
 * use anywhere. The CRUD section (bottom, "I/O — DB CRUD") does read the
 * live DB (Faza-1 D7 slice: management on top of the read-only D10
 * okr_objectives/okr_key_results cascade) — see
 * Harvard/wdrozenie-100/_KONCEPT_RESULTS_2026-07-10.md §3.3.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getCurrentDefinitionVersionId } from './kpiDefinitionService.js';

export type KrType = 'metric' | 'milestone';
export type KrKind = 'committed' | 'aspirational';
export type CycleStatus = 'draft' | 'active' | 'grading' | 'closed';

export type KeyResult = {
  id: string;
  label: string;
  baseline?: number;
  target?: number;
  current?: number;
  /** Relative importance within its Objective. Defaults to 1 when omitted. */
  weight?: number;
  /**
   * Optional reference to a live KPI, for context/navigation only.
   * D7 (Piotr, 2026-07-12): "OKRy są indywidualne, zatem ręcznie tylko, one
   * są niezależne" — Key Results are scored EXCLUSIVELY from manual
   * check-ins (or the manual baseline/target/current triple). Linking a KPI
   * here never feeds the score; see `recomputeKeyResultScore` below.
   */
  kpiId?: string | null;
  /**
   * RES-009: the kpi_definition_versions.id current when `kpiId` was last
   * (re)linked — durable, informational-only, same non-scoring status as
   * kpiId itself. Lets a reader know WHICH version of the KPI's target/
   * thresholds/direction was in effect at link time, without making the
   * Key Result's score depend on it.
   */
  kpiDefinitionVersionId?: string | null;
  krType?: KrType;
  kind?: KrKind;
};

export type Objective = {
  id: string;
  label: string;
  keyResults: KeyResult[];
  /** Id of a parent Objective for cascade roll-up. */
  parentId?: string;
};

export type ObjectiveStatus = 'on-track' | 'at-risk' | 'off-track';

export type ObjectiveScore = {
  score: number;
  status: ObjectiveStatus;
};

export type CascadedObjective = Objective & {
  /** Own score from this Objective's Key Results. */
  score: number;
  /** Blended score incorporating child Objectives by parentId. */
  rollupScore: number;
};

export type OkrSummary = {
  total: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
  avgScore: number;
};

const clamp01 = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Progress of a single Key Result on a 0–1 scale:
 *   (current − baseline) / (target − baseline), clamped to [0, 1].
 * Returns 0 when required data is missing or the range is degenerate.
 */
export function scoreKeyResult(kr: KeyResult): number {
  if (!kr || !isNum(kr.current) || !isNum(kr.target)) return 0;
  const baseline = isNum(kr.baseline) ? kr.baseline : 0;
  const range = kr.target - baseline;
  if (range === 0) return 0;
  return clamp01((kr.current - baseline) / range);
}

export const statusFromScore = (score: number): ObjectiveStatus => {
  if (score >= 0.7) return 'on-track';
  if (score >= 0.4) return 'at-risk';
  return 'off-track';
};

/**
 * Weighted average of an Objective's Key Result scores, plus a status band:
 *   ≥0.7 on-track, ≥0.4 at-risk, else off-track.
 * An Objective with no Key Results scores 0 (off-track).
 */
export function scoreObjective(o: Objective): ObjectiveScore {
  const krs = o?.keyResults ?? [];
  if (krs.length === 0) {
    return { score: 0, status: statusFromScore(0) };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const kr of krs) {
    const weight = isNum(kr.weight) && kr.weight >= 0 ? kr.weight : 1;
    weightedSum += scoreKeyResult(kr) * weight;
    totalWeight += weight;
  }

  const score = totalWeight === 0 ? 0 : clamp01(weightedSum / totalWeight);
  return { score, status: statusFromScore(score) };
}

/**
 * Computes each Objective's own score, then a rollupScore that blends the
 * Objective's own score with the average rollupScore of its children
 * (linked by parentId). Leaf Objectives have rollupScore === score.
 *
 * The blend is a simple mean of [own score, ...child rollup scores], which
 * lets parent goals reflect progress cascaded up from sub-objectives.
 */
export function cascadeRollup(objectives: Objective[]): CascadedObjective[] {
  const list = objectives ?? [];
  const childrenByParent = new Map<string, Objective[]>();
  for (const o of list) {
    if (o.parentId == null) continue;
    const arr = childrenByParent.get(o.parentId) ?? [];
    arr.push(o);
    childrenByParent.set(o.parentId, arr);
  }

  const rollupCache = new Map<string, number>();
  const visiting = new Set<string>();

  const computeRollup = (o: Objective): number => {
    const cached = rollupCache.get(o.id);
    if (cached != null) return cached;

    const own = scoreObjective(o).score;

    // Cycle guard: if we revisit an Objective mid-computation, fall back to own.
    if (visiting.has(o.id)) return own;
    visiting.add(o.id);

    const children = childrenByParent.get(o.id) ?? [];
    let rollup: number;
    if (children.length === 0) {
      rollup = own;
    } else {
      let sum = own;
      for (const child of children) {
        sum += computeRollup(child);
      }
      rollup = clamp01(sum / (children.length + 1));
    }

    visiting.delete(o.id);
    rollupCache.set(o.id, rollup);
    return rollup;
  };

  return list.map((o) => ({
    ...o,
    score: scoreObjective(o).score,
    rollupScore: computeRollup(o),
  }));
}

/**
 * Portfolio-level summary across all Objectives: counts by status band and
 * the average own score.
 */
export function okrSummary(objectives: Objective[]): OkrSummary {
  const list = objectives ?? [];
  const total = list.length;
  if (total === 0) {
    return { total: 0, onTrack: 0, atRisk: 0, offTrack: 0, avgScore: 0 };
  }

  let onTrack = 0;
  let atRisk = 0;
  let offTrack = 0;
  let scoreSum = 0;

  for (const o of list) {
    const { score, status } = scoreObjective(o);
    scoreSum += score;
    if (status === 'on-track') onTrack += 1;
    else if (status === 'at-risk') atRisk += 1;
    else offTrack += 1;
  }

  return {
    total,
    onTrack,
    atRisk,
    offTrack,
    avgScore: scoreSum / total,
  };
}

/**
 * D7 (Piotr, 2026-07-12): "OKRy są indywidualne, zatem ręcznie tylko, one są
 * niezależne" — Key Results are scored manually only. There used to be a
 * `scoreKeyResultFromKpi` auto-score path here (KR fed straight from a linked
 * live KPI's current/target/baseline). It has been removed: `kpi_id` on a
 * Key Result is now an informational reference only (see `KeyResult.kpiId`
 * above) and never feeds `recomputeKeyResultScore` below. If a future
 * decision reverses D7, resurrect from git history (this file, pre
 * fix/okr-manual-only-d7).
 */

// ============================================================================
// I/O — DB CRUD (Faza 1 / D7 slice: OKR management on top of the read-only
// D10 cascade). Reads/writes okr_objectives, okr_key_results, okr_cycles,
// okr_check_ins (migration 914). Callers (resultsStrategic.routes.ts) own
// HTTP concerns (auth, capability gating, status codes) — these functions
// return plain data or throw on genuine DB failure.
// ============================================================================

export type OkrCycle = {
  id: string;
  organizationId: string;
  name: string;
  periodQuarter: number | null;
  periodYear: number;
  status: CycleStatus;
  deptId: string | null;
  teamId: string | null;
  closedAt: string | null;
  createdAt: string;
};

export type OkrCheckIn = {
  id: string;
  keyResultId: string;
  confidence: 'green' | 'amber' | 'red' | null;
  value: number | null;
  score: number | null;
  note: string | null;
  checkedAt: string;
  checkedBy: string | null;
};

type CycleRow = {
  id: string;
  organization_id: string;
  name: string;
  period_quarter: number | null;
  period_year: number;
  status: CycleStatus;
  dept_id: string | null;
  team_id: string | null;
  closed_at: string | null;
  created_at: string;
};

const mapCycleRow = (r: CycleRow): OkrCycle => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  periodQuarter: r.period_quarter,
  periodYear: r.period_year,
  status: r.status,
  deptId: r.dept_id,
  teamId: r.team_id,
  closedAt: r.closed_at,
  createdAt: r.created_at,
});

type CheckInRow = {
  id: string;
  key_result_id: string;
  confidence: 'green' | 'amber' | 'red' | null;
  value: number | null;
  score: number | null;
  note: string | null;
  checked_at: string;
  checked_by: string | null;
};

const mapCheckInRow = (r: CheckInRow): OkrCheckIn => ({
  id: r.id,
  keyResultId: r.key_result_id,
  confidence: r.confidence,
  value: r.value,
  score: r.score,
  note: r.note,
  checkedAt: r.checked_at,
  checkedBy: r.checked_by,
});

// ─── Cycles ─────────────────────────────────────────────────────────────

export async function listCycles(organizationId: string): Promise<OkrCycle[]> {
  const rows =
    ((await dbAll(
      `SELECT id, organization_id, name, period_quarter, period_year, status,
              dept_id, team_id, closed_at, created_at
       FROM okr_cycles WHERE organization_id = ?
       ORDER BY period_year DESC, period_quarter DESC NULLS LAST, created_at DESC`,
      [organizationId]
    )) as CycleRow[] | undefined) ?? [];
  return rows.map(mapCycleRow);
}

export async function createCycle(input: {
  organizationId: string;
  name: string;
  periodYear: number;
  periodQuarter?: number | null;
  deptId?: string | null;
  teamId?: string | null;
  createdBy?: string | null;
}): Promise<OkrCycle> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO okr_cycles
       (id, organization_id, name, period_quarter, period_year, status, dept_id, team_id, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.name,
      input.periodQuarter ?? null,
      input.periodYear,
      input.deptId ?? null,
      input.teamId ?? null,
      input.createdBy ?? null,
    ]
  );
  const row = (await dbGet(
    `SELECT id, organization_id, name, period_quarter, period_year, status,
            dept_id, team_id, closed_at, created_at
     FROM okr_cycles WHERE id = ?`,
    [id]
  )) as CycleRow;
  return mapCycleRow(row);
}

export type ObjectiveCloseSummary = {
  objectiveId: string;
  score: number;
  status: ObjectiveStatus;
};

/**
 * Closes a cycle: aggregates every Objective's Key-Result scores (persisted
 * `okr_key_results.score`, kept current by `recomputeKeyResultScore` on every
 * write) into a weighted Objective score + status band, marks the cycle
 * `closed` and its Objectives `closed`. Minimal "snapshot" per the task scope
 * — a full immutable report snapshot goes through F5 (Z103) separately.
 */
export async function closeCycle(
  cycleId: string,
  organizationId: string
): Promise<{ cycle: OkrCycle; objectives: ObjectiveCloseSummary[]; avgScore: number } | null> {
  const cycleRow = (await dbGet(
    `SELECT id, organization_id, name, period_quarter, period_year, status,
            dept_id, team_id, closed_at, created_at
     FROM okr_cycles WHERE id = ? AND organization_id = ?`,
    [cycleId, organizationId]
  )) as CycleRow | undefined;
  if (!cycleRow) return null;

  const objRows =
    ((await dbAll(`SELECT id FROM okr_objectives WHERE cycle_id = ? AND organization_id = ?`, [
      cycleId,
      organizationId,
    ])) as Array<{ id: string }> | undefined) ?? [];

  const summaries: ObjectiveCloseSummary[] = [];
  for (const o of objRows) {
    const krRows =
      ((await dbAll(
        `SELECT score, weight FROM okr_key_results WHERE objective_id = ? AND organization_id = ?`,
        [o.id, organizationId]
      )) as Array<{ score: number | null; weight: number | null }> | undefined) ?? [];

    let weightedSum = 0;
    let totalWeight = 0;
    for (const kr of krRows) {
      const weight = isNum(kr.weight) && kr.weight >= 0 ? kr.weight : 1;
      weightedSum += clamp01(kr.score ?? 0) * weight;
      totalWeight += weight;
    }
    const score = totalWeight === 0 ? 0 : clamp01(weightedSum / totalWeight);
    summaries.push({ objectiveId: o.id, score, status: statusFromScore(score) });
  }

  const avgScore =
    summaries.length === 0 ? 0 : summaries.reduce((sum, s) => sum + s.score, 0) / summaries.length;

  await dbRun(
    `UPDATE okr_cycles SET status = 'closed', closed_at = now(), updated_at = now() WHERE id = ?`,
    [cycleId]
  );
  await dbRun(
    `UPDATE okr_objectives SET status = 'closed', updated_at = now() WHERE cycle_id = ? AND organization_id = ?`,
    [cycleId, organizationId]
  );

  return { cycle: { ...mapCycleRow(cycleRow), status: 'closed' }, objectives: summaries, avgScore };
}

// ─── Objectives ─────────────────────────────────────────────────────────

export async function createObjective(input: {
  organizationId: string;
  label: string;
  projectId?: string | null;
  parentId?: string | null;
  cycleId?: string | null;
  ownerUserId?: string | null;
  description?: string | null;
}): Promise<{ id: string }> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO okr_objectives
       (id, organization_id, project_id, label, parent_id, cycle_id, owner_user_id, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [
      id,
      input.organizationId,
      input.projectId ?? null,
      input.label,
      input.parentId ?? null,
      input.cycleId ?? null,
      input.ownerUserId ?? null,
      input.description ?? null,
    ]
  );
  return { id };
}

export async function updateObjective(
  id: string,
  organizationId: string,
  patch: {
    label?: string;
    parentId?: string | null;
    cycleId?: string | null;
    ownerUserId?: string | null;
    description?: string | null;
    status?: string;
  }
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.label !== undefined) {
    sets.push('label = ?');
    params.push(patch.label);
  }
  if (patch.parentId !== undefined) {
    sets.push('parent_id = ?');
    params.push(patch.parentId);
  }
  if (patch.cycleId !== undefined) {
    sets.push('cycle_id = ?');
    params.push(patch.cycleId);
  }
  if (patch.ownerUserId !== undefined) {
    sets.push('owner_user_id = ?');
    params.push(patch.ownerUserId);
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    params.push(patch.description);
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (sets.length === 0) return false;
  sets.push('updated_at = now()');
  params.push(id, organizationId);
  const result = await dbRun(
    `UPDATE okr_objectives SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );
  return (result.changes ?? 0) > 0;
}

export async function deleteObjective(id: string, organizationId: string): Promise<boolean> {
  // Key Results cascade via fk_okr_kr_objective (ON DELETE CASCADE, migration 914).
  const result = await dbRun(`DELETE FROM okr_objectives WHERE id = ? AND organization_id = ?`, [
    id,
    organizationId,
  ]);
  return (result.changes ?? 0) > 0;
}

// ─── Key Results ────────────────────────────────────────────────────────

export async function createKeyResult(input: {
  objectiveId: string;
  organizationId: string;
  label: string;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  weight?: number | null;
  kpiId?: string | null;
  krType?: KrType;
  kind?: KrKind;
  ownerUserId?: string | null;
}): Promise<{ id: string; score: number }> {
  const id = uuidv4();
  // RES-009: durable version pin — resolved via RES-02's canonical owner,
  // not a re-implementation of its join. null when kpiId is unset/unknown,
  // never throws (informational link, must not block KR creation).
  const kpiDefinitionVersionId = input.kpiId
    ? await getCurrentDefinitionVersionId(input.kpiId, input.organizationId)
    : null;
  await dbRun(
    `INSERT INTO okr_key_results
       (id, objective_id, organization_id, label, baseline, target, current, weight,
        kpi_id, kpi_definition_version_id, kr_type, kind, owner_user_id, score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.objectiveId,
      input.organizationId,
      input.label,
      input.baseline ?? null,
      input.target ?? null,
      input.current ?? null,
      input.weight ?? null,
      input.kpiId ?? null,
      kpiDefinitionVersionId,
      input.krType ?? 'metric',
      input.kind ?? 'aspirational',
      input.ownerUserId ?? null,
    ]
  );
  const score = await recomputeKeyResultScore(id, input.organizationId);
  return { id, score };
}

export async function updateKeyResult(
  id: string,
  organizationId: string,
  patch: {
    label?: string;
    baseline?: number | null;
    target?: number | null;
    current?: number | null;
    weight?: number | null;
    kpiId?: string | null;
    krType?: KrType;
    kind?: KrKind;
    ownerUserId?: string | null;
  }
): Promise<{ updated: boolean; score: number }> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.label !== undefined) {
    sets.push('label = ?');
    params.push(patch.label);
  }
  if (patch.baseline !== undefined) {
    sets.push('baseline = ?');
    params.push(patch.baseline);
  }
  if (patch.target !== undefined) {
    sets.push('target = ?');
    params.push(patch.target);
  }
  if (patch.current !== undefined) {
    sets.push('current = ?');
    params.push(patch.current);
  }
  if (patch.weight !== undefined) {
    sets.push('weight = ?');
    params.push(patch.weight);
  }
  if (patch.kpiId !== undefined) {
    sets.push('kpi_id = ?');
    params.push(patch.kpiId);
    // RES-009: re-pin (or clear, on unlink) the version alongside kpi_id —
    // same "re-resolved on every write" semantics as RES-003's measurement
    // pin, so a re-link always captures the definition current AT RE-LINK
    // TIME, not whatever version was current the first time this KR was
    // ever linked to a KPI.
    sets.push('kpi_definition_version_id = ?');
    params.push(
      patch.kpiId ? await getCurrentDefinitionVersionId(patch.kpiId, organizationId) : null
    );
  }
  if (patch.krType !== undefined) {
    sets.push('kr_type = ?');
    params.push(patch.krType);
  }
  if (patch.kind !== undefined) {
    sets.push('kind = ?');
    params.push(patch.kind);
  }
  if (patch.ownerUserId !== undefined) {
    sets.push('owner_user_id = ?');
    params.push(patch.ownerUserId);
  }

  if (sets.length > 0) {
    sets.push('updated_at = now()');
    params.push(id, organizationId);
    const result = await dbRun(
      `UPDATE okr_key_results SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    if ((result.changes ?? 0) === 0) return { updated: false, score: 0 };
  }
  const score = await recomputeKeyResultScore(id, organizationId);
  return { updated: true, score };
}

export async function deleteKeyResult(id: string, organizationId: string): Promise<boolean> {
  const result = await dbRun(`DELETE FROM okr_key_results WHERE id = ? AND organization_id = ?`, [
    id,
    organizationId,
  ]);
  return (result.changes ?? 0) > 0;
}

/**
 * Recomputes and persists a single Key Result's `score` column (0.0–1.0),
 * manual-only (D7, Piotr 2026-07-12 — no auto-score from a linked KPI, even
 * when `kpi_id` is set; that field is informational-only, see `KeyResult.kpiId`):
 *  - the latest check-in with an explicit `score` (milestone-KR / manual
 *    grading) wins.
 *  - else falls back to the manual baseline/target/current triple on the KR
 *    itself (`scoreKeyResult`), kept current by check-ins' `value` write-back.
 * Returns 0 (and leaves the row untouched) if the KR doesn't exist.
 */
export async function recomputeKeyResultScore(
  keyResultId: string,
  organizationId: string
): Promise<number> {
  const kr = (await dbGet(
    `SELECT id, baseline, target, current, weight, kr_type, label
     FROM okr_key_results WHERE id = ? AND organization_id = ?`,
    [keyResultId, organizationId]
  )) as
    | {
        id: string;
        baseline: number | null;
        target: number | null;
        current: number | null;
        weight: number | null;
        kr_type: string | null;
        label: string;
      }
    | undefined;
  if (!kr) return 0;

  let score = 0;
  // seq (RES-009) is a deterministic write-order tie-breaker for checked_at
  // collisions (two check-ins landing on the identical instant) — without
  // it, "latest" is ambiguous and Postgres may pick either row.
  const latestCheckIn = (await dbGet(
    `SELECT score FROM okr_check_ins
     WHERE key_result_id = ? AND score IS NOT NULL
     ORDER BY checked_at DESC, seq DESC LIMIT 1`,
    [keyResultId]
  )) as { score: number | null } | undefined;
  if (latestCheckIn && isNum(latestCheckIn.score)) {
    score = clamp01(latestCheckIn.score);
  } else {
    score = scoreKeyResult({
      id: kr.id,
      label: kr.label,
      baseline: kr.baseline ?? undefined,
      target: kr.target ?? undefined,
      current: kr.current ?? undefined,
      weight: kr.weight ?? undefined,
    });
  }

  await dbRun(`UPDATE okr_key_results SET score = ?, updated_at = now() WHERE id = ?`, [
    score,
    keyResultId,
  ]);
  return score;
}

// ─── Check-ins ──────────────────────────────────────────────────────────

export async function createCheckIn(input: {
  keyResultId: string;
  organizationId: string;
  confidence?: 'green' | 'amber' | 'red' | null;
  value?: number | null;
  score?: number | null;
  note?: string | null;
  checkedBy?: string | null;
}): Promise<{ checkIn: OkrCheckIn; score: number } | null> {
  // Verify the KR belongs to this org before writing (org-scoped tenancy guard —
  // okr_check_ins itself carries organization_id for query isolation, but the
  // FK is only on key_result_id).
  const kr = (await dbGet(`SELECT id FROM okr_key_results WHERE id = ? AND organization_id = ?`, [
    input.keyResultId,
    input.organizationId,
  ])) as { id: string } | undefined;
  if (!kr) return null;

  const id = uuidv4();
  await dbRun(
    `INSERT INTO okr_check_ins (id, key_result_id, organization_id, confidence, value, score, note, checked_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.keyResultId,
      input.organizationId,
      input.confidence ?? null,
      input.value ?? null,
      input.score ?? null,
      input.note ?? null,
      input.checkedBy ?? null,
    ]
  );

  // D7 (manual-only): every check-in's `value` — regardless of any
  // informational `kpi_id` link — becomes the KR's new `current` reading
  // (keeps the manual baseline/target/current triple that `scoreKeyResult`
  // reads with each check-in).
  if (isNum(input.value)) {
    await dbRun(`UPDATE okr_key_results SET current = ?, updated_at = now() WHERE id = ?`, [
      input.value,
      input.keyResultId,
    ]);
  }

  const score = await recomputeKeyResultScore(input.keyResultId, input.organizationId);

  const row = (await dbGet(
    `SELECT id, key_result_id, confidence, value, score, note, checked_at, checked_by
     FROM okr_check_ins WHERE id = ?`,
    [id]
  )) as CheckInRow;
  return { checkIn: mapCheckInRow(row), score };
}

export async function listCheckIns(
  keyResultId: string,
  organizationId: string
): Promise<OkrCheckIn[]> {
  const kr = (await dbGet(`SELECT id FROM okr_key_results WHERE id = ? AND organization_id = ?`, [
    keyResultId,
    organizationId,
  ])) as { id: string } | undefined;
  if (!kr) return [];
  // seq (RES-009): deterministic tie-breaker, see recomputeKeyResultScore's
  // identical comment — checked_at alone is not a reliable sort key.
  const rows =
    ((await dbAll(
      `SELECT id, key_result_id, confidence, value, score, note, checked_at, checked_by
       FROM okr_check_ins WHERE key_result_id = ? ORDER BY checked_at DESC, seq DESC`,
      [keyResultId]
    )) as CheckInRow[] | undefined) ?? [];
  return rows.map(mapCheckInRow);
}

// ─── Suggested value (RES-009 → RES-003 reference, read-only) ────────────

export type SuggestedValue = {
  value: number;
  periodStart: string;
  source: string;
};

/**
 * RES-009 packet §5 (suggested-value endpoint): a read-only lookup of "the
 * latest known measurement for this KR's linked KPI", by reference through
 * RES-003's canonical `kpi_time_series` table — NOT a second copy of the
 * value written anywhere on `okr_key_results`.
 *
 * D7 non-negotiable: this function is called ONLY from the suggested-value
 * read endpoint below, to prefill a check-in form. It is never invoked from
 * createCheckIn/updateKeyResult/recomputeKeyResultScore — a KPI measurement
 * landing must never silently change a Key Result's `current`/`score`. If a
 * future caller is tempted to call this during a write path, that would
 * reverse D7 (Piotr, 2026-07-12) and needs a product decision first, not a
 * refactor.
 *
 * Returns null when the KR has no linked kpiId, the KR doesn't belong to
 * this org, the linked KPI doesn't belong to this org (defensive — kpi_id
 * has no org-equality constraint of its own), or no measurement exists yet.
 */
export async function getSuggestedValueForKeyResult(
  keyResultId: string,
  organizationId: string
): Promise<SuggestedValue | null> {
  const kr = (await dbGet(
    `SELECT id, kpi_id FROM okr_key_results WHERE id = ? AND organization_id = ?`,
    [keyResultId, organizationId]
  )) as { id: string; kpi_id: string | null } | undefined;
  if (!kr?.kpi_id) return null;

  const latest = (await dbGet(
    `SELECT value, period_start, source
     FROM kpi_time_series
     WHERE kpi_id = ? AND organization_id = ?
     ORDER BY period_start DESC, created_at DESC LIMIT 1`,
    [kr.kpi_id, organizationId]
  )) as { value: number | string; period_start: unknown; source: string } | undefined;
  if (!latest) return null;

  return {
    value: Number(latest.value),
    // period_start is a Postgres DATE column — node-pg hands back a JS Date,
    // not a string (see kpiMeasurementWriterService.ts's toIsoDateString for
    // why a naive String()/toISOString() would corrupt it).
    periodStart: toIsoDateString(latest.period_start) ?? '',
    source: latest.source,
  };
}

function toIsoDateString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10) || null;
}
