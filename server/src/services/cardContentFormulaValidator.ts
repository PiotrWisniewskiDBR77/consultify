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

function rec(item: unknown): Record<string, unknown> {
  return item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
}

// ────────────────────────────────────────────────────────────────────────────
// §3/§5 per-type predicates (13-type formula). Deterministic, tolerant, cheap.
// Each mirrors an anti-pattern from _FORMULA_TRESCI_INSIGHT §3 so the code IS
// the checklist. Kept permissive (SOFT) to avoid false positives on thin cards.
// ────────────────────────────────────────────────────────────────────────────

/** §5.1 title_is_thesis — connectors/relations that make a title a thesis. */
const TITLE_CONNECTOR_RE = /(\bvs\b|\bversus\b|\bkontra\b|\bniż\b|\bbo\b|\bponieważ\b|\bprzez\b)|[⟷↔⇔→⟶]/i;

/** Curated finite verbs common in consulting theses (3rd person present). */
const THESIS_VERBS = new Set([
  'rośnie', 'rosną', 'spada', 'spadają', 'blokuje', 'blokują', 'wydłuża', 'wydłużają',
  'skraca', 'skróci', 'skrócą', 'napędza', 'napędzają', 'utknie', 'utyka', 'omija', 'omijają',
  'rozjeżdża', 'hamuje', 'wygrywa', 'traci', 'tracą', 'kosztuje', 'zabije', 'wykolei',
  'odblokuje', 'przewiduje', 'decyduje', 'obniża', 'podnosi', 'zwiększa', 'zmniejsza',
  'ujawnia', 'wyjaśnia', 'utrudnia', 'ogranicza', 'wymusza', 'skupia', 'koreluje', 'żyje',
  'powtarza', 'napędzana', 'blokada', 'skaluje', 'grzęźnie', 'ugrzęźnie',
]);

/** A single token reads as a verb (infinitive on -ć, or a curated finite verb). */
function tokenIsVerb(w: string): boolean {
  return (w.length >= 4 && /ć$/.test(w)) || THESIS_VERBS.has(w);
}

/**
 * §5.1 — a title is a THESIS (not a bare topic) when it carries a verb or a
 * relation. Heuristic per the doctrine: FAIL only when the title is ≤3 words AND
 * has no verb and no relation ("Planowanie produkcji", "Problemy z danymi").
 * Titles with ≥4 words are assumed to carry enough substance to pass.
 */
function titleIsThesis(title: string): boolean {
  const t = String(title || '').trim();
  if (!t) return true; // absence handled by *.title_present
  if (TITLE_CONNECTOR_RE.test(t)) return true;
  const ws = words(t);
  if (ws.length >= 4) return true;
  return ws.some(tokenIsVerb);
}

/** §5.2 summary_sowhat — a number OR a value-driver keyword present. */
const VALUE_DRIVER_RE =
  /(lead-?time|otif|copq|marż|koszt|sprzedaż|przychod|konwersj|cykl|jakoś|wydajno|churn|nps|sla|ebitda|roi|oszczędno|udział|marża|przestój|downtime)/i;
function summaryHasSoWhat(text: string): boolean {
  return hasQuantification(text) || VALUE_DRIVER_RE.test(text);
}

/** §5.2 issue_severity_justified — high severity must name a cost/consequence. */
const COST_MARKER_RE =
  /(kosztuje|koszt|mln|tys|\bzł\b|€|\$|%|blokuje|blokad|hamuje|ryzyk|utrat|strat|traci|przegran|opóźni|kar[aoy]|niezgodn|downtime|przestój|value-?driver|value driver|sprzedaż|marż|lead-?time|otif|copq|hamulec|wykolei|zabije)/i;
function severityIsHigh(item: unknown): boolean {
  const s = str(rec(item).severity ?? rec(item).impact).toLowerCase();
  return s === 'high' || s === 'wysoki' || s === 'wysoka' || s === 'krytyczny';
}
function costJustified(text: string): boolean {
  return COST_MARKER_RE.test(text);
}

