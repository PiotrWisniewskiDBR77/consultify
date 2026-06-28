/**
 * Initiative Section AI Generation Service
 *
 * Generates content for initiative sections using AI prompts
 * defined in initiative_section_types.ai_prompt_template.
 *
 * Pattern follows reportGenerationService.ts
 */

import { getDatabase } from '../database/Database.js';
import DbPromise from '../utils/DbPromise.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';
import initiativeSectionTypeService from './initiativeSectionTypeService.js';
import { buildOrgFinancialsSummary } from './initiative/financialsGrounding.js';
import {
  type CardSpec,
  CARD_BLOCK_TYPES,
  coerceToCardSpec,
  hasCriticalIssues,
  summarizeIssues,
  validateCardSpec,
  type CardIssue,
} from './initiative/cardSpecSchema.js';

// ==========================================
// TYPES
// ==========================================

export interface GenerationContext {
  initiativeId: string;
  initiativeName: string;
  summary?: string;
  problemStatement?: string;
  category?: string;
  module?: string;
  status?: string;
  currentPhase?: string;
  targetState?: string;
  scope?: string;
  benefits?: string;
  kpis?: string;
  timeline?: string;
  phases?: string;
  completedTasks?: number;
  totalTasks?: number;
  openRisks?: number;
  openDecisions?: number;
  /** Lineage string for grounding (source_type[#source_id] or "manual"). */
  sourceLineage?: string;
  /** Existing KPIs summarized for grounding (baseline→target + unit). */
  existingKpis?: string;
  /** F0 — istniejące inicjatywy w org (dedup/MECE awareness): "Tytuł [STATUS]; ...". */
  portfolioSummary?: string;
  /** F0 — kontekst organizacji (branża/cele/standardy) dla ugruntowania. */
  orgContext?: string;
  /** F0 — twarde dane finansowe org dla business-case/financial-impact. */
  financialsSummary?: string;
  language: 'en' | 'pl';
  [key: string]: any;
}

export interface GenerationResult {
  content: string;
  isJson: boolean;
  parsedContent?: any;
  tokensUsed: number;
  model: string;
  /**
   * OPTIONAL advisory quality score from the adversarial reviewer (§B4/§B6).
   * Present only when the generate path runs the cheap second pass. ADVISORY —
   * never used to auto-reject or block; the human still reviews and saves.
   */
  review?: SectionReviewResult;
}

/**
 * R2 — wynik generacji sekcji jako CardSpec (grammar bloków) z bramką-recenzentem.
 * `ok=false` → wołający robi fallback do buildera per-pole (legacy/ręczne).
 */
export interface CardSpecGenerationResult {
  /** Zwalidowany/skoercjonowany spec (null gdy LLM niedostępny lub padł). */
  cardSpec: CardSpec | null;
  /** Wynik `validateCardSpec` na zwróconym specu. */
  issues: CardIssue[];
  /** Brak issues CRITICAL → renderowalny. */
  ok: boolean;
  /** Czy uruchomiono pętlę auto-heal (regen) po odrzuceniu przez bramkę. */
  regenerated: boolean;
  tokensUsed: number;
  model: string;
}

/**
 * Adversarial-reviewer verdict for ONE generated section, scored against
 * CARD_CONTENT_FORMULA §B4/§B6 (0–100, PASS ≥ 90). ADVISORY ONLY: it informs
 * the human reviewer; it NEVER auto-rejects, auto-submits, or mutates anything.
 */
export interface SectionReviewResult {
  /** 0–100 quality score per §B4 scoring. */
  score: number;
  /** PASS only when score ≥ PASS_THRESHOLD and no hard failures. */
  verdict: 'PASS' | 'FAIL';
  /** Machine-validator ids that failed (§B3), e.g. "kpi_baseline_target". */
  failedValidators: string[];
  /** Human-readable quality deficiencies (§A2/§A3 gaps), in the card language. */
  qualityGaps: string[];
  /** Concrete, actionable fixes the human/generator can apply. */
  fixes: string[];
  /** Section key that was reviewed. */
  sectionKey: string;
  /** Model that produced the review, or 'heuristic' for the no-LLM fallback. */
  model: string;
  /**
   * True when the verdict comes from the deterministic local fallback (no LLM,
   * or LLM output unparseable) rather than a real adversarial LLM pass.
   */
  degraded: boolean;
}

/** §B4: PASS threshold. Exported so callers/tests share one source of truth. */
export const REVIEW_PASS_THRESHOLD = 90;

// ==========================================
// LLM SERVICE
// ==========================================

let _llmServiceInstance: any = null;

/** Test-only seam: clears the memoized LLM instance so tests can toggle whether
 *  an LLM is "configured" between cases. No production caller uses this. */
export function __resetLlmInstanceForTests(): void {
  _llmServiceInstance = null;
}

async function getLLMServiceInstance(): Promise<any> {
  if (_llmServiceInstance) return _llmServiceInstance;
  try {
    const mod = await import('./ai/llmService.js');
    _llmServiceInstance = mod.llmService || mod.default;
    return _llmServiceInstance;
  } catch (err) {
    logger.warn('[InitiativeGeneration] LLM Service not available');
    return null;
  }
}

// ==========================================
// TEMPLATE INTERPOLATION
// ==========================================

