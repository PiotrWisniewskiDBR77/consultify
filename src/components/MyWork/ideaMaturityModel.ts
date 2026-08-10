/**
 * Idea maturity / stage-gate model (Program D, E08).
 *
 * WHAT EXISTED BEFORE THIS FILE (verified 2026-08-10, see grep evidence in the
 * task report): `MyIdea.stage` (myIdeasTypes.ts:10, 5-bucket) and
 * `IdeaWorkspaceTools`'s `v5Stage`/`stageIdx` (7-value, ideaEntryTypes.ts) are
 * BOTH plain strings. The only "advance" affordance
 * (`IdeaWorkspaceTools.tsx` ~L452-460, `canAdvance = nextVisibleStageIdx >= 0`)
 * checks only "is there a next bucket in the list" — zero content criteria.
 * Nothing in `src/` or `server/src/` evaluated whether a Spark idea actually
 * has an owner/problem/source before letting it become "Growing", etc. This
 * module is the first place that criteria are made explicit and checked.
 *
 * DESIGN — derived vs attested:
 *  - `kind: 'derived'` criteria are computed from data the product ALREADY
 *    stores (canvas nodes' `owner`/`riskNote`/`evidenceLinks`/`context`
 *    fields — see `ExtendedNodeData` in IdeaNodeDetailDrawer.tsx — plus the
 *    Idea's own `evidenceRefs`/`sourceType`/`promotedTo`). No new schema.
 *  - `kind: 'attested'` criteria (initial economics, recommendation,
 *    financial scenario, dependencies, unresolved assumptions) have NO
 *    backing field anywhere in the product today — grep confirmed no
 *    structured "risks list"/"financial scenario"/"recommendation" record
 *    exists for an Idea. Rather than fabricate a computed answer, these are
 *    explicit user attestations (checked + a short note), persisted
 *    server-side in the additive `maturity_gates_json` column proposed in
 *    `server/migrations/20260810_idea_maturity_gates.sql` (NOT applied — see
 *    that file's header and the task report). Until that column exists on a
 *    given database, `attested` criteria simply cannot be marked met — the
 *    gate stays honestly blocked rather than lying.
 *
 * PROMOTED RULE: the only Promoted criterion is `Boolean(input.promotedTo)`,
 * which mirrors the ALREADY-FIXED backend rule in
 * `server/src/routes/my-work.routes.ts` (`promote()`, ~L6839-6878, commit
 * f319307019 "P0-1 — historia konwersji zamiast nadpisywanego pola
 * promoted_to"): `promoted_to`/`stage='promoted'` are written ONLY when
 * `isWholeIdeaScope` is true; partial/branch conversions instead insert a row
 * into `my_idea_conversions` and leave the Idea's own stage untouched. This
 * model surfaces `partialConversionCount` purely as informational lineage —
 * it is READ but never allowed to satisfy the Promoted gate (see
 * `evaluateIdeaMaturity` below: the Promoted criterion's `evaluate` ignores
 * that field entirely).
 */

export type MaturityStageId = 'spark' | 'incubating' | 'shaping' | 'ready' | 'promoted';

export const MATURITY_STAGE_ORDER: MaturityStageId[] = [
  'spark',
  'incubating',
  'shaping',
  'ready',
  'promoted',
];

export const MATURITY_STAGE_LABELS: Record<MaturityStageId, { en: string; pl: string }> = {
  spark: { en: 'Spark', pl: 'Iskra' },
  incubating: { en: 'Growing', pl: 'Rośnie' },
  shaping: { en: 'Shaping', pl: 'Kształtuje się' },
  ready: { en: 'Ready', pl: 'Gotowy' },
  promoted: { en: 'Promoted', pl: 'Promowany' },
};

export type MaturityCriterionKind = 'derived' | 'attested';

/** One explicit user attestation for an `attested` criterion (see file header). */
export interface MaturityAttestation {
  met: boolean;
  note?: string;
  byUserId?: string | null;
  at?: string | null;
}

export type MaturityAttestations = Record<string, MaturityAttestation>;

/**
 * Everything the evaluator needs. Every field is a real, already-computed
 * signal — see the call site in `IdeaWorkspaceTools.tsx` for exactly where
 * each number comes from (no new derivations invented for this file beyond
 * simple counts over the same `graphNodes` the workspace already holds).
 */
