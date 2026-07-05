/**
 * Deck Anti-Pattern Detector — W12.1
 *
 * Deterministyczna (bez LLM) analiza planów slajdów pod kątem McKinsey anti-patternów:
 *
 *   AP-01  Zbyt wiele punktorów (>6 items w key_message / bullet liście)
 *   AP-02  Generyczny tytuł    ("Agenda" / "Overview" / "Wprowadzenie" / "Wnioski")
 *   AP-03  Brak tezy          (keyMessage puste / <20 znaków)
 *   AP-04  Podwójna intencja  (ta sama intencja na dwóch sąsiednich slajdach)
 *   AP-05  Deck bez cover     (cover nie jest pierwszym slajdem)
 *   AP-06  Deck bez CTA       (brak next_steps / recommendation_single w deck)
 *   AP-07  Zbyt krótki deck   (<4 slajdów — brak struktury narracyjnej)
 *   AP-08  Zbyt długi deck    (>18 slajdów — przekracza uwagę zarządu)
 *
 * Każdy wynik zawiera slideIndex + kod + komunikat + severity (WARNING | CRITICAL).
 * Fail-open: błędy wejścia zwracają pusty raport, nigdy nie rzucają.
 */

import logger from '../../utils/Logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type AntiPatternSeverity = 'WARNING' | 'CRITICAL';
export type AntiPatternCode =
  | 'AP-01-TOO-MANY-BULLETS'
  | 'AP-02-GENERIC-TITLE'
  | 'AP-03-NO-KEY-MESSAGE'
  | 'AP-04-DUPLICATE-INTENT'
  | 'AP-05-NO-COVER'
  | 'AP-06-NO-CTA'
  | 'AP-07-TOO-SHORT'
  | 'AP-08-TOO-LONG';

export interface AntiPatternHit {
  code: AntiPatternCode;
  severity: AntiPatternSeverity;
  slideIndex: number | null;
  message: string;
}

export interface AntiPatternReport {
  passed: boolean;
  criticalCount: number;
  warningCount: number;
  hits: AntiPatternHit[];
}

