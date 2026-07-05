/**
 * deckDesignCritic — W7.2: design-rule critic loop (Krok 3 gramatyki układu).
 *
 * Ocenia POJEDYNCZY slajd wg twardych reguł projektowych McKinsey/Tufte i zwraca
 * actionable krytyki + werdykt „regeneruj czy zostaw". To warstwa NAD detektorem
 * anti-patternów (W12.1) — tamten patrzy na DECK jako całość, ten na pojedynczy
 * slajd pod kątem KOMPOZYCJI (typografia/kontrast/gęstość/grid).
 *
 * Reguły (każda = krytyka z severity + fix-hint):
 *   DR-01  Density     — ≤6 bulletów, ≤ ~40 słów treści (slajd ≠ dokument)
 *   DR-02  Title       — tytuł 3-14 słów (action-title, nie etykieta, nie zdanie)
 *   DR-03  Contrast    — tekst na tle musi przejść WCAG AA-large (≥3:1)
 *   DR-04  KeyMessage  — teza obecna i konkretna (≥20 znaków) dla slajdów treści
 *   DR-05  BulletLen   — żaden bullet > 18 słów (jedna myśl = jedna linia)
 *   DR-06  Grid        — gdy podano regiony: brak overlapów, w granicach 0..1
 *
 * Pętla: `critiqueDeck` agreguje per-slajd; `shouldRegenerate` mówi czy warto
 * regenerować (są krytyki CRITICAL). Deterministyczne, bez LLM, fail-open.
 */

import { contrastRatio } from './paletteLibrary.js';
import logger from '../../utils/Logger.js';

// ── Typy ─────────────────────────────────────────────────────────────────────

export type CritiqueSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type DesignRuleCode =
  | 'DR-01-DENSITY'
  | 'DR-02-TITLE-LENGTH'
  | 'DR-03-CONTRAST'
  | 'DR-04-KEY-MESSAGE'
  | 'DR-05-BULLET-LENGTH'
  | 'DR-06-GRID-OVERLAP';

export interface Critique {
  code: DesignRuleCode;
  severity: CritiqueSeverity;
  message: string;
  /** Konkretna sugestia naprawy (do regen-prompta lub edytora). */
  fixHint: string;
}

export interface SlideCritique {
  slideIndex: number;
  critiques: Critique[];
  /** 0-100 — 100 = bez zastrzeżeń. CRITICAL -25, MAJOR -10, MINOR -3. */
  score: number;
  passed: boolean; // brak CRITICAL
}

export interface DeckCritique {
  slides: SlideCritique[];
  /** Średni score wszystkich slajdów. */
  overallScore: number;
  /** Indeksy slajdów do regeneracji (mają CRITICAL). */
  regenerateSlides: number[];
  passed: boolean;
}

/** Region grid (0..1 znormalizowane) — opcjonalny input dla DR-06. */
export interface GridRegion {
  x: number; y: number; w: number; h: number;
}

/** Minimalny kształt slajdu — kompatybilny z SlideLayoutPlan + composition. */
export interface CritiqueSlideInput {
  slideIndex?: number;
  layoutIntent?: string;
  title?: string | null;
  keyMessage?: string | null;
  bullets?: string[];
  /** Para kolorów tekst/tło do sprawdzenia kontrastu (#hex). */
  textColor?: string;
  bgColor?: string;
  /** Regiony kompozycji (gdy renderer emituje grid). */
  regions?: GridRegion[];
}

// ── Progi ────────────────────────────────────────────────────────────────────

const MAX_BULLETS = 6;
const MAX_WORDS_TOTAL = 40;
const TITLE_MIN_WORDS = 3;
const TITLE_MAX_WORDS = 14;
const KEY_MESSAGE_MIN = 20;
const MAX_BULLET_WORDS = 18;

