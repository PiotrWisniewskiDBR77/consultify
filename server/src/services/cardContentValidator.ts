/**
 * cardContentValidator — lightweight, per-section AI output quality flagger.
 *
 * SSOT: `Harvard/wdrozenie-100/_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md` §0
 * (BCG doctrine anti-patterns) and `docs/standards/CARD_CONTENT_FORMULA.md` §A6.
 *
 * PURPOSE: a single, small entry point that a section-generation service
 * (initiativeGenerationService / decisionService / taskSectionGenerationService)
 * can call right after an LLM call returns, to FLAG weak content — never to
 * block persistence. This complements, but does NOT replace, the heavier
 * full-card scorer in `cardContentFormulaValidator.ts` (which grades a whole
 * Insight/Initiative object against the full §A2/§A3 rubric). This module is
 * deliberately generic: it works on ANY section's `content` (string prose,
 * JSON string, or already-parsed object/array) keyed by a `sectionKey`, so it
 * can sit in front of Initiative, Decision, Task and future card types alike.
 *
 * DESIGN CONTRACT:
 *   - Pure, deterministic, no I/O, no LLM call — cheap heuristics only.
 *   - Tolerant of missing/malformed input — never throws, never crashes the
 *     caller. Absent data reads as "empty", not as an error.
 *   - ADVISORY ONLY. `pass: false` means "flag for review", not "reject".
 *     Callers attach the result (e.g. as `qualityFlags`) and move on.
 *
 * @example
 *   const verdict = validateCardContent('execution', { checklist: ['done'] });
 *   if (!verdict.pass) logger.warn('[quality]', verdict.violations);
 */

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export type ViolationSeverity = 'error' | 'warn';

export interface ContentViolation {
  /** Stable rule id, e.g. `list_min_items`, `bare_number`, `filler`. */
  rule: string;
  /** Human-readable PL message (safe to show in logs / repair prompts). */
  message: string;
  severity: ViolationSeverity;
}

export interface CardContentValidationResult {
  /** True when there are zero `error`-severity violations. `warn`s do not fail. */
  pass: boolean;
  violations: ContentViolation[];
}

/**
 * Per-sectionKey requirements. Keyed by the camelCase section keys already in
 * use across the generation services (see `SECTION_REQUIREMENTS` below for the
 * full map). Any key not present in the map is validated with generic rules
 * only (min-length + filler + title-echo) — never rejected outright.
 */
