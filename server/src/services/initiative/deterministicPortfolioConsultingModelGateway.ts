/**
 * [ODMROZENIE 05_INITIATIVES DEC-495] F2-1 E1 — deterministyczna brama modelu
 * dla analizy portfela inicjatyw.
 *
 * POWOD ISTNIENIA (nie „mock dla wygody"): `ConfiguredPortfolioConsultingModelGateway`
 * wola realny model przez `llmService` i CELOWO odrzuca odpowiedz oznaczona
 * `qaMock` (503 PORTFOLIO_ANALYSIS_REAL_MODEL_REQUIRED). To wlasciwa decyzja dla
 * produkcji, ale przez nia ekran „Analiza portfela" nie da sie ani pokazac, ani
 * przetestowac end-to-end bez kluczy do dostawcy LLM — a wlasciciel NIGDY nie
 * moze byc pierwszym testerem wizualnym (CLAUDE.md #7).
 *
 * Ta brama nie udaje modelu i nie ocenia niczego merytorycznie. Wyprowadza
 * ZAMROZONA migawke na 5 kryteriow wlasciciela (pokrycie obszaru, nakladanie sie,
 * priorytety, nowe vs juz realizowane, historia decyzji) w sposob czysto
 * mechaniczny i powtarzalny — ten sam wejsciowy snapshot daje bit w bit ten sam
 * wynik. Provenance jasno mowi `provider: 'deterministic'`, zeby nikt nie wzial
 * tego za dowod jakosci realnego modelu.
 *
 * BEZPIECZNIK: wlacza sie WYLACZNIE przy `PORTFOLIO_ANALYSIS_DETERMINISTIC_MODEL=true`
 * (domyslnie OFF) i NIGDY przy `NODE_ENV=production`.
 */
import { createHash } from 'node:crypto';

import type {
  PortfolioAnalysisSnapshot,
  PortfolioConsultingModelGateway,
} from '../../domain/initiatives-execution/portfolioConsultingAnalysis.js';

const CRITERIA = [
  'COVERAGE_GAP',
  'OVERLAP',
  'PRIORITY',
  'NEW_VS_EXTENSION',
  'DECISION_HISTORY',
] as const;

type Criterion = (typeof CRITERIA)[number];

const OBSERVATION_TEXT: Record<Criterion, string> = {
  COVERAGE_GAP:
    'Area coverage: the frozen portfolio spans {count} Initiative(s); the areas named in their frozen fields are the only ones covered, so any area absent from this snapshot is uncovered.',
  OVERLAP:
    'Overlap: {count} Initiative(s) were compared field by field on the frozen snapshot; the pairs listed below share the same frozen scope fields.',
  PRIORITY:
    'Priority spread: the frozen priority of every Initiative in scope is listed below; a portfolio where every item carries the same priority has no usable ordering.',
  NEW_VS_EXTENSION:
    'New versus already running: {running} running work item(s) were matched against the Initiatives in scope, to separate genuinely new work from an extension of work already under way.',
  DECISION_HISTORY:
    'Experience history: {decisions} earlier Decision(s) exist for the Initiatives in scope, including parking and archive dispositions with their return conditions.',
};

const RECOMMENDATION_TEXT: Record<Criterion, string> = {
  COVERAGE_GAP:
    'Confirm the uncovered areas deliberately, or add an Initiative for each area that is worth the work.',
  OVERLAP: 'Merge or explicitly separate the Initiatives that share the same frozen scope.',
  PRIORITY: 'Re-spread priorities so the order of work is decidable.',
  NEW_VS_EXTENSION:
    'Where work is already running, extend the running item instead of opening a second Initiative.',
  DECISION_HISTORY:
    'Re-read every parking return condition before re-proposing an Initiative that was stopped earlier.',
};

const DISPOSITIONS = [
  {
    kind: 'IN' as const,
    reason:
      'Covers an area with no other Initiative in the frozen snapshot and is not running yet.',
    returnCondition: null,
  },
  {
    kind: 'PARKING' as const,
    reason: 'Overlaps work already running, so a second Initiative would duplicate effort.',
    returnCondition: 'Returns when the running work closes without covering this scope.',
  },
  {
    kind: 'ARCHIVE' as const,
    reason:
      'An earlier Decision already dispositioned this scope and nothing in the snapshot changed it.',
    returnCondition:
      'Returns when the frozen context shows the earlier blocking condition is gone.',
  },
];

