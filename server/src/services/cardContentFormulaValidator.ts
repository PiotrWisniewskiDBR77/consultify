/**
 * CARD_CONTENT_FORMULA validator (OXFORD O7.3).
 *
 * SSOT: docs/standards/CARD_CONTENT_FORMULA.md — the McKinsey-grade card-content
 * doctrine. This module is a pure, deterministic scorer that evaluates a fully
 * generated Insight card OR Initiative card against §A/§B3 and returns a
 * 0–100 score plus a list of coded violations.
 *
 * DESIGN CONTRACT (per O7.3):
 *   - Pure functions, no I/O — takes a card object, returns a verdict.
 *   - ADVISORY ONLY — this is a quality guardian, never a hard gate. Callers
 *     use the verdict to trigger a single auto-repair pass or to log a warning;
 *     they MUST NOT block persistence on it.
 *   - Tolerant of missing/partial fields (treat absent as empty, never throw).
 *   - Violations carry a stable machine code (e.g. `insight.summary_len`) so a
 *     repair prompt can enumerate exactly what to fix, and logs stay greppable.
 *
 * The existing `initiative/initiativeCardValidators.ts` holds the low-level §B3
 * structural checks for initiatives; this module reuses them and layers a
 * scored verdict on top, and adds the (previously missing) Insight validators.
 */

import {
  validateCardStructure,
  type CardValidationResult,
  type InitiativeCardData,
} from './initiative/initiativeCardValidators.js';

// ────────────────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────────────────

export type CardKind = 'insight' | 'initiative';

export type ViolationSeverity = 'hard' | 'soft';

export interface FormulaViolation {
  /** Stable machine code, e.g. `insight.summary_len`, `initiative.raid_mix`. */
  code: string;
  /** `hard` = §A6 anti-pattern / crash-risk; `soft` = quality below target. */
  severity: ViolationSeverity;
  /** Human-readable PL message (fits the repair prompt and warning logs). */
  message: string;
}

export interface FormulaVerdict {
  kind: CardKind;
  /** 0–100. PASS threshold per §B4 is ≥90. */
  score: number;
  /** True when score ≥ passThreshold AND no hard violations. */
  pass: boolean;
  /** §B4 PASS threshold (default 90). */
  passThreshold: number;
  violations: FormulaViolation[];
  /** Just the codes, for compact logging. */
  violationCodes: string[];
}

const PASS_THRESHOLD = 90;

// ────────────────────────────────────────────────────────────────────────────
// Shared primitives (§A5 dictionary, §A6 filler, word counting)
// ────────────────────────────────────────────────────────────────────────────

/** §A5 — acronyms/methodologies allowed inside otherwise-Polish prose. */
const ALLOWED_TOKENS = new Set(
  [
    'sipoc', 'flowchart', 'raci', 'raid', 'kpi', 'sla', 'otif', 'tto', 'ttr',
    'nps', 'mece', 'pmo', 'wbs', 'capex', 'opex', 'roi', 'npv', 'scada', 'osd',
    'osp', 'pse', 'go', 'no', 'ok',
  ].map((s) => s.toLowerCase())
);

/** Common English function words — 2+ in prose signal EN drift (§A6.1). */
const EN_STOPWORDS = new Set([
  'the', 'and', 'with', 'this', 'that', 'for', 'are', 'will', 'from', 'which',
  'have', 'has', 'these', 'those', 'their', 'them', 'they', 'because', 'should',
  'would', 'could', 'about', 'into', 'over', 'between', 'process', 'value',
  'improve', 'increase', 'reduce', 'ensure', 'provide', 'across', 'within',
]);

/**
 * §A6 forbidden fillers / placeholders. Includes the generic-title anti-patterns
 * the task calls out ("Key message for", "Improve X").
 */
const FILLER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\blorem ipsum\b/i, label: 'Lorem ipsum' },
  { re: /\bTODO\b/, label: 'TODO' },
  { re: /\bTBD\b/i, label: 'TBD' },
  { re: /\bplaceholder\b/i, label: 'placeholder' },
  { re: /\bfoo\b|\bbar\b/i, label: 'foo/bar' },
  { re: /\bxxx+\b/i, label: 'xxx' },
  { re: /\[[^\]]{0,40}\]/, label: 'nawias-placeholder' },
  { re: /\bto be (defined|determined|added)\b/i, label: 'to be …' },
  { re: /key message for/i, label: '„Key message for…"' },
  { re: /\bsample (text|content|title)\b/i, label: 'sample …' },
  { re: /\b(insert|add) (your )?(text|content) here\b/i, label: '„insert text here"' },
];