export interface SectionRequirement {
  /**
   * Field names inside `content` that must be arrays with >= this many items.
   * Applies §0 anti-pattern: "listy 1-elementowe tam gdzie wymagane ≥3".
   */
  listFields?: Record<string, number>;
  /** Minimum word count for prose sections (content is a plain string). */
  minWords?: number;
  /**
   * Field names inside `content` that must read as a MEASURABLE END-STATE
   * (sędzia BCG #2): a number + unit + direction-of-change, not a bare list
   * of activities ("identyfikacja X", "szacowanie Y"). Checked with
   * `validateMeasurableOutcome` below. Currently only Task.strategy.expectedOutcome.
   */
  measurableOutcomeFields?: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// §0 doctrine data: known section requirements (camelCase — matches
// initiativeGenerationService SECTION_FORMULA_GUIDANCE / taskSectionGenerationService
// TaskSectionKey / decisionService DecisionSectionKey).
// ────────────────────────────────────────────────────────────────────────────

export const SECTION_REQUIREMENTS: Record<string, SectionRequirement> = {
  // Initiative (server/src/services/initiativeGenerationService.ts)
  targetState: { listFields: { successCriteria: 4, deliverables: 4 } },
  scope: { listFields: { inScope: 3, outOfScope: 3, killCriteria: 2 } },
  raid: { listFields: { risks: 2, assumptions: 1, dependencies: 1 } },
  overview: { minWords: 40 },
  problemDefinition: { minWords: 20 },
  financialAnalysis: { minWords: 15 },
  financialImpact: { minWords: 15 },

  // Decision (server/src/services/decisionService.ts)
  alternatives: { listFields: { alternatives: 2 } },
  risk: { listFields: { risks: 2 } },
  description: { minWords: 15 },
  consequencesOfInaction: { minWords: 20 },

  // Task (server/src/services/taskSectionGenerationService.ts)
  execution: { listFields: { checklist: 3 } },
  evidence: { listFields: { evidence: 2 } },
  strategy: { minWords: 10, measurableOutcomeFields: ['expectedOutcome'] },
  // dependencies: intentionally NOT in listFields — an empty [] is a valid,
  // honest answer when the task has no real dependencies (§ dependencies
  // prompt explicitly allows "[]" instead of fabricating one).
};

// ────────────────────────────────────────────────────────────────────────────
// §0 anti-pattern primitives
// ────────────────────────────────────────────────────────────────────────────

/** Filler / placeholder phrases — §0.5 "Zero fillera" + generic anti-patterns. */
const FILLER_PATTERNS: { re: RegExp; label: string; severity: ViolationSeverity }[] = [
  { re: /\bw dzisiejszym dynamicznym (świecie|otoczeniu|rynku)\b/i, label: '„w dzisiejszym dynamicznym świecie"', severity: 'error' },
  { re: /\blorem ipsum\b/i, label: 'Lorem ipsum', severity: 'error' },
  { re: /\bplaceholder\b/i, label: 'placeholder', severity: 'error' },
  { re: /\[[^\]]{0,40}\]/, label: 'nawias-placeholder', severity: 'error' },
  { re: /\b(insert|add) (your )?(text|content) here\b/i, label: '„insert text here"', severity: 'error' },
  { re: /\bwpisz tutaj\b|\bwstaw tekst\b/i, label: '„wpisz tutaj"', severity: 'error' },
  { re: /\bxxx+\b/i, label: 'xxx', severity: 'error' },
  // "TBD" is only a hard FAIL when there's no accompanying plan to resolve it.
  { re: /\bTBD\b(?!.{0,80}(plan|do ustalenia|zbadamy|ustalimy|proces))/i, label: '„TBD" bez planu uzupełnienia', severity: 'error' },
];

/** Words that legitimise a bare number as an explicit assumption/estimate (§0.3). */
const ASSUMPTION_MARKER_RE =
  /(szacun|estymac|estimate|założen|assumption|orientacyjn|w przybliżeniu|~|±|do ustalenia|zakres|rząd wielkości|w skali)/i;

/** A number that looks like currency/percentage/count worth flagging if bare. */
const BARE_NUMBER_RE = /(?<![\d.,%~±])\b\d[\d\s.,]*\s?(zł|pln|eur|usd|%|mln|tys\.?|k\b)/i;

/**
 * §0 anti-pattern (sędzia BCG #2): "mierzalny outcome" written as an ACTIVITY
 * ("identyfikacja 3 maszyn", "szacowanie ROI") rather than an END-STATE
 * ("ranking 3 maszyn gotowy", "ROI oszacowany na X%"). These are gerund/verbal
 * nouns or bare infinitives that describe doing the work, not the result of
 * having done it — a strong signal the field is really a checklist item that
 * leaked into the outcome field.
 */
const ACTIVITY_VERB_RE =
  /^(identyfikacj|szacowani|analiz|przegląd|zebrani[ae]|gromadzeni|zbieran|opracowani|przygotowani|wykonani|realizacj|wdrażani|badani|ocenian|sprawdzani|weryfikacj|ustaleni|określeni|zaplanowani|planowani)/i;

/** Any digit — used to require the outcome states a quantity, not just prose. */
const ANY_NUMBER_RE = /\d/;

/**
 * §0.3/#3 (sędzia BCG): a number inside a measurable-outcome field with NO
 * accompanying assumption/estimate marker is a HARD FAIL here (stricter than
 * the generic bare-number `warn` below) — this is the field the doctrine
 * explicitly requires to be quantified, so an un-sourced number reads as a
 * fabricated fact, not a stylistic nit. Mirrors chatPolicyGateway's
 * `uncertaintyMarkerRequiredIfInsufficientEvidence` policy, enforced here on
 * the actual generated content rather than only at the chat-turn level.
 */