// Slajdy zwolnione z wymogu key-message (DR-04).
const NO_KEY_MESSAGE = new Set(['cover', 'appendix', 'section_intro']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(s: string | null | undefined): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function crit(
  code: DesignRuleCode,
  severity: CritiqueSeverity,
  message: string,
  fixHint: string,
): Critique {
  return { code, severity, message, fixHint };
}

const SEVERITY_PENALTY: Record<CritiqueSeverity, number> = {
  CRITICAL: 25, MAJOR: 10, MINOR: 3,
};

function regionsOverlap(a: GridRegion, b: GridRegion): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

// ── Critic per slajd ─────────────────────────────────────────────────────────

/** Ocenia pojedynczy slajd wg 6 reguł projektowych. */
export function critiqueSlide(slide: CritiqueSlideInput, index = 0): SlideCritique {
  const critiques: Critique[] = [];
  const idx = slide.slideIndex ?? index;
  const intent = slide.layoutIntent ?? '';
  const bullets = slide.bullets ?? [];

  // DR-01 — gęstość
  if (bullets.length > MAX_BULLETS) {
    critiques.push(crit('DR-01-DENSITY', 'CRITICAL',
      `${bullets.length} bulletów (max ${MAX_BULLETS}).`,
      `Rozdziel na 2 slajdy lub zgrupuj w ${MAX_BULLETS} myśli nadrzędnych.`));
  }
  const totalWords = bullets.reduce((n, b) => n + wordCount(b), 0) + wordCount(slide.keyMessage);
  if (totalWords > MAX_WORDS_TOTAL) {
    critiques.push(crit('DR-01-DENSITY', 'MAJOR',
      `~${totalWords} słów na slajdzie (cel ≤${MAX_WORDS_TOTAL}).`,
      'Slajd to nie dokument — przenieś szczegóły do notatek prelegenta.'));
  }

  // DR-02 — długość tytułu
  const titleWords = wordCount(slide.title);
  if (slide.title != null && titleWords > 0) {
    if (titleWords < TITLE_MIN_WORDS) {
      critiques.push(crit('DR-02-TITLE-LENGTH', 'MINOR',
        `Tytuł ${titleWords}-słowny — zbyt etykietowy.`,
        'Użyj action-title: co slajd UDOWADNIA, nie czego dotyczy.'));
    } else if (titleWords > TITLE_MAX_WORDS) {
      critiques.push(crit('DR-02-TITLE-LENGTH', 'MAJOR',
        `Tytuł ${titleWords}-słowny (max ${TITLE_MAX_WORDS}) — to zdanie, nie tytuł.`,
        'Skróć do jednej tezy; resztę przenieś do treści.'));
    }
  }

  // DR-03 — kontrast tekst/tło
  if (slide.textColor && slide.bgColor) {
    const c = contrastRatio(slide.textColor, slide.bgColor);
    if (!c.passesAALarge) {
      critiques.push(crit('DR-03-CONTRAST', 'CRITICAL',
        `Kontrast ${c.ratio}:1 < 3:1 (WCAG AA-large) — tekst nieczytelny.`,
        'Pociemnij tekst lub rozjaśnij tło (użyj readableTextOn()).'));
    } else if (!c.passesAA) {
      critiques.push(crit('DR-03-CONTRAST', 'MINOR',
        `Kontrast ${c.ratio}:1 < 4.5:1 — OK dla dużego tekstu, słaby dla małego.`,
        'Dla treści <18pt zwiększ kontrast do AA (4.5:1).'));
    }
  }

  // DR-04 — teza
  if (!NO_KEY_MESSAGE.has(intent)) {
    const km = slide.keyMessage?.trim() ?? '';
    if (km.length < KEY_MESSAGE_MIN) {
      critiques.push(crit('DR-04-KEY-MESSAGE', 'MAJOR',
        `Teza zbyt krótka/pusta (${km.length} znaków).`,
        'Każdy slajd treści potrzebuje jednozdaniowej tezy answer-first.'));
    }
  }

  // DR-05 — długość bulletów
  bullets.forEach((b, i) => {
    const w = wordCount(b);
    if (w > MAX_BULLET_WORDS) {
      critiques.push(crit('DR-05-BULLET-LENGTH', 'MINOR',
        `Bullet ${i + 1} ma ${w} słów (max ${MAX_BULLET_WORDS}).`,
        'Jedna myśl = jedna linia; podziel lub skróć.'));
    }
  });

  // DR-06 — grid overlap (gdy regiony podane)
  const regions = slide.regions ?? [];
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const outOfBounds = r.x < 0 || r.y < 0 || r.x + r.w > 1.0001 || r.y + r.h > 1.0001;
    if (outOfBounds) {
      critiques.push(crit('DR-06-GRID-OVERLAP', 'MAJOR',
        `Region ${i} poza kanwą (x${r.x} y${r.y} w${r.w} h${r.h}).`,
        'Zmieść regiony w znormalizowanym gridzie 0..1.'));
    }
    for (let j = i + 1; j < regions.length; j++) {
      if (regionsOverlap(r, regions[j])) {
        critiques.push(crit('DR-06-GRID-OVERLAP', 'MAJOR',
          `Region ${i} nachodzi na region ${j}.`,
          'Rozsuń regiony lub użyj gutterów; brak kolizji w gridzie.'));
      }
    }
  }

  const penalty = critiques.reduce((sum, c) => sum + SEVERITY_PENALTY[c.severity], 0);
  const score = Math.max(0, 100 - penalty);
  const passed = !critiques.some((c) => c.severity === 'CRITICAL');

  return { slideIndex: idx, critiques, score, passed };
}

// ── Critic per deck (pętla) ──────────────────────────────────────────────────

/** Ocenia cały deck slajd po slajdzie i agreguje werdykt. */
export function critiqueDeck(slides: CritiqueSlideInput[]): DeckCritique {
  if (!Array.isArray(slides) || slides.length === 0) {
    return { slides: [], overallScore: 100, regenerateSlides: [], passed: true };
  }

  const perSlide = slides.map((s, i) => critiqueSlide(s, i));
  const overallScore = Math.round(
    perSlide.reduce((sum, s) => sum + s.score, 0) / perSlide.length,
  );
  const regenerateSlides = perSlide.filter((s) => !s.passed).map((s) => s.slideIndex);
  const passed = regenerateSlides.length === 0;

  if (!passed) {
    logger.warn('[deckDesignCritic] deck has slides needing regen', {
      regenerateSlides, overallScore,
    });
  }

  return { slides: perSlide, overallScore, regenerateSlides, passed };
}

/** Czy deck warto regenerować? (są slajdy z CRITICAL). */
export function shouldRegenerate(critique: DeckCritique): boolean {
  return !critique.passed;
}
