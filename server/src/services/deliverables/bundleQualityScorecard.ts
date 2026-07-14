/**
 * bundleQualityScorecard — W10.1: agregat WSZYSTKICH sygnałów jakości wiązki w
 * JEDEN actionable wynik 0-100 + ocena literowa + breakdown per wymiar + top-issues.
 *
 * Cała robota W1/W7/W12 żyje rozproszona w `bundle.quality.*` (beauty, content,
 * factContradictions, antiPatterns, designCritique, docQa, deckQa) + hockey-stick w
 * `spine.validation`. Ten moduł zwija to w jedną liczbę „czy ten materiał jest dobry?"
 * — z TWARDYMI capami (krytyczne wady nie mogą dać „dobrej" oceny) i listą napraw.
 *
 * Deterministyczny, fail-soft (brak wymiaru → wykluczony z wagi, renormalizacja).
 * Konsumowany przez telemetrię (W10) + podgląd jakości w UI.
 */

import type { BundleQuality } from './bundleGenerationRuntime.js';
import type { BusinessPlanSpine } from './businessPlanSpine.js';

// ── Typy ─────────────────────────────────────────────────────────────────────

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DimensionScore {
  key: string;
  label: string;
  /** 0..100 dla tego wymiaru (null gdy brak danych — wykluczony z wagi). */
  score: number | null;
  weight: number;
}

export interface QualityScorecard {
  /** Łączny wynik 0..100 (po capach). */
  overall: number;
  grade: QualityGrade;
  dimensions: DimensionScore[];
  /** Czy zadziałał twardy cap (krytyczna wada). */
  capped: boolean;
  /** Powody capa (puste gdy brak). */
  capReasons: string[];
  /** Actionable top-issues posortowane wg dotkliwości. */
  topIssues: string[];
}

// ── Wagi wymiarów (sumują się; brakujące renormalizowane) ────────────────────
const WEIGHTS = {
  content: 0.2,
  factual: 0.15,
  beauty: 0.15,
  design: 0.15,
  antiPatterns: 0.1,
  docQa: 0.15,
  deckQa: 0.1,
} as const;

// Cap przy twardej wadzie — materiał z krytycznym defektem nie przekroczy 59 (D).
const HARD_CAP = 59;

function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function gradeOf(score: number): QualityGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ── Mapowanie wymiarów na 0..100 ─────────────────────────────────────────────

function scoreContent(q: BundleQuality): number | null {
  if (!q.content) return null;
  const placeholders = q.content.placeholderHits?.length ?? 0;
  const mismatches = q.content.heroNumberMismatches?.length ?? 0;
  // każdy placeholder -15, każdy mismatch -20, baza 100
  return clampScore(100 - placeholders * 15 - mismatches * 20);
}

function scoreFactual(q: BundleQuality, spine?: BusinessPlanSpine | null): number | null {
  const contradictions = q.factContradictions?.length ?? 0;
  // hockey-stick + inne flagi finansowe ze spine (jeśli dostępny)
  const spineFlags =
    spine?.validation?.antiPatterns?.filter((a) => a.severity === 'flag').length ?? 0;
  const spineRejects =
    spine?.validation?.antiPatterns?.filter((a) => a.severity === 'reject').length ?? 0;
  if (q.factContradictions == null && !spine) return null;
  return clampScore(100 - contradictions * 25 - spineRejects * 30 - spineFlags * 8);
}

function scoreBeauty(q: BundleQuality): number | null {
  if (!q.beauty) return null;
  // beauty.overall jest 0..1
  return clampScore((q.beauty.overall ?? 0) * 100);
}

function scoreDesign(q: BundleQuality): number | null {
  if (!q.designCritique) return null;
  return clampScore(q.designCritique.overallScore ?? 0);
}

function scoreAntiPatterns(q: BundleQuality): number | null {
  if (!q.antiPatterns) return null;
  const crit = q.antiPatterns.criticalCount ?? 0;
  const warn = q.antiPatterns.warningCount ?? 0;
  return clampScore(100 - crit * 25 - warn * 6);
}

function scoreDocQa(q: BundleQuality): number | null {
  if (!q.docQa) return null;
  return clampScore(q.docQa.overallScore ?? 0);
}

function scoreDeckQa(q: BundleQuality): number | null {
  if (!q.deckQa) return null;
  const errors = q.deckQa.errorCount ?? 0;
  const warnings = q.deckQa.warningCount ?? 0;
  return clampScore(100 - errors * 20 - warnings * 5);
}

// ── Twarde capy (krytyczne wady) ─────────────────────────────────────────────