function validateMeasurableOutcome(fieldName: string, sectionKey: string, raw: unknown): ContentViolation[] {
  const violations: ContentViolation[] = [];
  const text = typeof raw === 'string' ? raw.trim() : '';

  if (!text) {
    // Field entirely absent/empty is a structural gap, not this check's concern.
    return violations;
  }

  const firstWord = text.split(/\s+/)[0] || '';
  if (ACTIVITY_VERB_RE.test(firstWord)) {
    violations.push({
      rule: 'outcome_is_activity',
      message:
        `Pole "${fieldName}" w sekcji "${sectionKey}" opisuje CZYNNOŚĆ ("${firstWord}…") zamiast STANU KOŃCOWEGO ` +
        `— outcome musi być rezultatem z liczbą, jednostką i kierunkiem zmiany (§0 anty-wzorzec, sędzia BCG #2).`,
      severity: 'error',
    });
  }

  if (!ANY_NUMBER_RE.test(text)) {
    violations.push({
      rule: 'outcome_not_quantified',
      message: `Pole "${fieldName}" w sekcji "${sectionKey}" nie zawiera liczby — mierzalny outcome wymaga liczby+jednostki.`,
      severity: 'error',
    });
  } else if (BARE_NUMBER_RE.test(text) && !ASSUMPTION_MARKER_RE.test(text)) {
    // Also catch plain counts (no currency/% suffix) that lack a marker, e.g.
    // "ranking 3 maszyn" alone is fine (count-of-deliverable), but a
    // benchmark-shaped number ("redukcja 30-50%") without a marker is not.
    violations.push({
      rule: 'outcome_unmarked_estimate',
      message:
        `Pole "${fieldName}" w sekcji "${sectionKey}" zawiera liczbę bez marker'a niepewności ` +
        `("szacunek:", "benchmark, do walidacji:", "założenie:") — wymagane gdy liczba nie ma twardego źródła w kontekście.`,
      severity: 'error',
    });
  }

  return violations;
}

function toWords(text: string): string[] {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeForCompare(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźż0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collects every string leaf inside `content` (object/array/string) so prose
 * checks (filler, bare numbers, title-echo) apply regardless of whether the
 * section returns plain prose or a structured JSON payload.
 */
function collectStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 6) return out; // guard against pathological/cyclic input
  if (typeof value === 'string') {
    if (value.trim()) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out, depth + 1);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, out, depth + 1);
    }
  }
  return out;
}

/** Best-effort parse: content may arrive as a JSON string, an object, or plain prose. */
function coerceContent(content: unknown): { parsed: unknown; asText: string } {
  if (content == null) return { parsed: null, asText: '' };
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return { parsed: JSON.parse(trimmed), asText: content };
      } catch {
        // Not valid JSON — treat as prose.
      }
    }
    return { parsed: null, asText: content };
  }
  return { parsed: content, asText: '' };
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Flags weak AI-generated section content per BCG §0 anti-patterns. Advisory
 * only — callers should attach the result (e.g. `qualityFlags`) to their
 * response and log `error`-severity violations; they must NOT block on it.
 *
 * @param sectionKey  camelCase section identifier (e.g. `targetState`, `raid`,
 *                    `execution`). Unknown keys fall back to generic rules.
 * @param content     raw model output — a JSON string, an already-parsed
 *                    object/array, or plain prose. Never throws on bad input.
 */