/**
 * Generic "Improve X" / "poprawić X" titles with no substance (§A6, §C1).
 * A bare verb + noun with no metric / mechanism = filler title.
 */
const GENERIC_TITLE_RE =
  /^(improve|enhance|optimi[sz]e|better|fix|poprawi[cć]|usprawni[cć]|zoptymalizowa[cć]|popraw|usprawnij)\b/i;

function words(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-ząćęłńóśźż0-9]+/)
    .filter(Boolean);
}

function sentenceCount(text: string): number {
  return String(text || '')
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

/** Detect ≥2 English stopwords in prose (outside §A5 dictionary). */
function looksEnglish(text: string): string[] {
  const hits = new Set(
    words(text).filter((w) => EN_STOPWORDS.has(w) && !ALLOWED_TOKENS.has(w))
  );
  return [...hits];
}

/** First filler match label, or null. */
function fillerHit(text: string): string | null {
  const hit = FILLER_PATTERNS.find(({ re }) => re.test(String(text || '')));
  return hit ? hit.label : null;
}

/** Does the text carry any quantification (number, %, currency, days)? */
function hasQuantification(text: string): boolean {
  return /\d/.test(String(text || ''));
}

/** Tolerant array coercion: undefined→[], scalar→[scalar], JSON string→parsed. */
function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((v) => v != null && v !== '');
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.filter((v) => v != null && v !== '') : [s];
      } catch {
        /* not JSON */
      }
    }
    return [s];
  }
  return [value];
}

function str(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function refsOf(item: unknown): unknown[] {
  if (item == null || typeof item !== 'object') return [];
  const o = item as Record<string, unknown>;
  return asArray(o.evidence_refs ?? o.evidenceRefs ?? o.evidence);
}

function titleOf(item: unknown): string {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    const o = item as Record<string, unknown>;
    return str(o.title ?? o.name ?? o.label);
  }
  return '';
}

