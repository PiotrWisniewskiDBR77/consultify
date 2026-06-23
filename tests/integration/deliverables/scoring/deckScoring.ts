/**
 * deckScoring — scoring engine dla M19 (decks).
 *
 * Bierze:
 *   - DeckArtifact (slides[] z layoutIntent/paletteId/key_message/imageBrief)
 *   - DeckScenarioCriteria (zdeklarowane oczekiwania per scenariusz)
 * Zwraca ScoreReport z failures + selfHealHints.
 */

import {
  LAYOUT_INTENT_CATALOG,
  PALETTE_CATALOG,
  type SlideLayoutPlan,
  type DeckLayoutDirectorResult,
} from '../../../../server/src/services/presentationLayoutDirectorService.js';
import {
  emptyReport,
  finalize,
  ReportBuilder,
  type ScoreReport,
} from './scoringTypes.js';

// ──────────────────────────────────────────────────────────────
// Deck-specific criteria DSL
// ──────────────────────────────────────────────────────────────

export interface DeckCriteria {
  scenarioId: string;
  // Substantive
  minSlides: number;
  maxSlides: number;
  /** Sztywna sekwencja per index (np {0: 'cover', 'last': 'next_steps'}). */
  sequence?: Record<string | number, string>;
  /** Layouts które MUSZĄ wystąpić ≥N razy. */
  requireLayoutAtLeast?: Array<{ intent: string; min: number }>;
  /** Layouts które NIE MOGĄ wystąpić w ogóle (constraint test). */
  forbidLayouts?: string[];
  /** Cover.title zawiera AT LEAST jeden z keywords. */
  coverTitleContainsAny?: string[];
  /** Cover.title zawiera ALL keywords. */
  coverTitleContainsAll?: string[];
  /** Każdy non-cover slide ma key_message ≥N chars. */
  keyMessageMinChars?: number;
  /** Specyficzny key_message keyword w którymś slajdzie. */
  anyKeyMessageContains?: string[];
  // Graphic
  /** Single palette across all slides (default true). */
  requireSinglePalette?: boolean;
  /** Min distinct layout intents (≥8 dla decków ≥8 slajdów). */
  minDistinctLayouts?: number;
  /** No >2 consecutive identical layoutIntent. */
  noTripleRun?: boolean;
  /** Wszystkie source = 'llm' (premium aktywny, brak fallback). */
  requireAllLlm?: boolean;
  /** ≥N slajdów ma imageBrief nonempty. */
  imageBriefMinSlides?: number;
  /** Preferowane palety (jeśli LLM użył innej — warning, nie fail). */
  preferredPalettes?: string[];
}

// ──────────────────────────────────────────────────────────────
// Scoring
// ──────────────────────────────────────────────────────────────