/** §5.2 opp_measurable — each opportunity carries a number/target or opt-out. */
function opportunityMeasurable(item: unknown): boolean {
  const t = `${titleOf(item)} ${descOf(item)}`;
  return hasQuantification(t) || /pominięto/i.test(t);
}

/** §5.2 signal_type_valid — allowed types. */
const SIGNAL_TYPES = new Set(['tension', 'gap', 'contradiction', 'emerging_pattern']);

/** §3.14 snippet_verbatim — a snippet must be a raw voice, not an analyst paraphrase. */
const PARAPHRASE_MARKER_RE =
  /^\s*(respondent|rozmówc[ay]|rozmowc[ay]|badan[ya]|uczestnik|klient|osoba)\s+(opisa|wskaza|podkreśl|zwróci|stwierdzi|zauważ|mówi|twierdzi|sugeruj|przyzna|okre[śs]l)/i;
function snippetLooksParaphrased(snippet: string): boolean {
  return PARAPHRASE_MARKER_RE.test(String(snippet || '').trim());
}

/** §3.10 tension_two_sided — both sides grounded (2+ refs, or explicit A/B poles). */
function tensionTwoSided(item: unknown): boolean {
  const o = rec(item);
  const a = str(o.pole_a ?? o.side_a ?? o.a ?? o.left).trim();
  const b = str(o.pole_b ?? o.side_b ?? o.b ?? o.right).trim();
  if (a && b) return true;
  if (refsOf(item).length >= 2) return true;
  // Two distinct H# references inside the prose count as two-sided evidence.
  const hrefs = new Set((`${titleOf(item)} ${descOf(item)}`.match(/\bH\d+\b/gi) || []).map((x) => x.toUpperCase()));
  return hrefs.size >= 2;
}

/** §3.11 pattern_multisource — reach ≥2 sources/sessions. */
function patternMultiSource(item: unknown): boolean {
  const o = rec(item);
  if (o.crossSessionPattern === true || o.cross_session_pattern === true) return true;
  if (refsOf(item).length >= 2) return true;
  const scope = Number(o.source_count ?? o.session_count ?? o.reach ?? o.sources ?? 0);
  if (scope >= 2) return true;
  return /\b([2-9]|\d\d)\s*(źród|sesj|zakład|respond|rozm|osob|głos|dział)/i.test(descOf(item));
}

/** §3.12 model_heldby — a mental model names WHO holds it + an implication. */
function modelGrounded(item: unknown): boolean {
  const o = rec(item);
  const heldBy = asArray(o.held_by ?? o.heldBy ?? o.holders).length > 0 || str(o.held_by ?? o.heldBy).trim().length > 0;
  const impl =
    str(o.implication ?? o.implications ?? o.so_what ?? o.soWhat).trim().length > 0 ||
    /implikacj|program musi|dopóki|zanim|inaczej/i.test(descOf(item));
  return heldBy && impl;
}

/** §3.13 power_implication — each actor carries a stance + a program implication. */
function powerGrounded(item: unknown): boolean {
  const o = rec(item);
  const stance = str(o.stance ?? o.postawa ?? o.position ?? o.attitude).trim().length > 0;
  const impl =
    str(o.implication ?? o.implikacja ?? o.so_what).trim().length > 0 ||
    /implikacj|sponsor|blokad|ryzyk|weto|sojusznik|zaadres/i.test(descOf(item));
  return stance && impl;
}

/** §3.15 qc_multivoice — ≥2 quotes from DIFFERENT roles on one axis + a so-what. */
function quoteComparisonMultivoice(item: unknown): boolean {
  const o = rec(item);
  const quotes = asArray(o.quotes ?? o.cytaty ?? o.voices ?? o.items ?? o.entries);
  if (quotes.length < 2) return false;
  const roles = new Set(
    quotes
      .map((q) => str(rec(q).role ?? rec(q).rola ?? rec(q).speaker ?? rec(q).actor).toLowerCase().trim())
      .filter(Boolean)
  );
  const soWhat =
    str(o.so_what ?? o.soWhat ?? o.implication ?? o.takeaway).trim().length > 0 || descOf(item).trim().length > 0;
  return roles.size >= 2 && soWhat;
}