// Slide plan shape (minimal — works with SlideLayoutPlan from presentationLayoutDirectorService).
// title/keyMessage akceptują null (SlideLayoutPlan ma `string | null`).
interface SlidePlan {
  slideIndex?: number;
  layoutIntent?: string;
  title?: string | null;
  keyMessage?: string | null;
  bullets?: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_BULLETS = 6;
const MIN_KEY_MESSAGE_LENGTH = 20;
const MIN_DECK_SLIDES = 4;
const MAX_DECK_SLIDES = 18;

const GENERIC_TITLES_PL = new Set([
  'agenda', 'overview', 'wprowadzenie', 'wstęp', 'wnioski', 'podsumowanie',
  'slajd', 'tytuł', 'slide', 'title', 'toc', 'spis treści', 'thank you',
  'dziękuję', 'q&a', 'pytania',
]);

const CTA_INTENTS = new Set(['next_steps', 'recommendation_single', 'recommendation_portfolio']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function hit(
  code: AntiPatternCode,
  severity: AntiPatternSeverity,
  slideIndex: number | null,
  message: string,
): AntiPatternHit {
  return { code, severity, slideIndex, message };
}

function isGenericTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return GENERIC_TITLES_PL.has(title.trim().toLowerCase());
}

// ── Detector ─────────────────────────────────────────────────────────────────

/**
 * Analizuje tablicę planów slajdów i zwraca raport anti-patternów.
 * @param plans - plany slajdów (kompatybilne z SlideLayoutPlan[])
 * @param opts  - opcjonalny próg: { maxBullets, minSlides, maxSlides }
 */
export function detectDeckAntiPatterns(
  plans: SlidePlan[],
  opts?: { maxBullets?: number; minSlides?: number; maxSlides?: number },
): AntiPatternReport {
  const hits: AntiPatternHit[] = [];

  if (!Array.isArray(plans) || plans.length === 0) {
    return { passed: true, criticalCount: 0, warningCount: 0, hits: [] };
  }

  const maxBullets = opts?.maxBullets ?? MAX_BULLETS;
  const minSlides = opts?.minSlides ?? MIN_DECK_SLIDES;
  const maxSlides = opts?.maxSlides ?? MAX_DECK_SLIDES;

  // AP-07 / AP-08 — deck length
  if (plans.length < minSlides) {
    hits.push(hit('AP-07-TOO-SHORT', 'CRITICAL', null,
      `Deck ma tylko ${plans.length} slajdy (min ${minSlides}) — brak struktury narracyjnej.`));
  }
  if (plans.length > maxSlides) {
    hits.push(hit('AP-08-TOO-LONG', 'WARNING', null,
      `Deck ma ${plans.length} slajdów (max ${maxSlides}) — przekracza uwagę zarządu.`));
  }

  // AP-05 — brak cover jako pierwszego slajdu
  const firstIntent = plans[0]?.layoutIntent;
  if (firstIntent !== 'cover') {
    hits.push(hit('AP-05-NO-COVER', 'CRITICAL', 0,
      `Pierwszy slajd ma intencję "${firstIntent ?? 'brak'}" — musi być "cover".`));
  }

  // AP-06 — brak CTA w deck
  const hasCta = plans.some((p) => CTA_INTENTS.has(p.layoutIntent ?? ''));
  if (!hasCta) {
    hits.push(hit('AP-06-NO-CTA', 'WARNING', null,
      'Deck nie zawiera slajdu CTA (next_steps / recommendation_single / recommendation_portfolio).'));
  }

  // Per-slide checks
  let prevIntent: string | undefined;
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const idx = plan.slideIndex ?? i;
    const intent = plan.layoutIntent ?? '';

    // AP-04 — duplicate adjacent intent (pominięcie cover → cover częsty łańcuch)
    if (i > 0 && intent === prevIntent && intent !== 'cover') {
      hits.push(hit('AP-04-DUPLICATE-INTENT', 'WARNING', idx,
        `Dwa sąsiednie slajdy mają tę samą intencję "${intent}" (idx ${idx - 1} i ${idx}).`));
    }
    prevIntent = intent;

    // AP-02 — generyczny tytuł
    if (isGenericTitle(plan.title)) {
      hits.push(hit('AP-02-GENERIC-TITLE', 'WARNING', idx,
        `Slajd ${idx} ma generyczny tytuł "${plan.title}" — unikaj: Agenda, Overview, Wnioski.`));
    }

    // AP-03 — brak tezy (pominięcie cover, next_steps, appendix)
    const skipKeyMessageCheck = new Set(['cover', 'appendix', 'section_intro']);
    if (!skipKeyMessageCheck.has(intent)) {
      const km = plan.keyMessage?.trim() ?? '';
      if (km.length < MIN_KEY_MESSAGE_LENGTH) {
        hits.push(hit('AP-03-NO-KEY-MESSAGE', 'WARNING', idx,
          `Slajd ${idx} (${intent}) ma zbyt krótką tezę: "${km.substring(0, 40)}" (<${MIN_KEY_MESSAGE_LENGTH} znaków).`));
      }
    }

    // AP-01 — zbyt wiele punktorów
    const bullets = plan.bullets ?? [];
    if (bullets.length > maxBullets) {
      hits.push(hit('AP-01-TOO-MANY-BULLETS', 'CRITICAL', idx,
        `Slajd ${idx} (${intent}) ma ${bullets.length} punktorów (max ${maxBullets}) — rozdziel na 2 slajdy.`));
    }
  }

  const criticalCount = hits.filter((h) => h.severity === 'CRITICAL').length;
  const warningCount = hits.filter((h) => h.severity === 'WARNING').length;
  const passed = criticalCount === 0;

  if (!passed) {
    logger.warn('[deckAntiPatternDetector] deck failed', { criticalCount, warningCount });
  }

  return { passed, criticalCount, warningCount, hits };
}