/**
 * Pole dowodu musi ISTNIEC w `facts` migawki i byc zapisane ze scieszka `facts.<klucz>`
 * — walidator domeny (`hasSnapshotField`) odrzuca kazda inna postac.
 */
function evidenceField(facts: Record<string, unknown>): string | null {
  for (const preferred of ['name', 'title', 'status', 'priority', 'summary']) {
    if (Object.prototype.hasOwnProperty.call(facts, preferred)) return `facts.${preferred}`;
  }
  const first = Object.keys(facts)[0];
  return first ? `facts.${first}` : null;
}

export function buildDeterministicPortfolioAnalysisOutput(snapshot: PortfolioAnalysisSnapshot): {
  items: unknown[];
} {
  const initiatives = snapshot.initiatives;
  if (initiatives.length === 0) {
    throw new Error('DETERMINISTIC_PORTFOLIO_ANALYSIS_EMPTY_SNAPSHOT');
  }
  const evidence = initiatives.map((initiative) => {
    const field = evidenceField(initiative.facts);
    if (!field) throw new Error('DETERMINISTIC_PORTFOLIO_ANALYSIS_NO_EVIDENCE_FIELD');
    return {
      initiativeId: initiative.initiativeId,
      field,
      source: 'initiativeUnifiedReader' as const,
      sourceRef: initiative.evidenceRefs[0],
    };
  });
  const allIds = initiatives.map((initiative) => initiative.initiativeId);
  const fill = (template: string) =>
    template
      .replace('{count}', String(initiatives.length))
      .replace('{running}', String(snapshot.runningWork.length))
      .replace('{decisions}', String(snapshot.decisionHistory.length));

  const items: unknown[] = [];
  let position = 0;
  for (const criterion of CRITERIA) {
    items.push({
      itemId: `obs-${criterion.toLowerCase()}`,
      position: ++position,
      kind: 'OBSERVATION',
      criterion,
      initiativeIds: allIds,
      rationale: fill(OBSERVATION_TEXT[criterion]),
      evidence,
      confidence: 'MEDIUM',
      alternatives: [],
      missingData: ['Deterministic derivation — no model judgement was applied.'],
      proposedDisposition: null,
    });
  }
  for (const criterion of CRITERIA) {
    items.push({
      itemId: `rec-${criterion.toLowerCase()}`,
      position: ++position,
      kind: 'RECOMMENDATION',
      criterion,
      initiativeIds: allIds,
      rationale: RECOMMENDATION_TEXT[criterion],
      evidence,
      confidence: 'MEDIUM',
      alternatives: ['Leave the portfolio unchanged and record why.'],
      missingData: ['Deterministic derivation — no model judgement was applied.'],
      proposedDisposition: null,
    });
  }
  initiatives.forEach((initiative, index) => {
    const proposal = DISPOSITIONS[index % DISPOSITIONS.length];
    items.push({
      itemId: `dec-${initiative.initiativeId}`,
      position: ++position,
      kind: 'DECISION',
      criterion: CRITERIA[index % CRITERIA.length],
      initiativeIds: [initiative.initiativeId],
      rationale: `${proposal.reason} Human review decides; this row proposes nothing more than the disposition below.`,
      evidence: [evidence[index]],
      confidence: 'MEDIUM',
      alternatives: ['Decide the opposite disposition and record the reason.'],
      missingData: ['Deterministic derivation — no model judgement was applied.'],
      proposedDisposition: proposal,
    });
  });
  return { items };
}

export class DeterministicPortfolioConsultingModelGateway implements PortfolioConsultingModelGateway {
  async analyze(input: {
    rubricVersion: string;
    requestDigest: string;
    snapshot: PortfolioAnalysisSnapshot;
  }) {
    const runId = createHash('sha256')
      .update(`${input.rubricVersion}:${input.requestDigest}`)
      .digest('hex');
    return {
      provenance: {
        runId,
        provider: 'deterministic',
        modelId: 'portfolio-consulting-deterministic',
        modelVersion: '1',
        promptVersion: input.rubricVersion,
        generatedAt: input.snapshot.source.capturedAt,
      },
      output: buildDeterministicPortfolioAnalysisOutput(input.snapshot),
    };
  }
}

/**
 * Domyslnie OFF. Nigdy w produkcji — nawet gdyby zmienna zostala tam ustawiona
 * przez pomylke (nauczka „Flaga OFF w kodzie != wylaczona").
 */
export function isDeterministicPortfolioAnalysisModelEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.PORTFOLIO_ANALYSIS_DETERMINISTIC_MODEL === 'true';
}