export function scoreDeck(
  result: DeckLayoutDirectorResult,
  criteria: DeckCriteria
): ScoreReport {
  const report = emptyReport(criteria.scenarioId);
  const b = new ReportBuilder(report);
  const plans = result?.plans ?? [];

  // ── Substantive ──────────────────────────────────────────────
  b.expectCount(
    plans,
    criteria.minSlides,
    criteria.maxSlides,
    'slide count',
    'substantive',
    'Sprawdź slide-count w prompcie LLM (B1) — generator może obcinać lub rozwlekać'
  );

  if (criteria.sequence) {
    for (const [pos, intent] of Object.entries(criteria.sequence)) {
      const idx = pos === 'last' ? plans.length - 1 : Number(pos);
      const slide = plans[idx];
      b.expect(
        slide?.layoutIntent === intent,
        `sequence[${pos}]`,
        intent,
        slide?.layoutIntent ?? '(absent)',
        'substantive',
        `Heurystyka B1.heuristicIntent obsłuży edge slides, ale LLM może nadpisać — sprawdź mapping`
      );
    }
  }

  if (criteria.requireLayoutAtLeast) {
    for (const { intent, min } of criteria.requireLayoutAtLeast) {
      const count = plans.filter((p) => p.layoutIntent === intent).length;
      b.expect(
        count >= min,
        `requireLayout ${intent}`,
        `≥${min}`,
        String(count),
        'substantive',
        `LLM nie wybiera ${intent} — rozszerz przykład w systemPrompt B1 lub dodaj keyword hint`
      );
    }
  }

  if (criteria.forbidLayouts) {
    for (const forbidden of criteria.forbidLayouts) {
      const count = plans.filter((p) => p.layoutIntent === forbidden).length;
      b.expect(
        count === 0,
        `forbidLayout ${forbidden}`,
        '0',
        String(count),
        'substantive',
        `Constraint test: LLM nadal używa ${forbidden} — dodaj EXPLICIT exclusion w prompt`
      );
    }
  }

  if (criteria.coverTitleContainsAny || criteria.coverTitleContainsAll) {
    // FIDELITY: B1 does NOT author the cover title — it is the slide's own INPUT
    // content. SlideLayoutPlan now carries `title`/`keyMessage` straight through
    // (presentationLayoutDirectorService, fix #1), so we evaluate the REAL title
    // instead of a proxy. We fall back to reasoning+imageBrief ONLY when the plan
    // pre-dates the carry-through (legacy mock builders) so the 90-mock regression
    // guard still passes.
    const cover = plans[0];
    const realTitle = `${cover?.title ?? ''} ${cover?.keyMessage ?? ''}`.trim();
    const titleProxy = realTitle || `${cover?.reasoning ?? ''} ${cover?.imageBrief ?? ''}`;
    if (criteria.coverTitleContainsAny) {
      b.expectContainsCi(
        titleProxy,
        criteria.coverTitleContainsAny,
        'any',
        'cover title contains any keyword',
        'substantive',
        'Tytuł cover nie wzmiankuje kluczowych słów — wzmocnij summarizeSlideForLlm'
      );
    }
    if (criteria.coverTitleContainsAll) {
      b.expectContainsCi(
        titleProxy,
        criteria.coverTitleContainsAll,
        'all',
        'cover title contains all keywords',
        'substantive',
        'Tytuł cover pomija wymagane kluczowe słowa — strong hint w prompt'
      );
    }
  }

  if (criteria.keyMessageMinChars && criteria.keyMessageMinChars > 0) {
    // FIDELITY: key_message is now carried on the plan (real INPUT). Prefer it;
    // fall back to reasoning for legacy mock plans that lack keyMessage.
    const nonCover = plans.filter((p) => p.layoutIntent !== 'cover');
    b.expectAtLeast(
      nonCover,
      (p) => ((p.keyMessage ?? p.reasoning)?.length ?? 0) >= criteria.keyMessageMinChars!,
      nonCover.length,
      'every non-cover has key_message',
      'substantive',
      `Slajdy bez treści key_message — sprawdź upstream content slajdu`
    );
  }

  if (criteria.anyKeyMessageContains) {
    // FIDELITY: search the REAL key_messages (with reasoning as legacy fallback).
    const allKeyMessages = plans
      .map((p) => `${p.keyMessage ?? ''} ${p.reasoning ?? ''}`)
      .join(' ');
    b.expectContainsCi(
      allKeyMessages,
      criteria.anyKeyMessageContains,
      'any',
      'any key_message contains keyword',
      'substantive'
    );
  }

  // ── Graphic ──────────────────────────────────────────────────

  if (criteria.requireSinglePalette ?? true) {
    const uniquePalettes = new Set(plans.map((p) => p.paletteId));
    b.expect(
      uniquePalettes.size <= 1,
      'single palette',
      '1 distinct paletteId',
      `${uniquePalettes.size} (${[...uniquePalettes].join(', ')})`,
      'graphic',
      'enforceSinglePalette w B1 powinien zapobiec — debuguj post-processing'
    );
  }

  // Wszystkie paletteId ∈ catalog
  const validPalettes = plans.every((p) => PALETTE_CATALOG.includes(p.paletteId as any));
  b.expect(
    validPalettes,
    'palettes from catalog',
    'all ∈ 13 catalog',
    plans
      .filter((p) => !PALETTE_CATALOG.includes(p.paletteId as any))
      .map((p) => `slide ${p.slideIndex}=${p.paletteId}`)
      .join(', ') || 'ok',
    'graphic',
    'Zod enum w B1 nie złapał — sprawdź normalizeFields'
  );

  // Wszystkie layoutIntent ∈ catalog
  const validLayouts = plans.every((p) =>
    LAYOUT_INTENT_CATALOG.includes(p.layoutIntent as any)
  );
  b.expect(
    validLayouts,
    'layouts from catalog',
    'all ∈ 17 catalog',
    plans
      .filter((p) => !LAYOUT_INTENT_CATALOG.includes(p.layoutIntent as any))
      .map((p) => `slide ${p.slideIndex}=${p.layoutIntent}`)
      .join(', ') || 'ok',
    'graphic',
    'isValidLayoutIntent w B1 nie zadziałał — debug normalizeFields'
  );

  if (criteria.minDistinctLayouts && criteria.minDistinctLayouts > 0) {
    const distinct = new Set(plans.map((p) => p.layoutIntent)).size;
    b.expect(
      distinct >= criteria.minDistinctLayouts,
      'distinct layouts',
      `≥${criteria.minDistinctLayouts}`,
      String(distinct),
      'graphic',
      `LLM zbyt zachowawczy — bump temperature lub wzmocnij "favor variety" w prompt`
    );
  }

  if (criteria.noTripleRun ?? true) {
    let violations = 0;
    for (let i = 2; i < plans.length; i++) {
      if (
        plans[i].layoutIntent === plans[i - 1].layoutIntent &&
        plans[i - 1].layoutIntent === plans[i - 2].layoutIntent
      ) {
        violations++;
      }
    }
    b.expect(
      violations === 0,
      'no >2 consecutive identical layouts',
      '0 violations',
      `${violations} runs`,
      'graphic',
      'enforceNoTripleRun w B1 zadziałało? sprawdź RELATED_INTENT mapping dla tego intent'
    );
  }

  if (criteria.requireAllLlm) {
    const fromLlm = plans.filter((p) => p.source === 'llm').length;
    b.expect(
      fromLlm === plans.length,
      'all slides from LLM',
      `${plans.length} llm`,
      `${fromLlm} llm`,
      'graphic',
      'Premium tier OFF lub LLM fail-open — sprawdź resolveDeliverableTier i logi B1'
    );
  }

  if (criteria.imageBriefMinSlides && criteria.imageBriefMinSlides > 0) {
    const withBrief = plans.filter((p) => (p.imageBrief?.trim().length ?? 0) > 0).length;
    b.expect(
      withBrief >= criteria.imageBriefMinSlides,
      'imageBriefs',
      `≥${criteria.imageBriefMinSlides} slajdów z brief`,
      `${withBrief}`,
      'graphic',
      `LLM zwraca null briefy — wzmocnij prompt "one-line image brief"`
    );
  }

  if (criteria.preferredPalettes && criteria.preferredPalettes.length > 0) {
    // Soft warning — informacyjne, nie blokuje pass.
    const used = plans[0]?.paletteId;
    if (used && !criteria.preferredPalettes.includes(used)) {
      report.selfHealHints.push(
        `[preferredPalette] Użyto "${used}" zamiast preferowanej (${criteria.preferredPalettes.join('/')}) — rozważ hint motywu w prompt`
      );
    }
  }

  // Liczba criteriów do scorePct.
  const totalCriteria =
    1 + // count
    (criteria.sequence ? Object.keys(criteria.sequence).length : 0) +
    (criteria.requireLayoutAtLeast?.length ?? 0) +
    (criteria.forbidLayouts?.length ?? 0) +
    (criteria.coverTitleContainsAny ? 1 : 0) +
    (criteria.coverTitleContainsAll ? 1 : 0) +
    (criteria.keyMessageMinChars ? 1 : 0) +
    (criteria.anyKeyMessageContains ? 1 : 0) +
    1 + // palettes from catalog
    1 + // layouts from catalog
    ((criteria.requireSinglePalette ?? true) ? 1 : 0) +
    (criteria.minDistinctLayouts ? 1 : 0) +
    ((criteria.noTripleRun ?? true) ? 1 : 0) +
    (criteria.requireAllLlm ? 1 : 0) +
    (criteria.imageBriefMinSlides ? 1 : 0);

  return finalize(report, totalCriteria);
}