function interpolateTemplate(template: string, context: GenerationContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key];
    if (value === undefined || value === null) return `[not provided]`;
    // Make language explicit for LLMs (templates often use: "Language: {{language}}")
    if (key === 'language') {
      const lang = String(value).toLowerCase().trim();
      if (lang === 'pl' || lang === 'polish') return 'Polish';
      if (lang === 'en' || lang === 'english') return 'English';
      return String(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

// ==========================================
// CARD_CONTENT_FORMULA DOCTRINE (L-04 / epic #16)
// ==========================================
//
// The DB-seeded prompt templates (migrations 530/540/542) are generic and do NOT
// encode the McKinsey-grade doctrine from docs/standards/CARD_CONTENT_FORMULA.md
// and docs/initiatives/INITIATIVE_FORMULA.md. We inject the doctrine at the service
// layer so it applies regardless of DB seed state and survives template drift.
//
// IMPORTANT: this is ADVISORY. The service returns a *proposal*; the human reviews
// and saves it in InitiativeDocumentView (AI proposes → human accepts). Nothing here
// auto-submits, mutates the initiative, or triggers a gate transition.

const DOCTRINE_SYSTEM_PROMPT = `Jesteś partnerem konsultingowym poziomu McKinsey, budującym dokumentację inicjatywy transformacyjnej.
Tworzysz treść JEDNEJ sekcji karty inicjatywy wg kanonu jakości (SSOT: docs/standards/CARD_CONTENT_FORMULA.md + docs/initiatives/INITIATIVE_FORMULA.md).

REGUŁY BEZWZGLĘDNE (każda dotyczy KAŻDEJ rubryki):
1. JĘZYK: cała proza widoczna dla użytkownika po POLSKU. Wyjątek: akronimy/metodyki (SIPOC, RACI, RAID, KPI, SLA, MECE, PMO, WBS, CAPEX, OPEX, ROI) oraz nazwy własne/produkty.
2. ANSWER-FIRST (piramida Minto): pierwsze zdanie niesie konkluzję, nie wstęp.
3. UGRUNTOWANIE: każda teza ma dowód (insight/dokument/sesja/dane z kontekstu); brak dowodu → jawnie oznacz jako hipotezę z limitem pewności. NIE ZMYŚLAJ danych ani liczb.
4. KONKRET NAD OGÓLNIKIEM: liczby, role, procesy, nazwy zamiast frazesów. Zakaz wypełniaczy (placeholder udający treść).
5. KWANTYFIKACJA Z JAWNYMI ZAŁOŻENIAMI: każdy sizing = wielkość (zł/%/dni/szt.) + założenie + horyzont. Brak danych → "do ustalenia" + gdzie/kiedy się je ustali.
6. UCZCIWA NIEPEWNOŚĆ: spory/braki nazwane, nie wygładzone.
7. MECE: bez nakładania i luk.

DOKTRYNA INICJATYWY (gdy dotyczy sekcji):
- TEZA falsyfikowalna w formacie "Jeśli X, to Y (mierzalne) bo Z".
- KPI: zawsze baseline→target + kierunek + jednostka; brak baseline → "do ustalenia" + powód. Min. 1 KPI primary.
- RAID: min. 2×RISK + 1×ASSUMPTION + 1×DEPENDENCY; każdy z probability+impact+mitigation_plan.
- scope_out: MECE — przynajmniej jedna pozycja odwołuje się do innej inicjatywy ("→ N…").
- kill_criteria: konkretny warunek STOP, min. 2.
- Sizing/ROI: rząd wielkości + jawne założenie + ROI (krotność lub %); enabler → wartość pośrednia + proxy.

Gdy proszą o JSON — zwróć WYŁĄCZNIE poprawny JSON (bez markdown, bez komentarza).
Gdy proszą o prozę — answer-first, po polsku (chyba że kontekst jawnie żąda angielskiego).`;

const DOCTRINE_SYSTEM_PROMPT_EN = `You are a McKinsey-grade consulting partner building transformation-initiative documentation.
You write content for ONE section of an initiative card per the quality canon (SSOT: docs/standards/CARD_CONTENT_FORMULA.md + docs/initiatives/INITIATIVE_FORMULA.md).

ABSOLUTE RULES (apply to EVERY field):
1. ANSWER-FIRST (Minto pyramid): the first sentence carries the conclusion, not a preamble.
2. GROUNDING: every claim cites evidence from context (insight/document/session/data); no evidence → explicitly mark as a hypothesis with a confidence limit. NEVER fabricate data or numbers.
3. CONCRETE OVER GENERIC: numbers, roles, processes, names — not platitudes. No filler placeholders posing as content.
4. QUANTIFICATION WITH EXPLICIT ASSUMPTIONS: every sizing = magnitude (currency/%/days/units) + assumption + horizon. Missing data → "to be determined" + where/when.
5. HONEST UNCERTAINTY: disputes/gaps are named, not smoothed.
6. MECE: no overlaps, no gaps.

INITIATIVE DOCTRINE (where the section applies):
- Falsifiable HYPOTHESIS in the form "If X, then Y (measurable) because Z".
- KPI: always baseline→target + direction + unit; missing baseline → "to be determined" + reason. At least 1 primary KPI.
- RAID: min 2×RISK + 1×ASSUMPTION + 1×DEPENDENCY; each with probability+impact+mitigation_plan.
- scope_out: MECE — at least one item references another initiative.
- kill_criteria: a concrete STOP condition, min 2.
- Sizing/ROI: order of magnitude + explicit assumption + ROI (multiple or %); enabler → indirect value + proxy.

When JSON is requested — return ONLY valid JSON (no markdown, no commentary).
When prose is requested — answer-first.`;

// ==========================================
// ADVERSARIAL REVIEWER (CARD_CONTENT_FORMULA §B4/§B6)
// ==========================================
//
// Second-pass quality check. Scores generated section content against the
// formula (0–100, PASS ≥ 90) so low-quality output is flagged BEFORE the human
// reviews it. ADVISORY ONLY — it informs, never auto-rejects/auto-submits.
// The reviewer is adversarial by design: it defaults to looking for reasons to
// FAIL (ungrounded claim, vague KPI, filler, EN prose in a PL card).

const REVIEWER_SYSTEM_PROMPT_PL = `Jesteś ADVERSARIALNYM recenzentem jakości treści wg kanonu docs/standards/CARD_CONTENT_FORMULA.md (§A2/§A3/§A6) i docs/initiatives/INITIATIVE_FORMULA.md.
Oceniasz JEDNĄ sekcję karty inicjatywy. Domyślnie szukasz powodów do FAIL, nie do PASS.

NAJPIERW uruchom walidatory §B3 właściwe dla tej sekcji (każdy PASS/FAIL):
- hypothesis_format: teza pasuje do "Jeśli X to Y (bo|ponieważ) Z" z mierzalnym Y;
- kpi_baseline_target: ≥2 KPI, ≥1 primary, każdy baseline→target + kierunek + jednostka (brak baseline → "do ustalenia" + powód);
- raid_mix: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY, każde z probability+impact+mitigation;
- scope_out_mece: ≥1 pozycja scope_out odwołuje się do INNEJ inicjatywy;
- kill_count: ≥2 konkretne warunki STOP;
- sizing_present: liczba + jawne założenie + ROI;
- deliverables_count/success_count: ≥4 każdy; scope_in/scope_out: ≥3 każdy;
- lang_pl: 0 angielskich słów w prozie poza słownikiem §A5;
- no_filler: brak placeholderów/ogólników udających treść;
- grounded: tezy mają dowód lub są jawnie oznaczone jako hipoteza z limitem pewności.
Stosuj TYLKO walidatory adekwatne do dostarczonej sekcji — nie karz za pola, których ta sekcja nie zawiera.

POTEM oceń jakościowo (§A2/§A3) i policz wynik §B4 w skali 0–100. PASS tylko gdy wynik ≥ 90 i ZERO twardych FAIL z §A6.

Zwróć WYŁĄCZNIE poprawny JSON (bez markdown), wg kontraktu:
{"score": <0-100>, "verdict": "PASS"|"FAIL", "failedValidators": [<id walidatora>], "qualityGaps": [<konkretny brak po polsku>], "fixes": [<konkretna poprawka po polsku>]}`;

const REVIEWER_SYSTEM_PROMPT_EN = `You are an ADVERSARIAL content-quality reviewer per docs/standards/CARD_CONTENT_FORMULA.md (§A2/§A3/§A6) and docs/initiatives/INITIATIVE_FORMULA.md.
You assess ONE section of an initiative card. By default you look for reasons to FAIL, not to PASS.

FIRST run the §B3 validators relevant to this section (each PASS/FAIL):
- hypothesis_format: "If X then Y (because) Z" with a measurable Y;
- kpi_baseline_target: ≥2 KPI, ≥1 primary, each baseline→target + direction + unit (missing baseline → "to be determined" + reason);
- raid_mix: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY, each with probability+impact+mitigation;
- scope_out_mece: ≥1 scope_out item references ANOTHER initiative;
- kill_count: ≥2 concrete STOP conditions;
- sizing_present: number + explicit assumption + ROI;
- deliverables_count/success_count: ≥4 each; scope_in/scope_out: ≥3 each;
- no_filler: no placeholders/platitudes posing as content;
- grounded: claims cite evidence or are explicitly flagged as a hypothesis with a confidence limit.
Apply ONLY validators that fit the supplied section — do not penalize fields the section does not contain.

THEN assess quality (§A2/§A3) and compute the §B4 score 0–100. PASS only when score ≥ 90 and ZERO hard §A6 failures.

Return ONLY valid JSON (no markdown), per the contract:
{"score": <0-100>, "verdict": "PASS"|"FAIL", "failedValidators": [<validator id>], "qualityGaps": [<concrete gap>], "fixes": [<concrete fix>]}`;

/**
 * Deterministic, LLM-free fallback scorer. Used when no LLM is configured or the
 * reviewer's JSON is unparseable. Conservative + structural only (length, filler
 * markers, obvious EN-prose, placeholder/"do ustalenia" honesty) so unit tests can
 * assert behaviour without a model. NEVER claims PASS on thin content.
 */
function heuristicReview(sectionKey: string, content: string): SectionReviewResult {
  const text = String(content || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const failedValidators: string[] = [];
  const qualityGaps: string[] = [];
  const fixes: string[] = [];

  // Empty / near-empty content is an automatic hard FAIL.
  if (words < 20) {
    failedValidators.push('content_len');
    qualityGaps.push('Treść jest pusta lub zbyt krótka, by spełnić minimum formuły.');
    fixes.push('Wygeneruj kompletną treść sekcji zgodnie z wymogami §A3.');
    return {
      score: 0,
      verdict: 'FAIL',
      failedValidators,
      qualityGaps,
      fixes,
      sectionKey,
      model: 'heuristic',
      degraded: true,
    };
  }

  let score = 70; // structural baseline — never a confident PASS without an LLM pass.

  // Filler / placeholder markers posing as content (§A6.9, §A1 no-filler).
  const fillerRe = /(lorem ipsum|tbd\b|placeholder|wpisz tutaj|wstaw tekst|todo:|xxx+|\.\.\.\s*$)/i;
  if (fillerRe.test(text)) {
    failedValidators.push('no_filler');
    qualityGaps.push('Wykryto wypełniacz/placeholder udający treść.');
    fixes.push('Zastąp placeholdery konkretną, ugruntowaną treścią.');
    score -= 30;
  }

  // Section-specific structural checks (cheap, deterministic).
  if (sectionKey === 'kpis' || sectionKey === 'kpi') {
    if (!/baseline|do ustalenia|to be determined/i.test(text)) {
      failedValidators.push('kpi_baseline_target');
      qualityGaps.push('Brak baseline→target lub adnotacji „do ustalenia" w KPI.');
      fixes.push('Dodaj baseline→target + kierunek + jednostkę dla każdego KPI.');
      score -= 20;
    }
  }
  if (sectionKey === 'financial-analysis' || sectionKey === 'financial-impact') {
    if (!/(\d|zł|%|mln|tys|roi)/i.test(text)) {
      failedValidators.push('sizing_present');
      qualityGaps.push('Brak liczb/sizingu/ROI w analizie finansowej.');
      fixes.push('Podaj rząd wielkości + założenie + ROI (krotność lub %).');
      score -= 20;
    }
  }

  score = Math.max(0, Math.min(100, score));
  // Heuristic never asserts a confident PASS — cap below threshold so the human
  // (or a real LLM pass) makes the call. Degraded flag makes this explicit.
  const verdict: 'PASS' | 'FAIL' = 'FAIL';
  if (!qualityGaps.length) {
    qualityGaps.push(
      'Brak recenzji LLM — wynik heurystyczny (strukturalny). Zweryfikuj jakość ręcznie.'
    );
  }

  return {
    score: Math.min(score, REVIEW_PASS_THRESHOLD - 1),
    verdict,
    failedValidators,
    qualityGaps,
    fixes,
    sectionKey,
    model: 'heuristic',
    degraded: true,
  };
}

/**
 * Per-section quantitative guidance distilled from CARD_CONTENT_FORMULA §A3.
 * Appended to the user prompt so the doctrine takes effect even when the DB
 * template is generic. Keyed by both camelCase (seeded) and snake_case aliases.
 */
const SECTION_FORMULA_GUIDANCE: Record<string, string> = {
  overview: `WYMÓG FORMUŁY (executive summary): 3–5 zdań / 60–130 słów. Answer-first: pierwsze zdanie = konkluzja (czym jest inicjatywa + jaki efekt). Dodaj "so-what" i poziom pewności. Konkret, bez frazesów.`,
  problemDefinition: `WYMÓG FORMUŁY (problem): przyczyny ŹRÓDŁOWE (nie objawy), ugruntowane w dowodach z kontekstu. symptom = obserwowalne objawy; rootCause = analiza przyczyny źródłowej; costOfInaction = skwantyfikowany koszt zaniechania (kwota/%/dni + założenie). Bez zmyślania liczb — brak danych → "do ustalenia".`,
  targetState: `WYMÓG FORMUŁY: deliverables ≥4, konkretne i rzeczownikowe; successCriteria ≥4, MIERZALNE/obserwowalne i spójne z KPI. targetDescription answer-first.`,
  scope: `WYMÓG FORMUŁY: inScope ≥3 jednoznaczne; outOfScope ≥3 MECE — przynajmniej jedna pozycja odwołuje się do INNEJ inicjatywy; killCriteria ≥2 konkretne warunki STOP (np. "jeśli po 3 mies. baseline nie drgnie → zatrzymaj").`,
  kpis: `WYMÓG FORMUŁY: ≥2 KPI, ≥1 primary. KAŻDY KPI: baseline→target + kierunek (wzrost/spadek) + jednostka. Brak baseline → baseline:"do ustalenia" + powód w opisie. Cele MUSZĄ mieć jednostkę. Bez zmyślania baseline.`,
  raid: `WYMÓG FORMUŁY: min 2×RISK + 1×ASSUMPTION + 1×DEPENDENCY. Każde RISK ma probability ORAZ impact ORAZ mitigation (+contingency). Każdy element ma proposedAction z konkretem. Bez generycznych placeholderów — wszystko ugruntowane w kontekście inicjatywy.`,
  financialAnalysis: `WYMÓG FORMUŁY (sizing): podaj rząd wielkości + JAWNE ZAŁOŻENIE + horyzont oraz ROI (krotność lub %) z logiką. Enabler → wartość pośrednia + proxy. Oznacz jako szacunki AI do walidacji. Bez "przyniesie miliony" bez założeń.`,
  financialImpact: `WYMÓG FORMUŁY: revenueImpact/costSavings z rzędem wielkości + założeniem; benefitsRealization z horyzontem (kiedy i jak korzyści się zmaterializują).`,
  pilot: `WYMÓG FORMUŁY: hypotheses jako falsyfikowalne ("Jeśli X to Y bo Z"); successCriteria i failureCriteria MIERZALNE; suggestedScope konkretny.`,
  tasks: `WYMÓG FORMUŁY: zadania fazowane i konkretne; powiązane z deliverables i kamieniami milowymi inicjatywy.`,
  decisions: `WYMÓG FORMUŁY: decyzje krytyczne dla bramki/postępu, z jasnym uzasadnieniem "dlaczego ważne" i pilnością.`,
  resources: `WYMÓG FORMUŁY: role z FTE i czasem; budżet jako rząd wielkości z założeniem; narzędzia konkretne.`,
  gates: `WYMÓG FORMUŁY: readinessScore uczciwy; gaps i strengths konkretne i ugruntowane w danych (taski/ryzyka/decyzje z kontekstu), nie ogólne.`,
};

function getFormulaGuidance(sectionKey: string): string | null {
  const aliases: Record<string, string> = {
    problem_definition: 'problemDefinition',
    target_state: 'targetState',
    financial_analysis: 'financialAnalysis',
    financial_impact: 'financialImpact',
    overview_summary: 'overview',
    summary: 'overview',
  };
  const key = aliases[sectionKey] || sectionKey;
  return SECTION_FORMULA_GUIDANCE[key] || null;
}

/**
 * Build a human-readable evidence/grounding block from the enriched context so the
 * model cites real data instead of inventing it (CARD_CONTENT_FORMULA §A8).
 * Returns null when there is nothing concrete to ground in.
 */
export function buildGroundingBlock(context: GenerationContext): string | null {
  const lines: string[] = [];
  if (context.orgContext) lines.push(`Kontekst organizacji: ${String(context.orgContext).slice(0, 800)}`);
  if (context.summary) lines.push(`Streszczenie inicjatywy: ${String(context.summary).slice(0, 800)}`);
  if (context.problemStatement)
    lines.push(`Problem: ${String(context.problemStatement).slice(0, 800)}`);
  if (context.sourceLineage) lines.push(`Pochodzenie (lineage): ${context.sourceLineage}`);
  if (context.existingKpis) lines.push(`Istniejące KPI: ${context.existingKpis}`);
  if (context.financialsSummary) lines.push(`Dane finansowe org: ${String(context.financialsSummary).slice(0, 800)}`);
  if (context.portfolioSummary)
    lines.push(`Istniejące inicjatywy w organizacji (NIE duplikuj; dopasuj do luk): ${String(context.portfolioSummary).slice(0, 1000)}`);
  if (context.category) lines.push(`Kategoria: ${context.category}`);
  if (context.module) lines.push(`Obszar/moduł: ${context.module}`);
  return lines.length ? lines.join('\n') : null;
}

// ==========================================
// SERVICE
// ==========================================

export class InitiativeGenerationService {
  private db;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Generate content for a specific initiative section using AI
   */
  async generateSectionContent(
    sectionKey: string,
    context: GenerationContext,
    organizationId?: string,
    options?: { withReview?: boolean }
  ): Promise<GenerationResult> {
    // 0. Return placeholder when LLM is not configured.
    const llmEarly = await getLLMServiceInstance();
    if (!llmEarly) {
      const lang = String(context.language || 'en').toLowerCase();
      const isPolish = lang === 'pl' || lang === 'polish';
      const name = context.initiativeName || '';
      const content = isPolish
        ? `[${name}] — Uzupełnij tę sekcję po zakończeniu analizy. Spróbuj ponownie gdy provider AI będzie dostępny.`
        : `[${name}] — Please fill in this section. AI generation requires a configured LLM provider.`;
      return { content, isJson: false, parsedContent: undefined, tokensUsed: 0, model: 'placeholder' };
    }

    // 1. Get section type definition (with prompt template)
    let sectionType: any = null;
    try {
      sectionType = await initiativeSectionTypeService.getSectionTypeByKey(
        sectionKey,
        organizationId || undefined
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      // If schema/migrations are missing, do not 500 — be explicit and honest.
      if (
        msg.includes('no such table') ||
        msg.includes('SQLITE_ERROR') ||
        msg.includes('does not exist') ||
        msg.includes('relation')
      ) {
        throw new AppError(
          'Initiative section types are not available (schema missing)',
          503,
          'FEATURE_UNAVAILABLE',
          { message: msg }
        );
      }
      throw err;
    }

    if (!sectionType) {
      throw new Error(`Section type "${sectionKey}" not found`);
    }

    const promptTemplate = sectionType.aiPromptTemplate;
    if (!promptTemplate) {
      throw new AppError(
        `AI prompt template is not configured for section "${sectionKey}"`,
        503,
        'FEATURE_UNAVAILABLE'
      );
    }

    // 2. Enrich context with initiative data from DB (incl. lineage + KPIs for grounding)
    const enrichedContext = await this.enrichContext(context);

    // 3. Interpolate template, then append CARD_CONTENT_FORMULA guidance so the
    //    doctrine takes effect even when the DB template is generic (L-04 / #16).
    let userPrompt = interpolateTemplate(promptTemplate, enrichedContext);

    const guidance = getFormulaGuidance(sectionKey);
    if (guidance) {
      userPrompt += `\n\n--- KANON JAKOŚCI (docs/standards/CARD_CONTENT_FORMULA.md) ---\n${guidance}`;
    }

    // Surface available evidence/grounding so the model cites it instead of inventing.
    const grounding = buildGroundingBlock(enrichedContext);
    if (grounding) {
      userPrompt += `\n\n--- DOWODY DOSTĘPNE DO UGRUNTOWANIA (nie wykraczaj poza nie; brak → "do ustalenia") ---\n${grounding}`;
    }

    // 4. Call LLM with the McKinsey-grade doctrine system prompt.
    const lang = String(enrichedContext.language || context.language || 'en').toLowerCase();
    const isPolish = lang === 'pl' || lang === 'polish';
    const systemPrompt = isPolish ? DOCTRINE_SYSTEM_PROMPT : DOCTRINE_SYSTEM_PROMPT_EN;

    const llm = llmEarly;

    try {
      // Use the PREMIUM tier (resolves to the best configured provider — latest
      // Claude per project convention — via llmService's tier→provider map; NO
      // provider or API key is hardcoded here). Formula-grade output justifies the
      // stronger model; temperature lowered for grounded, less-florid prose.
      const result = await llm.call({
        type: 'text',
        modelConfig: { id: 'premium' },
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 4096,
        temperature: 0.4,
        cache: true,
        cacheTtl: 3600,
        // Reasoning models (e.g. Z.ai GLM-4.6) think for a long time before
        // emitting the card JSON; the heavy doctrine prompt + 4096-token output
        // routinely exceeds callText's default 60s timeout → the whole card
        // failed (fail-soft) and the initiative was left empty (verified on demo
        // 2026-06-28). Give the generation real headroom; fast models (gpt-4o)
        // finish well under it, so they are unaffected.
        timeoutMs: 150000,
      });

      const content = String(result?.content || '');
      const usage = (result?.usage || {}) as Record<string, number>;
      const tokensUsed =
        usage.totalTokens || usage.completionTokens || Math.floor(content.length / 4);
      const model = String(result?.model || result?.modelId || 'llm-standard');

      // Try to parse as JSON if the prompt requests it
      const isJson = promptTemplate.includes('Return valid JSON');
      let parsedContent: any = undefined;

      if (isJson) {
        try {
          // Extract JSON from potential markdown code blocks
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
          parsedContent = JSON.parse(jsonMatch[1] || content);
        } catch {
          // Content might not be valid JSON - return as-is
          parsedContent = undefined;
        }
      }

      // ADVISORY second pass (§B4/§B6): score the freshly generated content.
      // Opt-in only — pass { withReview: true } to enable the quality-verdict pass.
      // Failures are swallowed — the reviewer is informational and must never break
      // generation.
      const withReview = options?.withReview === true;
      let review: SectionReviewResult | undefined;
      if (withReview) {
        try {
          review = await this.reviewSectionContent(sectionKey, content, {
            language: isPolish ? 'pl' : 'en',
          });
        } catch (reviewErr: any) {
          logger.warn(
            '[InitiativeGeneration] advisory review skipped:',
            reviewErr?.message || reviewErr
          );
        }
      }

      return {
        content,
        isJson,
        parsedContent,
        tokensUsed,
        model,
        ...(review ? { review } : {}),
      };
    } catch (err: any) {
      logger.error('[InitiativeGeneration] LLM call failed:', err?.message || err);
      if (err instanceof AppError) throw err;
      throw new AppError('AI initiative generation failed', 503, 'FEATURE_UNAVAILABLE', {
        message: err?.message || String(err),
      });
    }
  }

  /**
   * ADVERSARIAL REVIEWER (§B4/§B6). Second-pass quality check that scores already-
   * generated section content against CARD_CONTENT_FORMULA (0–100 + PASS/FAIL +
   * specific deficiencies). Reuses the same LLM/provider abstraction as the
   * generator (premium tier; NO provider/key hardcoded). Falls back to a
   * deterministic structural heuristic when no LLM is configured or the model
   * output is unparseable.
   *
   * ADVISORY: callers MUST treat the verdict as informational. Nothing here
   * mutates the initiative, auto-rejects, or auto-submits.
   */
  async reviewSectionContent(
    sectionKey: string,
    content: string,
    options?: { language?: 'en' | 'pl'; sectionName?: string }
  ): Promise<SectionReviewResult> {
    const lang = String(options?.language || 'pl').toLowerCase();
    const isPolish = lang === 'pl' || lang === 'polish';

    const llm = await getLLMServiceInstance();
    if (!llm) {
      return heuristicReview(sectionKey, content);
    }

    const guidance = getFormulaGuidance(sectionKey);
    const sectionLabel = options?.sectionName ? `${options.sectionName} (${sectionKey})` : sectionKey;
    const userPrompt = [
      isPolish
        ? `Oceń poniższą treść sekcji „${sectionLabel}" karty inicjatywy.`
        : `Review the following content of the "${sectionLabel}" section of an initiative card.`,
      guidance ? `\n--- WYMÓG FORMUŁY DLA TEJ SEKCJI ---\n${guidance}` : '',
      `\n--- TREŚĆ DO OCENY ---\n${String(content || '').slice(0, 12000)}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await llm.call({
        type: 'text',
        modelConfig: { id: 'premium' },
        systemPrompt: isPolish ? REVIEWER_SYSTEM_PROMPT_PL : REVIEWER_SYSTEM_PROMPT_EN,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1536,
        // Low temperature: adversarial scoring should be stable, not creative.
        temperature: 0.1,
        // Reasoning models are slow; the review is fail-soft but a 60s timeout
        // here just wastes a retry cycle and drops the heal signal. Give it room.
        timeoutMs: 120000,
        cache: true,
        cacheTtl: 1800,
      });

      const raw = String(result?.content || '');
      const model = String(result?.model || result?.modelId || 'llm-premium');
      const parsed = this.parseReviewJson(raw);
      if (!parsed) {
        // Model spoke, but not parseable JSON — degrade to heuristic, keep model id.
        const fb = heuristicReview(sectionKey, content);
        return { ...fb, model: `${model} (unparseable→heuristic)` };
      }

      const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
      // Trust the model's verdict but enforce the §B4 threshold as a hard floor:
      // a PASS is only honoured at/above the threshold.
      const verdict: 'PASS' | 'FAIL' =
        String(parsed.verdict).toUpperCase() === 'PASS' && score >= REVIEW_PASS_THRESHOLD
          ? 'PASS'
          : 'FAIL';

      return {
        score,
        verdict,
        failedValidators: this.toStringArray(parsed.failedValidators),
        qualityGaps: this.toStringArray(parsed.qualityGaps),
        fixes: this.toStringArray(parsed.fixes),
        sectionKey,
        model,
        degraded: false,
      };
    } catch (err: any) {
      logger.warn('[InitiativeGeneration] reviewSectionContent LLM failed:', err?.message || err);
      // Reviewer is ADVISORY — a failure must never break the generate flow.
      const fb = heuristicReview(sectionKey, content);
      return { ...fb, model: 'heuristic (llm-error)' };
    }
  }

  /** Parse the reviewer's JSON, tolerating markdown fences and surrounding prose. */
  private parseReviewJson(raw: string): any | null {
    const text = String(raw || '').trim();
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (fenced?.[1] || text).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /** Coerce an unknown value into a clean string[] (drops empties). */
  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => (typeof v === 'string' ? v : v == null ? '' : String(v)))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  /**
   * Get AI suggestions for which sections to enable based on initiative context
   */
  async suggestSections(
    context: GenerationContext,
    organizationId?: string
  ): Promise<{ key: string; reason: string; priority: 'high' | 'medium' | 'low' }[]> {
    const llm = await getLLMServiceInstance();
    if (!llm) {
      return [
        { key: 'overview', reason: 'Required for every initiative', priority: 'high' as const },
        { key: 'tasks', reason: 'Core execution plan', priority: 'medium' as const },
        { key: 'decisions', reason: 'Key decision log', priority: 'medium' as const },
      ];
    }

    // Get all available section types
    let allSections: any[] = [];
    try {
      allSections = await initiativeSectionTypeService.getAllSectionTypes(
        organizationId || undefined
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      if (
        msg.includes('no such table') ||
        msg.includes('SQLITE_ERROR') ||
        msg.includes('does not exist') ||
        msg.includes('relation')
      ) {
        throw new AppError(
          'Initiative section types are not available (schema missing)',
          503,
          'FEATURE_UNAVAILABLE',
          { message: msg }
        );
      }
      throw err;
    }

    const langName = context.language === 'pl' ? 'Polish' : 'English';
    const prompt = `Given this initiative context, suggest which sections should be enabled and their priority.

Initiative: ${context.initiativeName}
Description: ${context.summary || 'Not yet defined'}
Category: ${context.category || 'general'}
Module: ${context.module || 'general'}
Language: ${langName}

Available sections:
${allSections.map((s) => `- ${s.key}: ${s.name} (${s.description || 'No description'})`).join('\n')}

Return a JSON array of section suggestions:
[{ "key": "section_key", "reason": "Why this section is important", "priority": "high|medium|low" }]

Only include sections that are truly relevant. Order by priority.
Respond in the requested language only.
Return valid JSON array only.`;

    try {
      const result = await llm.call({
        type: 'text',
        modelConfig: { id: 'standard' },
        systemPrompt: `You are an expert in initiative planning. Suggest relevant sections based on context. Respond in ${langName}.`,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2048,
        temperature: 0.5,
        cache: true,
      });

      const content = String(result?.content || '[]');
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      return JSON.parse(jsonMatch[1] || content);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      logger.error('[InitiativeGeneration] suggestSections failed:', msg);
      if (err instanceof AppError) throw err;
      throw new AppError('AI section suggestions failed', 503, 'FEATURE_UNAVAILABLE', {
        message: msg,
      });
    }
  }

  /**
   * Enrich context with data from the database
   */
  private async enrichContext(context: GenerationContext): Promise<GenerationContext> {
    if (!context.initiativeId) return context;

    try {
      // Get initiative data
      const initiative = await DbPromise.get<any>(
        this.db,
        'SELECT * FROM initiatives WHERE id = ?',
        [context.initiativeId]
      );

      if (initiative) {
        // Grounding: lineage (kills orphan/invented cards) + existing KPIs so the
        // model anchors KPI/sizing proposals to real measures instead of inventing.
        let sourceLineage: string | undefined;
        if (initiative.source_type) {
          sourceLineage =
            initiative.source_type === 'manual'
              ? 'manual (ręcznie, brak źródła diagnozy)'
              : `${initiative.source_type}${initiative.source_id ? ` #${initiative.source_id}` : ''}`;
        }

        let existingKpis: string | undefined;
        try {
          const kpiRows = await DbPromise.all<any>(
            this.db,
            'SELECT name, unit, baseline, target FROM initiative_kpis WHERE initiative_id = ? LIMIT 10',
            [context.initiativeId]
          );
          if (Array.isArray(kpiRows) && kpiRows.length) {
            existingKpis = kpiRows
              .map(
                (k: any) =>
                  `${k.name || '—'} (baseline ${k.baseline ?? 'do ustalenia'} → cel ${k.target ?? '—'} ${k.unit || ''})`
              )
              .join('; ');
          }
        } catch {
          /* initiative_kpis table may be absent — grounding is best-effort */
        }

        // F0 — portfolio awareness: istniejące inicjatywy w org (dedup/MECE). Best-effort.
        let portfolioSummary: string | undefined;
        try {
          const orgId = initiative.organization_id;
          if (orgId) {
            const others = await DbPromise.all<any>(
              this.db,
              `SELECT name, status FROM initiatives
               WHERE organization_id = ? AND id != ? AND status NOT IN ('ARCHIVED','CANCELLED')
               ORDER BY updated_at DESC LIMIT 15`,
              [orgId, context.initiativeId]
            );
            if (Array.isArray(others) && others.length) {
              portfolioSummary = others
                .map((o: any) => `${o.name || '—'} [${o.status || '—'}]`)
                .join('; ');
            }
          }
        } catch {
          /* best-effort — portfolio grounding optional */
        }

        // F0 — financials: realne dane finansowe org (P&L) dla business-case. Best-effort.
        let financialsSummary: string | undefined;
        try {
          if (initiative.organization_id) {
            financialsSummary = await buildOrgFinancialsSummary(this.db, initiative.organization_id);
          }
        } catch {
          /* best-effort — financialsGrounding fail-soft */
        }

        // F0 — org-context: profil organizacji (nazwa + branża) dla ugruntowania. Best-effort.
        let orgContext: string | undefined;
        try {
          const orgId = initiative.organization_id;
          if (orgId) {
            const org = await DbPromise.get<any>(
              this.db,
              `SELECT name, industry FROM organizations WHERE id = ?`,
              [orgId]
            );
            if (org) {
              const parts = [org.name, org.industry ? `branża: ${org.industry}` : ''].filter(Boolean);
              if (parts.length) orgContext = parts.join(' — ');
            }
          }
        } catch {
          /* best-effort — kolumna industry może nie istnieć */
        }

        return {
          ...context,
          initiativeName: context.initiativeName || initiative.name,
          summary: context.summary || initiative.summary || initiative.description,
          problemStatement: context.problemStatement || initiative.problem_statement,
          category: context.category || initiative.category,
          module: context.module || initiative.module,
          status: context.status || initiative.status,
          currentPhase: context.currentPhase || initiative.current_phase,
          sourceLineage: context.sourceLineage || sourceLineage,
          existingKpis: context.existingKpis || existingKpis,
          portfolioSummary: context.portfolioSummary || portfolioSummary,
          orgContext: context.orgContext || orgContext,
          financialsSummary: context.financialsSummary || financialsSummary,
          language: context.language || 'en',
        };
      }
    } catch (err: any) {
      logger.warn('[InitiativeGeneration] Failed to enrich context:', err.message);
    }

    return context;
  }

  /**
   * R2 (payoff F3 / D11 + D12) — generuje treść sekcji JAKO `CardSpec` (grammar
   * bloków) zamiast wolnego tekstu, i przepuszcza ją przez DETERMINISTYCZNĄ
   * bramkę `validateCardSpec`. Issue CRITICAL → JEDNA regeneracja z feedbackiem
   * (auto-heal, wzór deckDesignCritic M17). Po wyczerpaniu prób zwraca
   * `ok=false` — wołający robi fallback do buildera per-pole (sekcja R1).
   *
   * NIE zastępuje `generateSectionContent` (tor wolnotekstowy żyje dalej) —
   * to równoległa, opt-in zdolność strukturalna.
   */
  async generateSectionCardSpec(
    sectionKey: string,
    context: GenerationContext,
    _organizationId?: string,
    options?: { maxRegen?: number; sectionTitle?: string }
  ): Promise<CardSpecGenerationResult> {
    const llm = await getLLMServiceInstance();
    if (!llm) {
      return { cardSpec: null, issues: [], ok: false, regenerated: false, tokensUsed: 0, model: 'placeholder' };
    }

    // Enrich for grounding parity (fail-soft: DB hiccup nie psuje generacji).
    let enriched = context;
    try {
      enriched = await this.enrichContext(context);
    } catch {
      enriched = context;
    }

    const lang = String(enriched.language || context.language || 'en').toLowerCase();
    const isPolish = lang === 'pl' || lang === 'polish';
    const guidance = getFormulaGuidance(sectionKey) || '';
    const grounding = buildGroundingBlock(enriched) || '';
    const fallbackTitle = String(options?.sectionTitle || enriched.initiativeName || sectionKey);

    const systemPrompt = buildCardSpecSystemPrompt(isPolish);
    const baseUserPrompt = buildCardSpecUserPrompt({
      sectionKey,
      isPolish,
      context: enriched,
      guidance,
      grounding,
      fallbackTitle,
    });

    // D12: domyślnie JEDNA regeneracja (maxRegen=1 → łącznie do 2 prób).
    const maxRegen = Math.max(0, options?.maxRegen ?? 1);

    let spec: CardSpec | null = null;
    let issues: CardIssue[] = [];
    let regenerated = false;
    let tokensUsed = 0;
    let model = 'llm-standard';
    let lastBadSpecJson = '';

    for (let attempt = 0; attempt <= maxRegen; attempt++) {
      const userPrompt =
        attempt === 0
          ? baseUserPrompt
          : `${baseUserPrompt}\n\n--- POPRZEDNIA PRÓBA ODRZUCONA PRZEZ WALIDATOR ---\nSpec:\n${lastBadSpecJson}\n\nProblemy (napraw KAŻDY, zwłaszcza CRITICAL):\n${summarizeIssues(issues)}\n\nZwróć POPRAWIONY CardSpec — sam JSON.`;
      if (attempt > 0) regenerated = true;

      let content = '';
      try {
        const result = await llm.call({
          type: 'text',
          modelConfig: { id: 'premium' },
          systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          maxTokens: 4096,
          temperature: 0.3,
          cache: false,
        });
        content = String(result?.content || '');
        const usage = (result?.usage || {}) as Record<string, number>;
        tokensUsed += usage.totalTokens || usage.completionTokens || Math.floor(content.length / 4);
        model = String(result?.model || result?.modelId || model);
      } catch (err: any) {
        logger.error('[InitiativeGeneration] cardSpec LLM call failed:', err?.message || err);
        break;
      }

      const raw = extractJsonObject(content);
      spec = coerceToCardSpec(raw, sectionKey, fallbackTitle);
      issues = validateCardSpec(spec);
      if (!hasCriticalIssues(issues)) break; // bramka przeszła — koniec
      lastBadSpecJson = JSON.stringify(spec).slice(0, 2000);
    }

    return {
      cardSpec: spec,
      issues,
      ok: !!spec && !hasCriticalIssues(issues),
      regenerated,
      tokensUsed,
      model,
    };
  }

  /**
   * Dependency injection for tests
   */
  setDependencies(deps: { db?: any }) {
    if (deps.db) this.db = deps.db;
  }
}

export default new InitiativeGenerationService();

// ==========================================
// R2 — CardSpec generation helpers (pure, module-scope)
// ==========================================

/** Wyłuskuje obiekt JSON z odpowiedzi LLM (fences / otaczająca proza). null gdy brak. */
export function extractJsonObject(content: string): unknown {
  const text = String(content || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    /* fallthrough */
  }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function buildCardSpecSystemPrompt(isPolish: boolean): string {
  return isPolish
    ? `Jesteś konsultantem klasy McKinsey (docs/standards/CARD_CONTENT_FORMULA.md, docs/initiatives/INITIATIVE_FORMULA.md). Komponujesz KARTĘ inicjatywy jako listę deklaratywnych BLOKÓW (grammar), nie wolny tekst. Zwracasz WYŁĄCZNIE poprawny JSON — bez markdown, bez code-fence, bez komentarza.`
    : `You are a McKinsey-grade consultant (per docs/standards/CARD_CONTENT_FORMULA.md and docs/initiatives/INITIATIVE_FORMULA.md). You compose an initiative CARD as a list of declarative BLOCKS (a grammar), not free prose. Return ONLY valid JSON — no markdown, no code fences, no commentary.`;
}

interface CardSpecUserPromptArgs {
  sectionKey: string;
  isPolish: boolean;
  context: GenerationContext;
  guidance: string;
  grounding: string;
  fallbackTitle: string;
}

function buildCardSpecUserPrompt(args: CardSpecUserPromptArgs): string {
  const { sectionKey, isPolish, context, guidance, grounding, fallbackTitle } = args;
  const vocab = CARD_BLOCK_TYPES.join(', ');
  const schema = [
    `heading   { "type":"heading", "text": string, "level"?: 3|4 }`,
    `paragraph { "type":"paragraph", "text": string, "emphasis"?: "normal"|"lead"|"muted" }`,
    `bullet_list { "type":"bullet_list", "items": string[], "ordered"?: boolean }`,
    `kpi_strip { "type":"kpi_strip", "tiles": [{ "label": string, "value": string, "delta"?: string, "trend"?: "up"|"down"|"flat" }] }`,
    `table     { "type":"table", "columns": string[], "rows": string[][] }  // KAŻDY wiersz == liczba kolumn`,
    `callout   { "type":"callout", "tone": "info"|"success"|"warning"|"danger", "title"?: string, "text": string }`,
    `chart     { "type":"chart", "chartKind": "bar"|"line"|"pie"|"area", "title"?: string, "series": [{ "label": string, "value": number }] }`,
  ].join('\n');

  const header = isPolish
    ? `Zbuduj kartę sekcji "${sectionKey}" dla inicjatywy "${context.initiativeName || ''}".`
    : `Build the "${sectionKey}" section card for initiative "${context.initiativeName || ''}".`;

  const rules = isPolish
    ? [
        `Dozwolone typy bloków: ${vocab}.`,
        `Zwróć obiekt: { "title": string, "blocks": Block[] } — "title" to action-title sekcji.`,
        `Używaj WYŁĄCZNIE liczb/faktów z sekcji DOWODY poniżej; brak danych → POMIŃ blok (nie wymyślaj).`,
        `Min. 1 blok z treścią. Wartości KPI/finansów już sformatowane (np. "1,2 mln zł", "37%").`,
        `Tytuł, jeśli nie masz lepszego: "${fallbackTitle}".`,
      ].join('\n')
    : [
        `Allowed block types: ${vocab}.`,
        `Return an object: { "title": string, "blocks": Block[] } — "title" is the section action-title.`,
        `Use ONLY numbers/facts from the EVIDENCE section below; if data is missing → OMIT the block (never invent).`,
        `At least 1 block with content. KPI/financial values pre-formatted (e.g. "1.2M PLN", "37%").`,
        `Title fallback if none better: "${fallbackTitle}".`,
      ].join('\n');

  const parts = [header, '', isPolish ? 'SCHEMAT BLOKÓW:' : 'BLOCK SCHEMA:', schema, '', rules];
  if (guidance) {
    parts.push('', `--- KANON JAKOŚCI (CARD_CONTENT_FORMULA) ---`, guidance);
  }
  if (grounding) {
    parts.push(
      '',
      isPolish
        ? '--- DOWODY DOSTĘPNE DO UGRUNTOWANIA (nie wykraczaj poza nie) ---'
        : '--- EVIDENCE AVAILABLE FOR GROUNDING (do not go beyond it) ---',
      grounding
    );
  }
  parts.push('', isPolish ? 'Zwróć WYŁĄCZNIE JSON.' : 'Return JSON ONLY.');
  return parts.join('\n');
}

/**
 * Teresa last-mile (backlog #1): create a REAL initiative from a Teresa handoff.
 *
 * Exported as a NAMED function because `teresaCopilotService.handleInitiativesHandoff`
 * looks for `createInitiative` on this module. Previously no such export existed
 * (the module only default-exports a generation class), so the handoff silently
 * fell back to a synthetic UUID (`real_entity:false`). This delegates to the
 * canonical `InitiativeService` so a real `initiatives` row is written.
 */
export async function createInitiative(params: {
  organizationId: string;
  title?: unknown;
  description?: unknown;
  source?: string;
  proposalId?: string;
}): Promise<{ id: string }> {
  const { default: initiativeService } = await import('./initiativeService.js');
  const created: any = await initiativeService.createInitiative({
    organization_id: params.organizationId,
    title: String(params.title || 'Teresa initiative').slice(0, 500),
    summary: String(params.description || ''),
    // USPOJNIENIE A1: status startowy MUSI być kanoniczny (DRAFT). Wcześniej
    // 'step3' — legacy poza enumem cyklu życia → łamał CHECK constraint
    // (initiatives_status_check) i wstrzykiwał status spoza kanonu przez lejek.
    status: 'DRAFT',
  } as any);
  return { id: String(created?.id || '') };
}