/** A quote carries attribution: a role field, an H#, an evidence_ref, or "— Author". */
function quoteHasAttribution(q: unknown): boolean {
  const o = rec(q);
  if (str(o.role ?? o.rola ?? o.speaker ?? o.attribution ?? o.author ?? o.source).trim()) return true;
  if (refsOf(q).length > 0) return true;
  const text = typeof q === 'string' ? q : str(o.quote ?? o.text ?? o.cytat ?? o.excerpt);
  return /\bH\d+\b/i.test(text) || /—\s*\S+/.test(text) || /\(\s*[^)]*\bH\d+\b[^)]*\)/i.test(text);
}

/** §3.6 finding_quote — a key finding must carry ≥1 attributed verbatim quote. */
function findingHasQuote(item: unknown): boolean {
  const o = rec(item);
  const single = str(o.quote ?? o.cytat ?? o.evidence_quote ?? o.verbatim).trim();
  if (single && quoteHasAttribution({ quote: single, role: o.role ?? o.rola, evidence_refs: o.evidence_refs })) {
    return true;
  }
  const quotes = asArray(o.quotes ?? o.cytaty);
  return quotes.length > 0 && quotes.some(quoteHasAttribution);
}

/** §3.7 reco_measurable — a recommendation carries a measurable effect + horizon. */
const HORIZON_RE = /(\bmies\b|miesi[aą]c|tygod|kwarta[łl]|\bQ[1-4]\b|\bdni\b|\bdzień\b|\blat\b|\brok\b|\broku\b|0-1|1-3|3-6|6-12|\bdo\b\s*\d)/i;
function recommendationMeasurable(item: unknown): boolean {
  const o = rec(item);
  const t = `${titleOf(item)} ${descOf(item)} ${str(o.expected_effect ?? o.effect ?? o.efekt)} ${str(o.horizon ?? o.horyzont ?? o.timeframe)}`;
  return hasQuantification(t) && HORIZON_RE.test(t);
}

/** §3.5 readout_sections — the six-step chain of headings. */
const READOUT_SECTION_STEMS = ['obserwacj', 'mechanizm', 'dowod', 'wpływ', 'rekomendacj'];
function readoutHasSections(text: string): boolean {
  const low = String(text || '').toLowerCase();
  return READOUT_SECTION_STEMS.every((s) => low.includes(s));
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
  // ── Advanced §3 collections (13-type formula). Validated ONLY when present.
  // In the live V6 pipeline the InsightViewer DERIVES these from the six core
  // fields (themes→key-findings, issues+opportunities→recommendations,
  // signals→tensions/patterns…), so real cards may omit them — the per-type
  // checks stay tolerant (absent collection → skipped, never a violation).
  consulting_readout?: unknown;
  consultingReadout?: unknown;
  key_findings?: unknown;
  keyFindings?: unknown;
  recommendations?: unknown;
  tensions?: unknown;
  patterns?: unknown;
  mental_models?: unknown;
  mentalModels?: unknown;
  power_dynamics?: unknown;
  powerDynamics?: unknown;
  quote_comparison?: unknown;
  quoteComparison?: unknown;
  quote_bank?: unknown;
  quoteBank?: unknown;
  [k: string]: unknown;
}

/**
 * Options for the Insight validator. `reportPath: true` = this card is on the
 * "do raportu klienta" path (§D20 hybrid gate): the verbatim-quote checks
 * (`finding_quote`, `quote_attribution`) become HARD (blocking). In tools /
 * normal generation they stay SOFT — a visible quality flag, never a block.
 */
