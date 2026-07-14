/**
 * DRD Report — Conclusion Layer contract
 *
 * Implements the narrative-generation contract for the DRD client report per
 * `docs/standards/CONCLUSION_LAYER_STANDARD.md §4` (ConclusionInput / ConclusionOutput).
 *
 * NOTE: The referenced standard doc is not present in this branch. This contract is
 * reconstructed to be compatible with the live `ConclusionService` shape
 * (`server/src/services/conclusions/ConclusionService.ts`): every narrative claim
 * carries a confidence level, explicit limits, and evidence references — so the
 * "co-jest → co-znaczy → co-robić → efekt" gap cards never assert un-grounded numbers.
 *
 * HARD RULE ("liczby tylko z silnika" / numbers only from the engine): the LLM layer
 * MUST NOT invent scores. All numeric fields (levels, gaps, percentages, ROI) are
 * computed deterministically from the assessment engine and passed INTO the LLM as
 * read-only context. The LLM only produces prose.
 *
 * The default implementation here is a DETERMINISTIC STUB (no LLM call). It renders
 * grounded prose from the engine facts and is used as the fail-safe fallback.
 *
 * A live LLM narrator IS wired: see `drdLlmNarrator.ts` (`makeLlmNarrator`). It
 * builds a grounded prompt from this ConclusionInput, calls `llmService`
 * (`type: 'text'`, `timeoutMs` ~120s override), and validates the output with the
 * `numbers_from_engine` (hard) + `evidence_link` validators (CONCLUSION_LAYER
 * STANDARD §4.4); on failure it retries once, then falls back to this stub with
 * `narrative: 'deterministic'`. Wire it via
 * `generateDrdReport(scores, meta, { llm: llmService })`.
 */

/** Confidence levels — aligned with ConclusionService.normalizeConfidence(). */
export type ConclusionConfidence = 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';

/** A single evidence pointer — aligned with ConclusionService.EvidenceRef. */
export interface ConclusionEvidenceRef {
  type: string; // e.g. 'drd_area', 'drd_axis', 'assessment_note'
  ref: string; // e.g. area id "1A" or axis id "1"
  excerpt?: string | null;
}

/**
 * ConclusionInput — the read-only, engine-grounded context handed to the narrator.
 * The narrator MAY read every field but MUST NOT change any number.
 */
export interface ConclusionInput {
  /** What kind of narrative block is requested. */
  kind: 'executive_summary' | 'gap_card' | 'dimension_chapter';
  /** ISO language code for the output prose ('pl' | 'en'). */
  language: 'pl' | 'en';
  /** Organization / client name for addressing. */
  organizationName: string;
  /** Deterministic facts the narrator must ground every sentence in. */
  facts: Record<string, unknown>;
  /** Evidence pointers backing the facts (numbers-from-engine provenance). */
  evidence: ConclusionEvidenceRef[];
  /** Optional style hint (tone, length). */
  styleHint?: string;
}

/**
 * ConclusionOutput — the prose result plus its provenance envelope.
 * Structure mirrors a `Conclusion` (statement + confidence + limits + evidence).
 */
export interface ConclusionOutput {
  /** Rendered prose paragraphs (already language-localized). */
  paragraphs: string[];
  /** Confidence in the narrative (NOT in the numbers — those are always engine-exact). */
  confidence: ConclusionConfidence;
  /** Explicit limits of the narrative claim. */
  limits: string;
  /** Evidence carried through from the input. */
  evidence: ConclusionEvidenceRef[];
  /** Whether this was produced by an LLM (false = deterministic stub). */
  aiGenerated: boolean;
  /**
   * Provenance of the prose — 'llm' when a validated model wrote it,
   * 'deterministic' when it came from the stub (either by default or via the
   * LLM fallback path). Surfaced in the report so a deterministic run is never
   * silently passed off as authored analysis (CONCLUSION_LAYER_STANDARD §2 R2).
   */
  narrative: 'llm' | 'deterministic';
}

/**
 * Narrator function contract. A real implementation calls the LLM; the default
 * is the deterministic stub below. Kept sync-or-async to allow either.
 */
export type DrdNarrator = (input: ConclusionInput) => ConclusionOutput | Promise<ConclusionOutput>;

/**
 * DETERMINISTIC STUB narrator — no LLM, no invented numbers.
 *
 * It composes grounded prose purely from `input.facts` (which are engine outputs).
 * This keeps the report fully renderable and testable offline. The prose is
 * intentionally plain; the live LLM narrator (`drdLlmNarrator.ts`) elevates the
 * style while still being forbidden from touching the numbers, and falls back to
 * this stub whenever its output fails validation or the provider errors.
 */