function descOf(item: unknown): string {
  if (item == null || typeof item !== 'object') return typeof item === 'string' ? item : '';
  const o = item as Record<string, unknown>;
  return str(o.description ?? o.desc ?? o.detail ?? o.text);
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring helper — start at 100, subtract per violation, floor at 0.
// ────────────────────────────────────────────────────────────────────────────

function buildVerdict(kind: CardKind, violations: FormulaViolation[]): FormulaVerdict {
  // Hard violations cost more (they are §A6 auto-FAILs / crash-risks); soft cost less.
  let score = 100;
  for (const v of violations) {
    score -= v.severity === 'hard' ? 18 : 8;
  }
  score = Math.max(0, Math.min(100, score));
  const hasHard = violations.some((v) => v.severity === 'hard');
  return {
    kind,
    score,
    pass: score >= PASS_THRESHOLD && !hasHard,
    passThreshold: PASS_THRESHOLD,
    violations,
    violationCodes: violations.map((v) => v.code),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// INSIGHT validator (§A2 / §B3-Wniosek) — previously missing.
// ────────────────────────────────────────────────────────────────────────────

/** Loosely-typed insight card — snake_case (generation) or camelCase (persisted) tolerated. */
export interface InsightCardData {
  title?: unknown;
  executive_summary?: unknown;
  executiveSummary?: unknown;
  themes?: unknown;
  issues?: unknown;
  opportunities?: unknown;
  signals?: unknown;
  evidence_map?: unknown;
  evidenceMap?: unknown;
  missing_data?: unknown;
  missingData?: unknown;
  material_quality?: unknown;
  materialQuality?: unknown;
  content?: unknown;
  [k: string]: unknown;
}

/** Material-quality sub-fields the renderer (InsightViewer) needs — §A6.2 hard rule. */
const MATERIAL_QUALITY_REQUIRED = ['score', 'limitations', 'missing_voices', 'recommended_followups'];

export function validateInsightCard(card: InsightCardData | null | undefined): FormulaVerdict {
  const violations: FormulaViolation[] = [];
  const c = card || {};
  const P = 'insight';

  const title = str(c.title);
  const summary = str(c.executive_summary ?? c.executiveSummary);
  const themes = asArray(c.themes);
  const issues = asArray(c.issues);
  const opportunities = asArray(c.opportunities);
  const evidenceMap = asArray(c.evidence_map ?? c.evidenceMap);
  const missingData = asArray(c.missing_data ?? c.missingData);
  const materialQuality = c.material_quality ?? c.materialQuality;
  const content = str(c.content);

  // Aggregate visible prose for language / filler scans.
  const proseFields: { name: string; text: string }[] = [
    { name: 'title', text: title },
    { name: 'executive_summary', text: summary },
    ...themes.map((t, i) => ({ name: `theme[${i}]`, text: `${titleOf(t)} ${descOf(t)}` })),
    ...issues.map((it, i) => ({ name: `issue[${i}]`, text: `${titleOf(it)} ${descOf(it)}` })),
    { name: 'content', text: content },
  ];

  // §A2 Tytuł — required, ≤14 words.
  if (!title.trim()) {
    violations.push({ code: `${P}.title_present`, severity: 'hard', message: 'Brak tytułu wniosku.' });
  } else if (words(title).length > 14) {
    violations.push({
      code: `${P}.title_len`,
      severity: 'soft',
      message: `Tytuł ma ${words(title).length} słów (max 14).`,
    });
  }

  // §B3 summary_len — 60–130 words, ≥3 sentences.
  const summaryWords = words(summary).length;
  if (!summary.trim()) {
    violations.push({
      code: `${P}.summary_present`,
      severity: 'hard',
      message: 'Brak podsumowania (executive_summary).',
    });
  } else {
    if (summaryWords < 60 || summaryWords > 130) {
      violations.push({
        code: `${P}.summary_len`,
        severity: 'soft',
        message: `Podsumowanie ma ${summaryWords} słów (oczekiwane 60–130).`,
      });
    }
    if (sentenceCount(summary) < 3) {
      violations.push({
        code: `${P}.summary_sentences`,
        severity: 'soft',
        message: 'Podsumowanie powinno mieć ≥3 zdania (answer-first + so-what + poziom pewności).',
      });
    }
  }

  // §B3 themes_count — ≥3; each with ≥50-word desc + ≥1 evidence_ref.
  if (themes.length < 3) {
    violations.push({
      code: `${P}.themes_count`,
      severity: 'soft',
      message: `Motywy: ${themes.length} (wymagane ≥3).`,
    });
  }
  themes.forEach((t, i) => {
    if (words(descOf(t)).length < 50) {
      violations.push({
        code: `${P}.theme_desc_len`,
        severity: 'soft',
        message: `Motyw #${i + 1} ma opis <50 słów.`,
      });
    }
    if (refsOf(t).length < 1) {
      violations.push({
        code: `${P}.theme_evidence`,
        severity: 'soft',
        message: `Motyw #${i + 1} nie ma evidence_refs (ugruntowanie §A8).`,
      });
    }
  });

  // §B3 issues_count — ≥2; each with severity + ≥1 evidence_ref.
  if (issues.length < 2) {
    violations.push({
      code: `${P}.issues_count`,
      severity: 'soft',
      message: `Problemy: ${issues.length} (wymagane ≥2).`,
    });
  }
  issues.forEach((it, i) => {
    const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
    if (!str(o.severity).trim()) {
      violations.push({
        code: `${P}.issue_severity`,
        severity: 'soft',
        message: `Problem #${i + 1} nie ma severity.`,
      });
    }
    if (refsOf(it).length < 1) {
      violations.push({
        code: `${P}.issue_evidence`,
        severity: 'soft',
        message: `Problem #${i + 1} nie ma evidence_refs.`,
      });
    }
  });

  // §B3 missing_data_count — ≥2.
  if (missingData.length < 2) {
    violations.push({
      code: `${P}.missing_data_count`,
      severity: 'soft',
      message: `Braki danych: ${missingData.length} (wymagane ≥2).`,
    });
  }

  // §B3 evidence_map_cover — snippet ≤120 chars; ≥1 entry when refs exist.
  const anyRefs =
    themes.some((t) => refsOf(t).length > 0) ||
    issues.some((it) => refsOf(it).length > 0) ||
    opportunities.some((op) => refsOf(op).length > 0);
  if (anyRefs && evidenceMap.length < 1) {
    violations.push({
      code: `${P}.evidence_map_cover`,
      severity: 'soft',
      message: 'Użyto evidence_refs, ale mapa dowodów (evidence_map) jest pusta.',
    });
  }
  evidenceMap.forEach((entry, i) => {
    const snippet = str((entry as any)?.answer_snippet);
    if (snippet.length > 120) {
      violations.push({
        code: `${P}.evidence_snippet_len`,
        severity: 'soft',
        message: `Fragment dowodu #${i + 1} ma ${snippet.length} znaków (max 120).`,
      });
    }
  });

  // §A6.2 material_quality_complete — HARD (crash-risk in InsightViewer).
  if (!materialQuality || typeof materialQuality !== 'object') {
    violations.push({
      code: `${P}.material_quality_complete`,
      severity: 'hard',
      message: 'Brak obiektu material_quality (§A6.2 — ryzyko crashu UI).',
    });
  } else {
    const mq = materialQuality as Record<string, unknown>;
    const missingSub = MATERIAL_QUALITY_REQUIRED.filter((k) => {
      const v = mq[k] ?? mq[toCamel(k)];
      return v == null;
    });
    if (missingSub.length > 0) {
      violations.push({
        code: `${P}.material_quality_complete`,
        severity: 'hard',
        message: `material_quality niekompletny — brak podpól: ${missingSub.join(', ')} (§A6.2).`,
      });
    }
  }

  // §B3 content_len — 350–700 words (legacy markdown body). Only checked when present.
  if (content.trim()) {
    const cw = words(content).length;
    if (cw < 350 || cw > 700) {
      violations.push({
        code: `${P}.content_len`,
        severity: 'soft',
        message: `Opis (content) ma ${cw} słów (oczekiwane 350–700).`,
      });
    }
  }

  // §A6.1 lang_pl — Polish prose (checked on the longest prose fields).
  for (const f of proseFields) {
    if (!f.text.trim()) continue;
    const enHits = looksEnglish(f.text);
    if (enHits.length >= 2) {
      violations.push({
        code: `${P}.lang_pl`,
        severity: 'soft',
        message: `Pole „${f.name}" wygląda na angielskie (np. ${enHits.slice(0, 3).join(', ')}).`,
      });
      break; // one lang_pl violation is enough signal
    }
  }

  // §A6 no_filler — placeholders anywhere in prose.
  for (const f of proseFields) {
    const label = fillerHit(f.text);
    if (label) {
      violations.push({
        code: `${P}.no_filler`,
        severity: 'hard',
        message: `Wypełniacz/placeholder w polu „${f.name}": ${label}.`,
      });
      break;
    }
  }

  return buildVerdict('insight', violations);
}

function toCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}

// ────────────────────────────────────────────────────────────────────────────
// INITIATIVE validator (§A3 / §B3-Inicjatywa) — scored wrapper over the
// existing structural validators + prose/title checks.
// ────────────────────────────────────────────────────────────────────────────

const HYPOTHESIS_RE = /Jeśli .+ to .+ (bo|ponieważ) .+/i;

/** Map a structural CardValidationResult id to a hard/soft severity. */
function initiativeRuleSeverity(id: string): ViolationSeverity {
  // KPI baseline→target and RAID mix are §A6 auto-FAILs.
  if (id === 'kpi_baseline_target' || id === 'raid_mix') return 'hard';
  return 'soft';
}

export interface InitiativeCardInput extends InitiativeCardData {
  title?: unknown;
  problem_statement?: unknown;
  problemStatement?: unknown;
  hypothesis?: unknown;
  summary?: unknown;
  description?: unknown;
  business_value?: unknown;
  market_context?: unknown;
}

export function validateInitiativeCard(
  card: InitiativeCardInput | null | undefined
): FormulaVerdict {
  const violations: FormulaViolation[] = [];
  const c = (card || {}) as InitiativeCardInput;
  const P = 'initiative';

  const title = str(c.title);
  const problem = str(c.problem_statement ?? c.problemStatement);
  const hypothesis = str(c.hypothesis);
  const description = str(c.description);

  // §A3 Tytuł — required, ≤14 words, action-title (verb-first, not generic "Improve X").
  if (!title.trim()) {
    violations.push({ code: `${P}.title_present`, severity: 'hard', message: 'Brak tytułu inicjatywy.' });
  } else {
    if (words(title).length > 14) {
      violations.push({
        code: `${P}.title_len`,
        severity: 'soft',
        message: `Tytuł ma ${words(title).length} słów (max 14).`,
      });
    }
    if (GENERIC_TITLE_RE.test(title.trim()) && !hasQuantification(title)) {
      violations.push({
        code: `${P}.title_generic`,
        severity: 'soft',
        message: 'Tytuł jest generyczny („Improve/Poprawić…") bez konkretu — użyj action-title oddającego zmianę.',
      });
    }
  }

  // §B3 problem_len — 120–250 words.
  if (!problem.trim()) {
    violations.push({
      code: `${P}.problem_present`,
      severity: 'soft',
      message: 'Brak opisu problemu (problem_statement).',
    });
  } else {
    const pw = words(problem).length;
    if (pw < 120 || pw > 250) {
      violations.push({
        code: `${P}.problem_len`,
        severity: 'soft',
        message: `Opis problemu ma ${pw} słów (oczekiwane 120–250).`,
      });
    }
  }

  // §B3 hypothesis_format — "Jeśli X to Y (bo|ponieważ) Z".
  if (!hypothesis.trim()) {
    violations.push({
      code: `${P}.hypothesis_present`,
      severity: 'soft',
      message: 'Brak tezy (hypothesis).',
    });
  } else if (!HYPOTHESIS_RE.test(hypothesis)) {
    violations.push({
      code: `${P}.hypothesis_format`,
      severity: 'hard',
      message: 'Teza nie-falsyfikowalna — wymagany format „Jeśli … to … bo/ponieważ …" z mierzalnym Y (§A6.2).',
    });
  }

  // §B3 description_len — 400–750 words (only when present).
  if (description.trim()) {
    const dw = words(description).length;
    if (dw < 400 || dw > 750) {
      violations.push({
        code: `${P}.description_len`,
        severity: 'soft',
        message: `Opis/business case ma ${dw} słów (oczekiwane 400–750).`,
      });
    }
  }

  // §B3 structural rules — reuse the existing deterministic validators.
  const structural: CardValidationResult[] = validateCardStructure(c);
  for (const r of structural) {
    // owner_assigned is not a generation-time concern (assigned later in PMO);
    // keep it advisory-soft so it never dominates the score on fresh cards.
    if (!r.pass) {
      violations.push({
        code: `${P}.${r.id}`,
        severity: r.id === 'owner_assigned' ? 'soft' : initiativeRuleSeverity(r.id),
        message: r.reason,
      });
    }
  }

  // §A6.1 lang_pl — Polish prose across the key long fields.
  const proseFields: { name: string; text: string }[] = [
    { name: 'title', text: title },
    { name: 'problem_statement', text: problem },
    { name: 'hypothesis', text: hypothesis },
    { name: 'summary', text: str(c.summary) },
    { name: 'description', text: description },
    { name: 'business_value', text: str(c.business_value) },
  ];
  for (const f of proseFields) {
    if (!f.text.trim()) continue;
    const enHits = looksEnglish(f.text);
    if (enHits.length >= 2) {
      violations.push({
        code: `${P}.lang_pl`,
        severity: 'soft',
        message: `Pole „${f.name}" wygląda na angielskie (np. ${enHits.slice(0, 3).join(', ')}).`,
      });
      break;
    }
  }

  // §A6 no_filler — placeholders anywhere in prose.
  for (const f of proseFields) {
    const label = fillerHit(f.text);
    if (label) {
      violations.push({
        code: `${P}.no_filler`,
        severity: 'hard',
        message: `Wypełniacz/placeholder w polu „${f.name}": ${label}.`,
      });
      break;
    }
  }

  return buildVerdict('initiative', violations);
}

// ────────────────────────────────────────────────────────────────────────────
// Convenience — pick the right validator by kind.
// ────────────────────────────────────────────────────────────────────────────

export function validateCard(
  kind: CardKind,
  card: InsightCardData | InitiativeCardInput | null | undefined
): FormulaVerdict {
  return kind === 'insight'
    ? validateInsightCard(card as InsightCardData)
    : validateInitiativeCard(card as InitiativeCardInput);
}

/**
 * Build the "braki" block for a repair prompt from a verdict — one line per
 * violation with its code, so the LLM knows exactly what to fix. Returns '' when
 * clean.
 */
export function buildRepairBriefFromVerdict(verdict: FormulaVerdict): string {
  if (verdict.violations.length === 0) return '';
  const lines = verdict.violations.map((v) => `- [${v.code}] ${v.message}`);
  return (
    `Poprzednia wersja karty nie spełnia CARD_CONTENT_FORMULA (wynik ${verdict.score}/100). ` +
    `Popraw WYŁĄCZNIE poniższe braki, zachowując poprawne pola i zwracając ten sam kontrakt JSON:\n` +
    lines.join('\n')
  );
}