export function validateCardContent(
  sectionKey: string,
  content: unknown
): CardContentValidationResult {
  const violations: ContentViolation[] = [];
  const req = SECTION_REQUIREMENTS[sectionKey] || {};
  const { parsed, asText } = coerceContent(content);
  const structured = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;

  // ── Empty / too-short (§0 "brak treści" is the ultimate anti-pattern) ─────
  const allStrings = collectStrings(structured ?? content);
  const totalWords = structured
    ? allStrings.reduce((sum, s) => sum + toWords(s).length, 0)
    : toWords(asText).length;

  const isEffectivelyEmpty =
    (structured == null && !asText.trim()) ||
    (structured != null && allStrings.length === 0);

  if (isEffectivelyEmpty) {
    violations.push({
      rule: 'empty_content',
      message: `Sekcja "${sectionKey}" jest pusta.`,
      severity: 'error',
    });
    return { pass: false, violations };
  }

  const minWords = req.minWords ?? (structured ? 8 : 12);
  if (totalWords < minWords) {
    violations.push({
      rule: 'too_short',
      message: `Sekcja "${sectionKey}" ma ${totalWords} słów — poniżej minimum (${minWords}).`,
      severity: 'error',
    });
  }

  // ── §0.2 MECE / list-length: 1-element lists where >=3 (or configured N) required ──
  if (structured && req.listFields) {
    for (const [field, minCount] of Object.entries(req.listFields)) {
      const value = structured[field];
      if (!Array.isArray(value)) {
        // Field entirely absent is a structural gap, not this validator's
        // concern (JSON-shape correctness) — but an empty/non-array value
        // where a real list was expected is still worth a soft flag.
        if (value !== undefined) {
          violations.push({
            rule: 'list_min_items',
            message: `Pole "${field}" w sekcji "${sectionKey}" nie jest listą (oczekiwano ≥${minCount} elementów).`,
            severity: 'warn',
          });
        }
        continue;
      }
      if (value.length < minCount) {
        violations.push({
          rule: 'list_min_items',
          message: `Pole "${field}" w sekcji "${sectionKey}" ma ${value.length} element(ów) — wymagane ≥${minCount} (§0 MECE, zakaz list 1-elementowych).`,
          severity: 'error',
        });
      }
    }
  }

  // ── sędzia BCG #2/#3: measurable-outcome fields — end-state + number + marker ──
  if (structured && req.measurableOutcomeFields) {
    for (const field of req.measurableOutcomeFields) {
      violations.push(...validateMeasurableOutcome(field, sectionKey, structured[field]));
    }
  }

  // ── §0.3 bare numbers without an explicit assumption/estimate marker ─────
  for (const s of structured ? allStrings : [asText]) {
    const m = s.match(BARE_NUMBER_RE);
    if (m && !ASSUMPTION_MARKER_RE.test(s)) {
      violations.push({
        rule: 'bare_number',
        message: `Liczba „${m[0].trim()}" bez założenia/szacunku (dodaj „szacunek:", „założenie:", „~", zakres itp.).`,
        severity: 'warn',
      });
      break; // one hit is enough signal per section
    }
  }

  // ── §0.5 filler / anti-pattern phrases ───────────────────────────────────
  for (const s of structured ? allStrings : [asText]) {
    for (const { re, label, severity } of FILLER_PATTERNS) {
      if (re.test(s)) {
        violations.push({
          rule: 'filler',
          message: `Wykryto wypełniacz/anty-wzorzec: ${label}.`,
          severity,
        });
      }
    }
  }

  return {
    pass: violations.every((v) => v.severity !== 'error'),
    violations,
  };
}

/**
 * Convenience variant for title-echo detection (§0 "przepisanie tytułu jako
 * treści"). Optional — call it when the section title is available; not part
 * of the core signature because most generation services don't have a
 * separate "title" concept per section (only the parent card does).
 */
export function checkTitleEcho(title: string, content: unknown): ContentViolation | null {
  const normTitle = normalizeForCompare(title);
  if (!normTitle) return null;
  const { parsed, asText } = coerceContent(content);
  const strings = parsed && typeof parsed === 'object' ? collectStrings(parsed) : [asText];
  const combined = normalizeForCompare(strings.join(' '));
  if (!combined) return null;

  const isEcho =
    combined === normTitle ||
    (combined.length > 0 && combined.length <= normTitle.length + 8 && combined.startsWith(normTitle));

  if (isEcho) {
    return {
      rule: 'title_echo',
      message: 'Treść sekcji powtarza tytuł zamiast go rozwijać (§0 anty-wzorzec).',
      severity: 'error',
    };
  }
  return null;
}

export default { validateCardContent, checkTitleEcho, SECTION_REQUIREMENTS };