export interface MaturityEvalInput {
  title?: string | null;
  body?: string | null;
  seedText?: string | null;
  sourceType?: string | null;
  evidenceRefsCount?: number;
  /** Nodes with a non-empty `evidenceLinks` array — same signal `evidenceCount` in IdeaMapWorkspace.tsx:3319 already computes. */
  evidenceLinkedNodeCount?: number;
  nodeCount?: number;
  distinctBranchCount?: number;
  distinctOwnerCount?: number;
  nodesWithRiskNoteCount?: number;
  nodesWithContextCount?: number;
  processFlowLaneCount?: number;
  promotedTo?: string | null;
  /**
   * Informational only (my_idea_conversions rows with scope='selection').
   * MUST NOT be read by any criterion's `evaluate` — the whole point of the
   * P0-1 fix this model documents is that partial conversions do NOT promote
   * the Idea. Kept on the input purely so the UI can show "3 partial
   * conversions exist" next to the (still unmet) Promoted gate.
   */
  partialConversionCount?: number;
}

export interface MaturityCriterion {
  id: string;
  label: { en: string; pl: string };
  /** Missing a mandatory criterion blocks the stage; missing an optional one only shows as a gap. */
  mandatory: boolean;
  kind: MaturityCriterionKind;
  explain: { en: string; pl: string };
  /** Required when kind === 'derived'. Ignored (attestation used instead) when kind === 'attested'. */
  evaluate?: (input: MaturityEvalInput) => boolean;
}

export interface MaturityCriterionResult {
  id: string;
  label: { en: string; pl: string };
  mandatory: boolean;
  kind: MaturityCriterionKind;
  explain: { en: string; pl: string };
  met: boolean;
  note?: string;
}

export interface MaturityStageResult {
  id: MaturityStageId;
  label: { en: string; pl: string };
  criteria: MaturityCriterionResult[];
  allMandatoryMet: boolean;
  allMet: boolean;
}

export interface MaturityReport {
  stages: MaturityStageResult[];
  storedBucket: MaturityStageId;
  /** Highest stage whose own AND every earlier stage's mandatory criteria are met. */
  computedBucket: MaturityStageId;
  /** True when the stored label claims a stage the evidence does not support. */
  overclaimed: boolean;
  nextStage: MaturityStageId | null;
  /** Missing mandatory criteria of `nextStage` — the "why not yet" list for the UI. */
  blockersForNext: MaturityCriterionResult[];
}

const nonTrivial = (s: string | null | undefined, min = 20) => String(s || '').trim().length > min;

/**
 * Gate definitions per the task's minimum set (master program §6.1 / doc 11
 * E08). Each `explain` string states plainly what is actually checked so the
 * UI never has to invent copy that overclaims what the system verified.
 */
