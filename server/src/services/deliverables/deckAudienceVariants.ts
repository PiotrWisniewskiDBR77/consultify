/**
 * deckAudienceVariants (F10.3) — jeden deck (SPINE) → warianty audytorium.
 *
 * Z jednego źródła generujemy kilka „cutów" tej samej prezentacji bez utraty
 * spójności liczb (te same plany, tylko podzbiór slajdów):
 *   - 'board'   = skrót decyzyjny dla zarządu (framing + slajdy decyzyjne, cap ≤N)
 *   - 'working' = pełny zestaw roboczy (wszystkie slajdy)
 *
 * Operuje na SlideLayoutPlan[] (z B1) — NIE zmienia treści slajdów, tylko wybiera
 * podzbiór wg priorytetu intencji. Okładka zawsze pierwsza, zamknięcie zawsze
 * ostatnie (framing zachowany). Czysta funkcja, deterministyczna, nigdy nie rzuca.
 */

import type { SlideLayoutPlan } from '../presentationLayoutDirectorService.js';

export type AudienceVariant = 'board' | 'working';

export interface AudienceVariantResult {
  variant: AudienceVariant;
  plans: SlideLayoutPlan[];
  /** Indeksy slajdów (z oryginału) pominięte w tym cucie — do audytu/telemetrii. */
  droppedSlideIndices: number[];
}

/** Domyślny twardy limit slajdów dla cutu zarządczego. */
export const BOARD_CUT_MAX = 7;

// Intencje „framingowe" — ZAWSZE zachowane (otwarcie/zamknięcie/teza).
const FRAMING_INTENTS = new Set<string>([
  'cover',
  'executive_summary',
  'next_steps',
  'conclusion',
  'summary',
]);

// Intencje decyzyjne — priorytet w cucie zarządczym (po framingu).
const BOARD_CRITICAL_INTENTS = new Set<string>([
  'key_messages',
  'single_insight',
  'recommendation_single',
  'recommendation_portfolio',
  'performance_overview',
  'prioritization_matrix',
  'risk_management',
]);

function priorityTier(intent: string): 0 | 1 | 2 {
  if (FRAMING_INTENTS.has(intent)) return 0;
  if (BOARD_CRITICAL_INTENTS.has(intent)) return 1;
  return 2;
}

/**
 * Zbuduj wariant audytorium z planów decka.
 *
 * @param plans   Pełny zestaw planów (working = źródło).
 * @param variant 'board' (skrót) | 'working' (pełny).
 * @param maxSlides  Limit dla board cut (domyślnie BOARD_CUT_MAX).
 */
export function buildAudienceVariant(
  plans: SlideLayoutPlan[],
  variant: AudienceVariant,
  maxSlides: number = BOARD_CUT_MAX
): AudienceVariantResult {
  const sorted = plans.slice().sort((a, b) => a.slideIndex - b.slideIndex);

  if (variant === 'working' || sorted.length <= maxSlides) {
    return { variant, plans: sorted, droppedSlideIndices: [] };
  }

  // Board cut: keep framing (tier 0) + top board-critical (tier 1) up to cap.
  // Tier 2 dropped first. Stable selection by (tier asc, original order asc).
  const ranked = sorted
    .map((p, pos) => ({ p, pos, tier: priorityTier(p.layoutIntent) }))
    .sort((a, b) => (a.tier - b.tier) || (a.pos - b.pos));

  const keepPositions = new Set<number>();
  for (const r of ranked) {
    if (keepPositions.size >= maxSlides) break;
    keepPositions.add(r.pos);
  }

  // Always force the first (cover-ish) and last (closer) slide into the cut.
  keepPositions.add(0);
  keepPositions.add(sorted.length - 1);

  const kept: SlideLayoutPlan[] = [];
  const dropped: number[] = [];
  sorted.forEach((p, pos) => {
    if (keepPositions.has(pos)) kept.push(p);
    else dropped.push(p.slideIndex);
  });

  // Re-index slides so the cut is a clean 0..N-1 sequence.
  const reindexed = kept.map((p, i) => ({ ...p, slideIndex: i }));

  return { variant, plans: reindexed, droppedSlideIndices: dropped };
}

/** Wygodny skrót: zbuduj OBA warianty z jednego źródła (board + working). */
export function buildBothVariants(
  plans: SlideLayoutPlan[],
  maxSlides: number = BOARD_CUT_MAX
): { board: AudienceVariantResult; working: AudienceVariantResult } {
  return {
    board: buildAudienceVariant(plans, 'board', maxSlides),
    working: buildAudienceVariant(plans, 'working', maxSlides),
  };
}