function detectCaps(q: BundleQuality, spine?: BusinessPlanSpine | null): string[] {
  const reasons: string[] = [];
  if (q.content && !q.content.passed)
    reasons.push('Content gate FAIL (placeholdery / niespójne hero-numbers).');
  if ((q.factContradictions?.length ?? 0) > 0)
    reasons.push(`${q.factContradictions.length} sprzeczności faktów z kanonem.`);
  if ((q.antiPatterns?.criticalCount ?? 0) > 0)
    reasons.push(`${q.antiPatterns!.criticalCount} krytycznych anti-patternów decka.`);
  if ((q.deckQa?.errorCount ?? 0) > 0)
    reasons.push(`${q.deckQa!.errorCount} błędów strukturalnych M19.`);
  if (q.designCritique && !q.designCritique.passed)
    reasons.push(`Slajdy do regeneracji: ${q.designCritique.regenerateSlides.join(', ')}.`);
  const spineRejects =
    spine?.validation?.antiPatterns?.filter((a) => a.severity === 'reject') ?? [];
  for (const r of spineRejects) reasons.push(`Finanse: ${r.detail}`);
  return reasons;
}

// ── Top issues (actionable, posortowane) ─────────────────────────────────────

function collectTopIssues(q: BundleQuality, spine?: BusinessPlanSpine | null): string[] {
  const issues: string[] = [];
  for (const m of q.content?.heroNumberMismatches ?? []) {
    issues.push(
      `Hero „${m.key}": oczekiwano ${m.expected}, znaleziono warianty ${m.foundVariants.join(' / ')}.`
    );
  }
  for (const c of q.factContradictions ?? []) {
    issues.push(
      `Sprzeczność faktu: ${(c as { detail?: string; message?: string }).detail ?? (c as { message?: string }).message ?? 'liczba niezgodna z kanonem'}.`
    );
  }
  for (const hit of q.antiPatterns?.hits ?? []) {
    if (hit.severity === 'CRITICAL') issues.push(`${hit.code}: ${hit.message}`);
  }
  for (const a of spine?.validation?.antiPatterns ?? []) {
    issues.push(`${a.severity === 'reject' ? '⛔' : '⚠'} ${a.detail}`);
  }
  for (const v of q.deckQa?.topViolations ?? []) {
    if (v.severity === 'error') issues.push(`M19 ${v.rule}: ${v.message}`);
  }
  // unikalne, max 10
  return [...new Set(issues)].slice(0, 10);
}

// ── Główna funkcja ───────────────────────────────────────────────────────────

/**
 * Agreguje `bundle.quality` (+ opcjonalnie spine dla flag finansowych) w scorecard.
 * Brakujące wymiary są wykluczane i waga renormalizowana. Twarde wady capują wynik.
 */
export function buildQualityScorecard(
  quality: BundleQuality | null | undefined,
  spine?: BusinessPlanSpine | null
): QualityScorecard {
  if (!quality) {
    return {
      overall: 0,
      grade: 'F',
      dimensions: [],
      capped: true,
      capReasons: ['Brak danych jakości.'],
      topIssues: [],
    };
  }

  const dims: DimensionScore[] = [
    {
      key: 'content',
      label: 'Treść (placeholdery / hero)',
      score: scoreContent(quality),
      weight: WEIGHTS.content,
    },
    {
      key: 'factual',
      label: 'Integralność faktów',
      score: scoreFactual(quality, spine),
      weight: WEIGHTS.factual,
    },
    {
      key: 'beauty',
      label: 'Estetyka układu',
      score: scoreBeauty(quality),
      weight: WEIGHTS.beauty,
    },
    {
      key: 'design',
      label: 'Reguły projektowe',
      score: scoreDesign(quality),
      weight: WEIGHTS.design,
    },
    {
      key: 'antiPatterns',
      label: 'Anti-patterny decka',
      score: scoreAntiPatterns(quality),
      weight: WEIGHTS.antiPatterns,
    },
    {
      key: 'docQa',
      label: 'QA dokumentu (M18)',
      score: scoreDocQa(quality),
      weight: WEIGHTS.docQa,
    },
    { key: 'deckQa', label: 'QA decka (M19)', score: scoreDeckQa(quality), weight: WEIGHTS.deckQa },
  ];

  // ważona średnia tylko z dostępnych wymiarów (renormalizacja)
  const available = dims.filter((d) => d.score !== null);
  const totalWeight = available.reduce((s, d) => s + d.weight, 0);
  const weighted =
    totalWeight > 0
      ? available.reduce((s, d) => s + (d.score as number) * d.weight, 0) / totalWeight
      : 0;

  const capReasons = detectCaps(quality, spine);
  const capped = capReasons.length > 0;
  const overall = capped ? Math.min(HARD_CAP, clampScore(weighted)) : clampScore(weighted);

  return {
    overall,
    grade: gradeOf(overall),
    dimensions: dims,
    capped,
    capReasons,
    topIssues: collectTopIssues(quality, spine),
  };
}