export const IDEA_MATURITY_GATES: Record<MaturityStageId, MaturityCriterion[]> = {
  spark: [
    {
      id: 'spark_owner',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Owner identified', pl: 'Właściciel określony' },
      explain: {
        en: 'At least one canvas item has an assigned owner.',
        pl: 'Co najmniej jeden element na płótnie ma przypisanego właściciela.',
      },
      evaluate: (i) => (i.distinctOwnerCount ?? 0) >= 1,
    },
    {
      id: 'spark_problem',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Problem statement', pl: 'Sformułowany problem' },
      explain: {
        en: 'Title is set and the description/body says more than a few words.',
        pl: 'Tytuł jest ustawiony, a opis/treść to więcej niż kilka słów.',
      },
      evaluate: (i) =>
        nonTrivial(i.title, 3) && (nonTrivial(i.body) || nonTrivial(i.seedText)),
    },
    {
      id: 'spark_source',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Source recorded', pl: 'Źródło odnotowane' },
      explain: {
        en: 'sourceType is set on the Idea (chat handoff, template, or manual entry).',
        pl: 'Idea ma ustawiony sourceType (z czatu, z szablonu lub ręcznie).',
      },
      // Honest caveat (see task report): every Idea gets sourceType='manual'
      // by default at creation (IdeaMapWorkspace.tsx:1525), so this is close
      // to always-true today — a real product gap (no distinct "who/what
      // told us about this" field), not a bug in this evaluator.
      evaluate: (i) => nonTrivial(i.sourceType, 0),
    },
  ],
  incubating: [
    {
      id: 'growing_hypotheses',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Hypotheses / options captured', pl: 'Hipotezy / opcje zapisane' },
      explain: {
        en: 'At least 2 items exist on the canvas (mind map / table / whiteboard).',
        pl: 'Na płótnie (mapa myśli / tabela / whiteboard) istnieją co najmniej 2 elementy.',
      },
      evaluate: (i) => (i.nodeCount ?? 0) >= 2,
    },
    {
      id: 'growing_evidence',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Evidence attached', pl: 'Dowody dołączone' },
      explain: {
        en: 'At least one evidence reference or node-level evidence link exists.',
        pl: 'Istnieje co najmniej jedno źródło/odniesienie dowodowe.',
      },
      evaluate: (i) => (i.evidenceRefsCount ?? 0) > 0 || (i.evidenceLinkedNodeCount ?? 0) > 0,
    },
    {
      id: 'growing_stakeholders',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Stakeholders identified', pl: 'Interesariusze zidentyfikowani' },
      explain: {
        en: 'At least 2 distinct owners are assigned across canvas items.',
        pl: 'Co najmniej 2 różne osoby są przypisane jako właściciele elementów.',
      },
      evaluate: (i) => (i.distinctOwnerCount ?? 0) >= 2,
    },
  ],
  shaping: [
    {
      id: 'shaping_alternatives',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Alternatives compared', pl: 'Alternatywy porównane' },
      explain: {
        en: 'At least 2 distinct branches have been explored on the canvas.',
        pl: 'Na płótnie zbadano co najmniej 2 różne gałęzie.',
      },
      evaluate: (i) => (i.distinctBranchCount ?? 0) >= 2,
    },
    {
      id: 'shaping_operating_model',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Operational model sketched', pl: 'Naszkicowany model operacyjny' },
      explain: {
        en: 'A Process Flow lane exists, or a canvas item has operating-model context notes.',
        pl: 'Istnieje tor (lane) procesu, albo element ma zapisany kontekst operacyjny.',
      },
      evaluate: (i) => (i.processFlowLaneCount ?? 0) > 0 || (i.nodesWithContextCount ?? 0) > 0,
    },
    {
      id: 'shaping_risks',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Risks noted', pl: 'Ryzyka odnotowane' },
      explain: {
        en: 'At least one canvas item has a risk note.',
        pl: 'Co najmniej jeden element ma odnotowane ryzyko.',
      },
      evaluate: (i) => (i.nodesWithRiskNoteCount ?? 0) > 0,
    },
    {
      id: 'shaping_economics',
      mandatory: true,
      kind: 'attested',
      label: { en: 'Initial economics estimated', pl: 'Wstępna ekonomika oszacowana' },
      explain: {
        en: 'No field in the product tracks cost/ROI for an Idea today — confirm explicitly.',
        pl: 'Produkt nie ma dziś pola na koszt/ROI Idei — potwierdź wprost.',
      },
    },
  ],
  ready: [
    {
      id: 'ready_recommendation',
      mandatory: true,
      kind: 'attested',
      label: { en: 'Recommendation written', pl: 'Rekomendacja spisana' },
      explain: {
        en: 'No structured "recommendation" field exists for an Idea today — confirm explicitly.',
        pl: 'Produkt nie ma dziś pola na "rekomendację" Idei — potwierdź wprost.',
      },
    },
    {
      id: 'ready_owners',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Owners assigned', pl: 'Właściciele przypisani' },
      explain: {
        en: 'At least 2 distinct owners are assigned (accountable + responsible).',
        pl: 'Przypisano co najmniej 2 różnych właścicieli (odpowiedzialny + realizujący).',
      },
      evaluate: (i) => (i.distinctOwnerCount ?? 0) >= 2,
    },
    {
      id: 'ready_financial_scenario',
      mandatory: true,
      kind: 'attested',
      label: { en: 'Financial scenario modeled', pl: 'Scenariusz finansowy zamodelowany' },
      explain: {
        en: 'No structured financial-scenario field exists for an Idea today — confirm explicitly.',
        pl: 'Produkt nie ma dziś pola na scenariusz finansowy Idei — potwierdź wprost.',
      },
    },
    {
      id: 'ready_dependencies',
      mandatory: true,
      kind: 'attested',
      label: { en: 'Dependencies reviewed', pl: 'Zależności przejrzane' },
      explain: {
        en: 'No structured dependency list exists for an Idea today — confirm explicitly.',
        pl: 'Produkt nie ma dziś listy zależności Idei — potwierdź wprost.',
      },
    },
    {
      id: 'ready_assumptions',
      mandatory: true,
      kind: 'attested',
      label: { en: 'Unresolved assumptions documented', pl: 'Otwarte założenia udokumentowane' },
      explain: {
        en: 'No structured assumptions list exists for an Idea today — confirm explicitly.',
        pl: 'Produkt nie ma dziś listy założeń Idei — potwierdź wprost.',
      },
    },
  ],
  promoted: [
    {
      id: 'promoted_whole_idea',
      mandatory: true,
      kind: 'derived',
      label: { en: 'Whole Idea converted', pl: 'Cała Idea skonwertowana' },
      explain: {
        en: 'The Idea itself (not a selection/branch) was converted to an approved downstream artifact. Partial conversions add lineage but never satisfy this on their own.',
        pl: 'Cała Idea (nie zaznaczenie/gałąź) została skonwertowana do zatwierdzonego artefaktu. Konwersje częściowe dopisują historię, ale same nie spełniają tego kryterium.',
      },
      // Deliberately reads ONLY promotedTo — see file header re: P0-1.
      evaluate: (i) => Boolean(i.promotedTo),
    },
  ],
};