export const deterministicNarrator: DrdNarrator = (input) => {
  const isPL = input.language === 'pl';
  const f = input.facts as Record<string, any>;

  if (input.kind === 'executive_summary') {
    const overallPct = Number(f.overallPercent ?? 0);
    const targetPct = Number(f.targetPercent ?? 0);
    const gapPct = Math.max(0, targetPct - overallPct);
    const strongest = String(f.strongestAxisName ?? '');
    const weakest = String(f.weakestAxisName ?? '');
    const stage = String(f.maturityStage ?? '');
    const nAreas = Number(f.assessedAreas ?? 0);

    const paragraphs = isPL
      ? [
          `${input.organizationName} osiąga zagregowaną dojrzałość cyfrową na poziomie ${overallPct}% wobec celu ${targetPct}% (luka ${gapPct} p.p.), co plasuje organizację w fazie „${stage}”. Ocena objęła ${nAreas} obszarów w 7 osiach transformacji cyfrowej metodyki DRD.`,
          `Najsilniejszą osią jest „${strongest}”, gdzie fundamenty cyfrowe są najlepiej ugruntowane. Największy potencjał wzrostu koncentruje się w osi „${weakest}”, która wyznacza priorytet kolejnej fali inwestycji.`,
          `Profil dojrzałości jest nierównomierny: dojrzałe procesy operacyjne współistnieją z lukami w obszarach o wyższej dźwigni strategicznej. Zamknięcie tych luk wymaga sekwencjonowania działań według relacji wpływ/nakład, a nie równoległego frontu inwestycji.`,
          `Rekomendowana ścieżka to trzy fale wdrożeniowe (F1–F3): najpierw „szybkie zwycięstwa” o wysokim wpływie i niskim nakładzie, następnie inicjatywy strukturalne, na końcu przedsięwzięcia transformacyjne o horyzoncie wieloletnim.`,
          `Wszystkie wartości liczbowe w raporcie pochodzą wyłącznie z silnika oceny DRD i odzwierciedlają stan zarejestrowany w assessmencie. Warstwa narracyjna interpretuje te dane, nie modyfikując ich.`,
        ]
      : [
          `${input.organizationName} reaches an aggregate digital maturity of ${overallPct}% against a ${targetPct}% target (a ${gapPct} pp gap), placing it in the "${stage}" phase. The assessment covered ${nAreas} areas across the 7 axes of the DRD methodology.`,
          `The strongest axis is "${strongest}", where digital foundations are best established. The largest growth potential concentrates in "${weakest}", which sets the priority for the next wave of investment.`,
          `The maturity profile is uneven: mature operational processes coexist with gaps in areas of higher strategic leverage. Closing these gaps requires sequencing by impact/effort rather than a parallel investment front.`,
          `The recommended path is three implementation waves (F1–F3): high-impact/low-effort quick wins first, then structural initiatives, and finally multi-year transformational programs.`,
          `All numeric values in this report originate solely from the DRD assessment engine and reflect the state recorded in the assessment. The narrative layer interprets these figures without altering them.`,
        ];

    return {
      paragraphs,
      confidence: nAreas > 0 ? 'medium' : 'insufficient',
      limits: isPL
        ? 'Interpretacja oparta na danych assessmentu; przed egzekucją zaleca się walidację warsztatową z zespołem klienta.'
        : 'Interpretation based on assessment data; workshop validation with the client team is recommended before execution.',
      evidence: input.evidence,
      aiGenerated: false,
      narrative: 'deterministic',
    };
  }

  if (input.kind === 'gap_card') {
    // co-jest → co-znaczy → co-robić → efekt
    const areaName = String(f.areaName ?? '');
    const actual = Number(f.actual ?? 0);
    const target = Number(f.target ?? 0);
    const maxLevel = Number(f.maxLevel ?? 5);
    const currentLevelTitle = String(f.currentLevelTitle ?? '');
    const targetLevelTitle = String(f.targetLevelTitle ?? '');
    const axisName = String(f.axisName ?? '');

    const paragraphs = isPL
      ? [
          `Co jest: obszar „${areaName}” (${axisName}) znajduje się na poziomie ${actual}/${maxLevel} — „${currentLevelTitle}”.`,
          `Co to znaczy: organizacja nie wykorzystuje jeszcze możliwości poziomu ${target}/${maxLevel} („${targetLevelTitle}”), co ogranicza efektywność i skalowalność w tym obszarze.`,
          `Co robić: zaplanować przejście na poziom ${target}, wdrażając zdolności opisane dla „${targetLevelTitle}”.`,
          `Efekt: domknięcie luki ${Math.round((target - actual) * 10) / 10} poziomu podnosi dojrzałość osi „${axisName}” i odblokowuje kolejne działania zależne.`,
        ]
      : [
          `What is: the "${areaName}" area (${axisName}) sits at level ${actual}/${maxLevel} — "${currentLevelTitle}".`,
          `What it means: the organization does not yet leverage level ${target}/${maxLevel} ("${targetLevelTitle}"), limiting effectiveness and scalability in this area.`,
          `What to do: plan the move to level ${target} by implementing the capabilities described for "${targetLevelTitle}".`,
          `Effect: closing the ${Math.round((target - actual) * 10) / 10}-level gap raises the maturity of the "${axisName}" axis and unblocks dependent actions.`,
        ];

    return {
      paragraphs,
      confidence: 'medium',
      limits: isPL
        ? 'Karta luki opisuje różnicę poziomów zmierzoną przez silnik; szczegółowy zakres prac wymaga doprecyzowania.'
        : 'The gap card describes the engine-measured level difference; detailed scope requires refinement.',
      evidence: input.evidence,
      aiGenerated: false,
      narrative: 'deterministic',
    };
  }

  // dimension_chapter
  const axisName = String(f.axisName ?? '');
  const actual = Number(f.actual ?? 0);
  const target = Number(f.target ?? 0);
  const maxLevel = Number(f.maxLevel ?? 5);
  const paragraphs = isPL
    ? [
        `Oś „${axisName}” osiąga poziom ${actual}/${maxLevel} przy celu ${target}/${maxLevel}. Poniższa tabela obszarów prezentuje rozkład dojrzałości i zidentyfikowane luki, na podstawie których wyznaczono priorytety w tej osi.`,
      ]
    : [
        `The "${axisName}" axis reaches level ${actual}/${maxLevel} against a ${target}/${maxLevel} target. The area table below shows the maturity distribution and identified gaps used to set priorities within this axis.`,
      ];

  return {
    paragraphs,
    confidence: 'medium',
    limits: isPL
      ? 'Opis osi agreguje wyniki obszarów z silnika oceny.'
      : 'The axis description aggregates area results from the assessment engine.',
    evidence: input.evidence,
    aiGenerated: false,
    narrative: 'deterministic',
  };
};