export interface ValidateInsightOptions {
  reportPath?: boolean;
}

/**
 * Material-quality sub-fields the renderer (InsightViewer) needs — §A6.2 hard rule.
 * Each entry lists the accepted field aliases for one logical sub-field; the check
 * passes when ANY alias is present. The live generation pipeline
 * (`buildInsightMaterialQuality`) and the renderer (`InsightViewer.tsx`) use
 * `overall_material_score` as the canonical score field — `score` is only a legacy
 * fallback — so requiring a bare `score` would hard-fail EVERY real card even
 * though the material_quality object is complete. Aliases keep the historical
 * `score` shape valid too.
 */
const MATERIAL_QUALITY_REQUIRED: string[][] = [
  ['overall_material_score', 'score'],
  ['limitations'],
  ['missing_voices'],
  ['recommended_followups'],
];

export function validateInsightCard(
  card: InsightCardData | null | undefined,
  options: ValidateInsightOptions = {}
): FormulaVerdict {
  const violations: FormulaViolation[] = [];
  const c = card || {};
  const P = 'insight';
  // §D20 hybrid gate: verbatim-quote checks are HARD only on the client-report
  // path; in tools/normal generation they are SOFT (a quality flag, not a block).
  const quoteSeverity: ViolationSeverity = options.reportPath ? 'hard' : 'soft';

  const title = str(c.title);
  const summary = str(c.executive_summary ?? c.executiveSummary);
  const themes = asArray(c.themes);
  const issues = asArray(c.issues);
  const opportunities = asArray(c.opportunities);
  const signals = asArray(c.signals);
  const evidenceMap = asArray(c.evidence_map ?? c.evidenceMap);
  const missingData = asArray(c.missing_data ?? c.missingData);
  const materialQuality = c.material_quality ?? c.materialQuality;
  const content = str(c.content);

  // Advanced §3 collections — validated only when the card actually carries them.
  const consultingReadout = str(c.consulting_readout ?? c.consultingReadout);
  const keyFindings = asArray(c.key_findings ?? c.keyFindings);
  const recommendations = asArray(c.recommendations);
  const tensions = asArray(c.tensions);
  const patterns = asArray(c.patterns);
  const mentalModels = asArray(c.mental_models ?? c.mentalModels);
  const powerDynamics = asArray(c.power_dynamics ?? c.powerDynamics);
  const quoteComparison = asArray(c.quote_comparison ?? c.quoteComparison);
  const quoteBank = asArray(c.quote_bank ?? c.quoteBank);

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
  } else {
    if (words(title).length > 14) {
      violations.push({
        code: `${P}.title_len`,
        severity: 'soft',
        message: `Tytuł ma ${words(title).length} słów (max 14).`,
      });
    }
    // §5.1 title_is_thesis — the card title must be a thesis, not a bare topic.
    if (!titleIsThesis(title)) {
      violations.push({
        code: `${P}.title_is_thesis`,
        severity: 'soft',
        message: 'Tytuł jest TEMATEM, nie tezą (brak czasownika/relacji) — §3.2.',
      });
    }
  }

  // §5.2 summary_sowhat — the summary must carry a number or a value-driver.
  if (summary.trim() && !summaryHasSoWhat(summary)) {
    violations.push({
      code: `${P}.summary_sowhat`,
      severity: 'soft',
      message: 'Podsumowanie bez „so-what": brak liczby lub value-drivera (§3.1).',
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
    // §5.2 theme_strength_grounded — strength=strong wymaga ≥2 evidence_refs.
    const strength = str(rec(t).strength).toLowerCase();
    if ((strength === 'strong' || strength === 'silny' || strength === 'silna') && refsOf(t).length < 2) {
      violations.push({
        code: `${P}.theme_strength_grounded`,
        severity: 'soft',
        message: `Motyw #${i + 1}: strength="strong" wymaga ≥2 evidence_refs (§3.2).`,
      });
    }
    // §5.1 title_is_thesis per motyw.
    if (titleOf(t).trim() && !titleIsThesis(titleOf(t))) {
      violations.push({
        code: `${P}.title_is_thesis`,
        severity: 'soft',
        message: `Motyw #${i + 1}: tytuł jest tematem, nie tezą (§3.2).`,
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
    // §5.2 issue_severity_justified — severity=high musi nieść koszt/skutek w opisie.
    if (severityIsHigh(it) && !costJustified(`${titleOf(it)} ${descOf(it)}`)) {
      violations.push({
        code: `${P}.issue_severity_justified`,
        severity: 'soft',
        message: `Problem #${i + 1}: severity="high" bez uzasadnienia kosztu/skutku (§3.3).`,
      });
    }
    // §5.1 title_is_thesis per problem.
    if (titleOf(it).trim() && !titleIsThesis(titleOf(it))) {
      violations.push({
        code: `${P}.title_is_thesis`,
        severity: 'soft',
        message: `Problem #${i + 1}: tytuł jest tematem, nie tezą (§3.3).`,
      });
    }
  });

  // §5.2 opportunities — each must carry a measurable target (or explicit opt-out).
  opportunities.forEach((op, i) => {
    if (!opportunityMeasurable(op)) {
      violations.push({
        code: `${P}.opp_measurable`,
        severity: 'soft',
        message: `Szansa #${i + 1} bez mierzalnego celu/liczby (§3.4) — dodaj liczbę lub „— Pominięto:".`,
      });
    }
    if (titleOf(op).trim() && !titleIsThesis(titleOf(op))) {
      violations.push({
        code: `${P}.title_is_thesis`,
        severity: 'soft',
        message: `Szansa #${i + 1}: tytuł jest kategorią, nie tezą (§3.4).`,
      });
    }
  });

  // §5.2 signals — type ∈ {tension,gap,contradiction,emerging_pattern} ∧ opis ≥25 słów.
  signals.forEach((s, i) => {
    const type = str(rec(s).type).toLowerCase().trim();
    if (type && !SIGNAL_TYPES.has(type)) {
      violations.push({
        code: `${P}.signal_type_valid`,
        severity: 'soft',
        message: `Sygnał #${i + 1}: nieznany type="${type}" (§3.9).`,
      });
    }
    if (words(descOf(s)).length < 25) {
      violations.push({
        code: `${P}.signal_desc_len`,
        severity: 'soft',
        message: `Sygnał #${i + 1} ma opis <25 słów (§3.9).`,
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
    // §3.14 snippet_verbatim — a snippet must be the raw voice, not an analyst paraphrase.
    if (snippet.trim() && snippetLooksParaphrased(snippet)) {
      violations.push({
        code: `${P}.snippet_verbatim`,
        severity: 'soft',
        message: `Fragment dowodu #${i + 1} wygląda na parafrazę analityka, nie cytat źródła (§3.14).`,
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
    const missingSub = MATERIAL_QUALITY_REQUIRED.filter((aliases) => {
      // Present when ANY accepted alias (snake or camel) carries a value.
      const present = aliases.some((k) => (mq[k] ?? mq[toCamel(k)]) != null);
      return !present;
    }).map((aliases) => aliases[0]);
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

  // ──────────────────────────────────────────────────────────────────────────
  // Advanced §3 types (§5.2). These fire ONLY when the card carries the
  // collection — real V6 cards derive them client-side, so absence = no-op.
  // ──────────────────────────────────────────────────────────────────────────

  // §3.5 consulting-readout — six-step chain + 350–700 words.
  if (consultingReadout.trim()) {
    if (!readoutHasSections(consultingReadout)) {
      violations.push({
        code: `${P}.readout_sections`,
        severity: 'soft',
        message: 'Readout bez łańcucha nagłówków Obserwacja→Mechanizm→Dowody→Wpływ→Rekomendacja (§3.5).',
      });
    }
    const rw = words(consultingReadout).length;
    if (rw < 350 || rw > 700) {
      violations.push({
        code: `${P}.readout_len`,
        severity: 'soft',
        message: `Readout ma ${rw} słów (oczekiwane 350–700, §3.5).`,
      });
    }
  }

  // §3.6 key-findings — EACH finding needs an attributed verbatim quote.
  keyFindings.forEach((kf, i) => {
    if (!findingHasQuote(kf)) {
      violations.push({
        code: `${P}.finding_quote`,
        severity: quoteSeverity,
        message: `Kluczowy wniosek #${i + 1} nie ma dosłownego cytatu z atrybucją (H#/rola) (§3.6, EACH_ITEM).`,
      });
    }
    if (titleOf(kf).trim() && !titleIsThesis(titleOf(kf))) {
      violations.push({
        code: `${P}.title_is_thesis`,
        severity: 'soft',
        message: `Kluczowy wniosek #${i + 1}: teza generyczna, nie action-title (§3.6).`,
      });
    }
  });

  // §3.7 recommendations — measurable effect + horizon.
  recommendations.forEach((r, i) => {
    if (!recommendationMeasurable(r)) {
      violations.push({
        code: `${P}.reco_measurable`,
        severity: 'soft',
        message: `Rekomendacja #${i + 1} bez mierzalnego efektu + horyzontu (§3.7).`,
      });
    }
  });

  // §3.10 tensions — both sides grounded.
  tensions.forEach((t, i) => {
    if (!tensionTwoSided(t)) {
      violations.push({
        code: `${P}.tension_two_sided`,
        severity: 'soft',
        message: `Napięcie #${i + 1}: brak dowodu po OBU stronach trade-offu (§3.10).`,
      });
    }
  });

  // §3.11 patterns — reach ≥2 sources.
  patterns.forEach((p, i) => {
    if (!patternMultiSource(p)) {
      violations.push({
        code: `${P}.pattern_multisource`,
        severity: 'soft',
        message: `Wzorzec #${i + 1}: brak zasięgu ≥2 źródła/sesje — to anegdota, nie wzorzec (§3.11).`,
      });
    }
  });

  // §3.12 mental-models — held_by + implication.
  mentalModels.forEach((m, i) => {
    if (!modelGrounded(m)) {
      violations.push({
        code: `${P}.model_heldby`,
        severity: 'soft',
        message: `Model myślowy #${i + 1}: brak held_by lub implikacji dla programu (§3.12).`,
      });
    }
  });

  // §3.13 power-dynamics — stance + program implication.
  powerDynamics.forEach((pd, i) => {
    if (!powerGrounded(pd)) {
      violations.push({
        code: `${P}.power_implication`,
        severity: 'soft',
        message: `Dynamika władzy #${i + 1}: brak postawy lub implikacji dla sponsora (§3.13).`,
      });
    }
  });

  // §3.15 quote-comparison — ≥2 voices from different roles + so-what.
  quoteComparison.forEach((qc, i) => {
    if (!quoteComparisonMultivoice(qc)) {
      violations.push({
        code: `${P}.qc_multivoice`,
        severity: 'soft',
        message: `Porównanie cytatów #${i + 1}: potrzebne ≥2 cytaty z RÓŻNYCH ról + so-what (§3.15).`,
      });
    }
  });

  // §3.Z(19) quote-bank — EACH quote needs H#/role attribution.
  quoteBank.forEach((q, i) => {
    if (!quoteHasAttribution(q)) {
      violations.push({
        code: `${P}.quote_attribution`,
        severity: quoteSeverity,
        message: `Cytat #${i + 1} w banku cytatów bez atrybucji H#/rola (§3.Z).`,
      });
    }
  });

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
  card: InsightCardData | InitiativeCardInput | null | undefined,
  options: ValidateInsightOptions = {}
): FormulaVerdict {
  return kind === 'insight'
    ? validateInsightCard(card as InsightCardData, options)
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