function evaluateStage(
  stageId: MaturityStageId,
  input: MaturityEvalInput,
  attestations: MaturityAttestations
): MaturityStageResult {
  const criteria = IDEA_MATURITY_GATES[stageId].map((c): MaturityCriterionResult => {
    const met =
      c.kind === 'derived' ? Boolean(c.evaluate?.(input)) : Boolean(attestations[c.id]?.met);
    return {
      id: c.id,
      label: c.label,
      mandatory: c.mandatory,
      kind: c.kind,
      explain: c.explain,
      met,
      note: attestations[c.id]?.note,
    };
  });
  const mandatoryCriteria = criteria.filter((c) => c.mandatory);
  return {
    id: stageId,
    label: MATURITY_STAGE_LABELS[stageId],
    criteria,
    allMandatoryMet: mandatoryCriteria.every((c) => c.met),
    allMet: criteria.every((c) => c.met),
  };
}

/**
 * Evaluate all 5 stages. `storedBucket` is whatever `MyIdea.stage` currently
 * says (the free-string label). `computedBucket` is what the gates actually
 * support — the two are reported SEPARATELY so the UI can flag an
 * `overclaimed` idea (stage says "Ready" but gates say "Growing") instead of
 * silently trusting the free string.
 */
export function evaluateIdeaMaturity(
  input: MaturityEvalInput,
  attestations: MaturityAttestations,
  storedBucket: MaturityStageId
): MaturityReport {
  const stages = MATURITY_STAGE_ORDER.map((id) => evaluateStage(id, input, attestations));

  let computedBucket: MaturityStageId = 'spark';
  for (const stage of stages) {
    if (stage.allMandatoryMet) {
      computedBucket = stage.id;
    } else {
      break;
    }
  }

  const storedIdx = MATURITY_STAGE_ORDER.indexOf(storedBucket);
  const computedIdx = MATURITY_STAGE_ORDER.indexOf(computedBucket);
  const overclaimed = storedIdx > computedIdx;

  const nextIdx = computedIdx + 1;
  const nextStage = nextIdx < MATURITY_STAGE_ORDER.length ? MATURITY_STAGE_ORDER[nextIdx] : null;
  const blockersForNext = nextStage
    ? (stages.find((s) => s.id === nextStage)?.criteria.filter((c) => c.mandatory && !c.met) ??
      [])
    : [];

  return { stages, storedBucket, computedBucket, overclaimed, nextStage, blockersForNext };
}

/**
 * Should the UI let the user set the Idea's stage to `target`? Enforces the
 * DoD requirement ("stage gates enforce completeness") — mandatory criteria
 * of every stage up to and including `target` must be met. Moving BACKWARD
 * is always allowed (never blocks demoting an idea).
 */
export function canAdvanceToStage(
  report: MaturityReport,
  target: MaturityStageId
): { allowed: boolean; missing: MaturityCriterionResult[] } {
  const targetIdx = MATURITY_STAGE_ORDER.indexOf(target);
  const storedIdx = MATURITY_STAGE_ORDER.indexOf(report.storedBucket);
  if (targetIdx <= storedIdx) return { allowed: true, missing: [] };

  const missing: MaturityCriterionResult[] = [];
  for (let i = 0; i <= targetIdx; i++) {
    const stage = report.stages[i];
    missing.push(...stage.criteria.filter((c) => c.mandatory && !c.met));
  }
  return { allowed: missing.length === 0, missing };
}

/** Derive the canvas-side counts `evaluateIdeaMaturity` needs from a node array (ExtendedNodeData-shaped). */
export function deriveCanvasSignals(
  nodes: Array<{ data?: Record<string, unknown> }> | undefined
): Pick<
  MaturityEvalInput,
  | 'nodeCount'
  | 'distinctBranchCount'
  | 'distinctOwnerCount'
  | 'nodesWithRiskNoteCount'
  | 'nodesWithContextCount'
> {
  const list = Array.isArray(nodes) ? nodes : [];
  const branches = new Set<string>();
  const owners = new Set<string>();
  let riskCount = 0;
  let contextCount = 0;
  for (const n of list) {
    const d = (n?.data || {}) as Record<string, unknown>;
    const branchKey = String(d.branchKey || '').trim();
    if (branchKey) branches.add(branchKey);
    const owner = String(d.owner || '').trim();
    if (owner) owners.add(owner.toLowerCase());
    if (String(d.riskNote || '').trim()) riskCount += 1;
    if (String(d.context || '').trim()) contextCount += 1;
  }
  return {
    nodeCount: list.length,
    distinctBranchCount: branches.size,
    distinctOwnerCount: owners.size,
    nodesWithRiskNoteCount: riskCount,
    nodesWithContextCount: contextCount,
  };
}
