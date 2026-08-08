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
import * as queryHelpers from '../utils/queryHelpers.js';
import {
  CARD_BLOCK_TYPES,
  type CardIssue,
  type CardSpec,
  coerceToCardSpec,
  hasCriticalIssues,
  summarizeIssues,
  validateCardSpec,
} from './initiative/cardSpecSchema.js';
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';
import { buildOrgFinancialsSummary } from './initiative/financialsGrounding.js';
import { findDuplicateInitiative } from './initiative/initiativeCandidateService.js';
import { resolveProjectIdFromSource } from './initiative/sourceProjectResolver.js';
import { isRequireInitiativeProjectEnabled } from './initiativeProjectPolicyService.js';
import initiativeSectionTypeService from './initiativeSectionTypeService.js';

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
  /**
   * §6 downstream Insight seed (#57/Z60) — a suggested owner ROLE inherited
   * from the source Insight's issue/opportunity, when the distillation
   * already grounded one (see `insightMaterializationService.
   * deriveInitiativeSeedContext`). Present only when a caller supplied it —
   * absent means "no seed available", NOT "guess one" (unchanged behavior).
   */
  seedOwnerRole?: string;
  /**
   * §6 downstream Insight seed (#57/Z60) — "metric (baseline → target,
   * horyzont)" seeds inherited from the source Insight, joined per grounded
   * issue/opportunity. See `seedOwnerRole` for the same absence contract.
   */
  seedKpiSeeds?: string;
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

const DOCTRINE_SYSTEM_PROMPT = `Jesteś partnerem konsultingowym poziomu BCG/McKinsey, budującym dokumentację inicjatywy transformacyjnej.
Tworzysz treść JEDNEJ sekcji karty inicjatywy wg kanonu jakości (SSOT: docs/standards/CARD_CONTENT_FORMULA.md + docs/initiatives/INITIATIVE_FORMULA.md).
Cel jakości: dokument, który właściciel PODPISZE przed klientem bez poprawek.

REGUŁY BEZWZGLĘDNE — złamanie którejkolwiek = FAIL (każda dotyczy KAŻDEJ rubryki):
1. JĘZYK KLIENTA: cała proza widoczna dla użytkownika po POLSKU, konkret biznesowy — NIE żargon techniczny bez potrzeby. Wyjątek: akronimy/metodyki (SIPOC, RACI, RAID, KPI, SLA, MECE, PMO, WBS, CAPEX, OPEX, ROI) oraz nazwy własne/produkty.
2. ANSWER-FIRST (piramida Minto): pierwsze zdanie niesie konkluzję/tezę, potem dowód. Żadnej "rozgrzewki".
3. MECE: listy wzajemnie wykluczające się i wyczerpujące; brak nakładania i luk. Tam gdzie wymagane ≥3 pozycje — lista 1-elementowa = FAIL.
4. UGRUNTOWANIE (grounded): opieraj się TYLKO na dostępnych dowodach (kontekst/insight/dokument/sesja/dane); brak dowodu → jawnie oznacz jako hipotezę z limitem pewności. NIGDY nie zmyślaj faktów o firmie, danych ani liczb.
5. KWANTYFIKACJA Z JAWNYM ZAŁOŻENIEM: każda liczba ma źródło LUB oznaczenie "szacunek: [założenie]" + horyzont (zł/%/dni/szt.). Nigdy gołe liczby.
   ⛔ ZAKAZ BEZWZGLĘDNY w CELACH, KPI, ROI, kryteriach sukcesu i kosztach: fraz "do ustalenia" / "TBD" / "do określenia" / "do uzupełnienia" jako WARTOŚCI celu/baseline/targetu. Cel bez liczby = niefalsyfikowalny = FAIL.
   ZAMIAST tego ZAWSZE podaj SZACUNEK Z JAWNYM ZAŁOŻENIEM w formacie: "[liczba+jednostka] (szacunek; zakładając [konkretne założenie])". Przykład ZŁY: "redukcja o do ustalenia %". Przykład DOBRY: "redukcja o 15% (szacunek; zakładając eliminację 3 z 8 przestojów miesięcznie)".
   Jeśli w kontekście są dane finansowe org (przychód/EBITDA/koszty) — ZAKOTWICZ szacunek jako % lub ułamek tej bazy (np. "oszczędność ~2% kosztów operacyjnych = [kwota] PLN rocznie") i wskaż tę bazę wprost. Baseline nieznany → oszacuj rozsądny punkt startowy z jawnym założeniem, NIE zostawiaj pustego.
6. FALSYFIKOWALNOŚĆ: tezy w formie testowalnej ("Jeśli X, to Y (mierzalne), bo Z"), nie życzeniowej.
7. UCZCIWA NIEPEWNOŚĆ: gdy brak danych — oznacz jako szacunek z założeniem (NIE "do ustalenia"). Niepewność wyrażasz przez jawne założenie i horyzont, nie przez pustą wartość. Spory/braki nazwane, nie wygładzone.
8. ZERO FILLERA: bez ozdobników typu "w dzisiejszym dynamicznym świecie". Każde zdanie niesie informację.
9. SPÓJNOŚĆ LICZB (jedna wartość na metrykę): dla KAŻDEJ metryki (CAC, ARR, przychód, wzrost %, liczba klientów, koszt, ROI, payback) użyj DOKŁADNIE JEDNEJ wartości LUB jednego przedziału w CAŁEJ karcie. Baseline metryki = jedna liczba. NIE podawaj sprzecznych wartości tej samej wielkości w różnych polach/akapitach (np. raz "62%", potem "62-124%", potem "3×" dla tego samego wzrostu; ani dwóch różnych CAC w jednym rekordzie). Jeśli używasz przedziału — ten SAM przedział wszędzie. Przelicz raz i trzymaj się jednej liczby.
10. KOTWICE RYNKOWE TYLKO Z ŹRÓDŁEM (grounding): liczby rynkowe ZEWNĘTRZNE (TAM, wielkość rynku €/$, udziały rynkowe, benchmarki branżowe) podawaj TYLKO gdy możesz wskazać metodę wyliczenia LUB źródło. Inaczej oznacz jawnie jako "szacunek własny, do uźródłowienia" ALBO pomiń. ⛔ ZAKAZ FABRYKOWANIA ATRYBUCJI: nie pisz "według Gartnera", "wg IDC", "raport McKinsey podaje" ani nie podawaj konkretnych kwot rynkowych (np. "rynek €3,2 mld") bez pewności co do źródła. Zmyślona kotwica z fałszywym źródłem = FAIL.

ANTY-WZORCE = AUTOMATYCZNY FAIL: ogólniki bez liczb; listy 1-elementowe tam gdzie wymagane ≥3; "TBD"/"do ustalenia"/"do określenia"/"do uzupełnienia" jako wartość celu/KPI/ROI (ZAWSZE zastąp szacunkiem z założeniem); przepisanie tytułu sekcji jako treści; placeholder udający treść; sprzeczne wartości tej samej metryki w jednej karcie; zmyślone źródło zewnętrzne ("według Gartnera" bez pewności); daty/terminy planów w PRZESZŁOŚCI.

DOKTRYNA INICJATYWY (gdy dotyczy sekcji):
- TEZA falsyfikowalna w formacie "Jeśli X, to Y (mierzalne) bo Z".
- KPI: zawsze baseline→target + kierunek + jednostka. Brak baseline → OSZACUJ punkt startowy z jawnym założeniem (np. baseline:"~40h/mies. (szacunek; zakładając X)"), NIGDY baseline:"do ustalenia". Target ZAWSZE liczbowy. Min. 1 KPI primary.
- RAID: min. 2×RISK + 1×ASSUMPTION + 1×DEPENDENCY; każdy z probability+impact+mitigation_plan.
- scope_out: MECE — przynajmniej jedna pozycja odwołuje się do innej inicjatywy ("→ N…").
- kill_criteria: konkretny warunek STOP, min. 2.
- Sizing/ROI: rząd wielkości + jawne założenie + ROI (krotność lub %); enabler → wartość pośrednia + proxy.
  ROI POLICZONY: gdy podajesz przychód/oszczędność ORAZ koszt/nakład — MUSISZ jawnie policzyć i podać ROI z tych własnych liczb w formacie "ROI = [X]% (zysk netto ÷ nakład), payback [Y] mies., przy założeniu [Z]". NIE zostawiaj ROI pustego ani opisowego, skoro masz obie liczby. Budżet podaj jako JEDNĄ jawną kwotę z jednostką i skalą (np. "1,2 mln PLN"), nie "~400k" wtopione w prozę.

Gdy proszą o JSON — zwróć WYŁĄCZNIE poprawny JSON (bez markdown, bez komentarza).
Gdy proszą o prozę — answer-first, po polsku (chyba że kontekst jawnie żąda angielskiego).`;

const DOCTRINE_SYSTEM_PROMPT_EN = `You are a BCG/McKinsey-grade consulting partner building transformation-initiative documentation.
You write content for ONE section of an initiative card per the quality canon (SSOT: docs/standards/CARD_CONTENT_FORMULA.md + docs/initiatives/INITIATIVE_FORMULA.md).
Quality bar: a document the owner will SIGN in front of the client without edits.

ABSOLUTE RULES — breaking any = FAIL (apply to EVERY field):
1. CLIENT LANGUAGE: business-concrete prose, NOT technical jargon unless necessary.
2. ANSWER-FIRST (Minto pyramid): the first sentence carries the conclusion/thesis, then the proof. No "warm-up".
3. MECE: mutually exclusive, collectively exhaustive lists; no overlaps, no gaps. Where ≥3 items are required, a 1-item list = FAIL.
4. GROUNDING: rely ONLY on available evidence (context/insight/document/session/data); no evidence → explicitly mark as a hypothesis with a confidence limit. NEVER fabricate company facts, data, or numbers.
5. QUANTIFICATION WITH EXPLICIT ASSUMPTION: every number cites a source OR is tagged "estimate: [assumption]" + horizon (currency/%/days/units). Never bare numbers.
   ⛔ HARD BAN in GOALS, KPIs, ROI, success criteria and costs: the phrases "to be determined" / "TBD" / "to be defined" as the VALUE of a goal/baseline/target. A goal without a number = non-falsifiable = FAIL.
   INSTEAD always give an ESTIMATE WITH AN EXPLICIT ASSUMPTION in the form: "[number+unit] (estimate; assuming [concrete assumption])". BAD: "reduce by TBD %". GOOD: "reduce by 15% (estimate; assuming elimination of 3 of 8 monthly outages)".
   If org financial data (revenue/EBITDA/costs) is in context — ANCHOR the estimate as a % or fraction of that base and state the base explicitly. Unknown baseline → estimate a reasonable starting point with an explicit assumption; never leave it empty.
6. FALSIFIABILITY: theses in testable form ("If X, then Y (measurable), because Z"), not wishful.
7. HONEST UNCERTAINTY: when data is missing, mark it as an estimate with an assumption (NOT "to be determined"). Express uncertainty via an explicit assumption + horizon, not an empty value. Disputes/gaps named, not smoothed.
8. ZERO FILLER: no ornaments like "in today's dynamic world". Every sentence carries information.
9. NUMBER CONSISTENCY (one value per metric): for EVERY metric (CAC, ARR, revenue, growth %, customer count, cost, ROI, payback) use EXACTLY ONE value OR one range across the WHOLE card. A metric baseline = one number. Do NOT give conflicting values of the same quantity in different fields/paragraphs (e.g. "62%" then "62-124%" then "3×" for the same growth; or two different CACs in one record). If you use a range — the SAME range everywhere. Compute once and stick to one number.
10. MARKET ANCHORS ONLY WITH A SOURCE (grounding): EXTERNAL market numbers (TAM, market size €/$, market share, industry benchmarks) only when you can cite a computation method OR a source. Otherwise mark them explicitly as "own estimate, to be sourced" OR omit. ⛔ NO FABRICATED ATTRIBUTION: do not write "according to Gartner", "per IDC", "a McKinsey report states", nor cite specific market amounts (e.g. "€3.2B market") without certainty of the source. A fabricated anchor with a fake source = FAIL.

ANTI-PATTERNS = AUTOMATIC FAIL: generalities without numbers; 1-item lists where ≥3 are required; "TBD"/"to be determined" as a goal/KPI/ROI value (always replace with an estimate-plus-assumption); restating the section title as content; filler posing as content; conflicting values of the same metric in one card; a fabricated external source ("according to Gartner" without certainty); dates/plan deadlines in the PAST.

INITIATIVE DOCTRINE (where the section applies):
- Falsifiable HYPOTHESIS in the form "If X, then Y (measurable) because Z".
- KPI: always baseline→target + direction + unit. Missing baseline → ESTIMATE a starting point with an explicit assumption (e.g. baseline:"~40h/mo (estimate; assuming X)"), NEVER baseline:"to be determined". Target always numeric. At least 1 primary KPI.
- RAID: min 2×RISK + 1×ASSUMPTION + 1×DEPENDENCY; each with probability+impact+mitigation_plan.
- scope_out: MECE — at least one item references another initiative.
- kill_criteria: a concrete STOP condition, min 2.
- Sizing/ROI: order of magnitude + explicit assumption + ROI (multiple or %); enabler → indirect value + proxy.
  COMPUTED ROI: when you state revenue/savings AND cost/investment — you MUST explicitly compute and give ROI from your own numbers as "ROI = [X]% (net gain ÷ investment), payback [Y] months, assuming [Z]". Do NOT leave ROI empty or purely narrative when you already have both numbers. Give the budget as ONE explicit amount with unit and scale (e.g. "1.2M PLN"), not "~400k" buried in prose.

When JSON is requested — return ONLY valid JSON (no markdown, no commentary).
When prose is requested — answer-first.`;

/**
 * DEFEKT SĘDZIEGO #2 — daty z przeszłości. Model recyklinguje szablony z przeszłymi
 * terminami (np. "Q1 2025", "Q4 2024") w projekcie realizowanym w 2026+. Wstrzykujemy
 * DYNAMICZNIE bieżący rok (z zegara serwera, nie hardcode) i twardą regułę, że KAŻDA
 * data/kamień milowy planu musi być w PRZYSZŁOŚCI względem teraz. Dołączane do system-
 * promptu przy KAŻDYM wywołaniu, więc reguła nie starzeje się z upływem lat.
 */
export function buildTemporalRule(isPolish: boolean, now: Date = new Date()): string {
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return isPolish
    ? `\n\n⏱ REGUŁA CZASU (bezwzględna): DZIŚ jest ${year} r. (Q${q} ${year}). WSZYSTKIE daty, kwartały, kamienie milowe, terminy i horyzonty planów MUSZĄ być w PRZYSZŁOŚCI względem teraz — czyli ${year} lub później. ⛔ ZAKAZ dat/terminów planów z PRZESZŁOŚCI (np. Q4 2024, Q1 2025, "do końca 2025"). Jeśli szablon podpowiada przeszły termin — ZASTĄP go przyszłym (${year}+) lub użyj horyzontu WZGLĘDNEGO ("w ciągu 6 mies. od startu", "kwartał po pilocie"). Data przeszła jako termin planu = FAIL.`
    : `\n\n⏱ TIME RULE (absolute): TODAY is ${year} (Q${q} ${year}). ALL dates, quarters, milestones, deadlines and plan horizons MUST be in the FUTURE relative to now — i.e. ${year} or later. ⛔ NO past plan dates/deadlines (e.g. Q4 2024, Q1 2025, "by end of 2025"). If a template suggests a past deadline — REPLACE it with a future one (${year}+) or use a RELATIVE horizon ("within 6 months of start", "the quarter after the pilot"). A past date as a plan deadline = FAIL.`;
}

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
- kpi_baseline_target: ≥2 KPI, ≥1 primary, każdy baseline→target + kierunek + jednostka. FAIL jeśli baseline LUB target = "do ustalenia"/"TBD"/"do określenia" (musi być liczbowy szacunek z założeniem);
- raid_mix: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY, każde z probability+impact+mitigation;
- scope_out_mece: ≥1 pozycja scope_out odwołuje się do INNEJ inicjatywy;
- kill_count: ≥2 konkretne warunki STOP;
- sizing_present: liczba + jawne założenie + ROI;
- roi_computed: gdy karta podaje przychód/oszczędność ORAZ koszt/nakład — ROI jest JAWNIE POLICZONY liczbą (% lub krotność) + payback. FAIL jeśli ROI pusty/tylko opisowy mimo obecnych obu liczb; FAIL jeśli budżet podany tylko jako mgliste "~400k" w prozie, bez jednej jawnej kwoty z jednostką;
- number_consistency: KAŻDA metryka (CAC, ARR, wzrost %, koszt, ROI, liczba klientów) ma DOKŁADNIE JEDNĄ wartość/przedział w całej karcie. FAIL jeśli ta sama wielkość ma sprzeczne wartości w różnych polach/akapitach (np. "62%" vs "62-124%" vs "3×"; dwa różne CAC);
- future_dates: WSZYSTKIE daty/terminy/kamienie planów w PRZYSZŁOŚCI względem bieżącego roku. FAIL jeśli termin planu w przeszłości (np. Q4 2024, Q1 2025);
- market_grounding: zewnętrzne kotwice rynkowe (TAM, wielkość rynku €/$, udziały, benchmarki) mają metodę/źródło LUB oznaczenie "szacunek własny, do uźródłowienia". FAIL jeśli zmyślona atrybucja ("według Gartnera", "raport IDC") bez pewności lub gołe kwoty rynkowe bez źródła;
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
- kpi_baseline_target: ≥2 KPI, ≥1 primary, each baseline→target + direction + unit. FAIL if baseline OR target = "to be determined"/"TBD" (must be a numeric estimate with an assumption);
- raid_mix: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY, each with probability+impact+mitigation;
- scope_out_mece: ≥1 scope_out item references ANOTHER initiative;
- kill_count: ≥2 concrete STOP conditions;
- sizing_present: number + explicit assumption + ROI;
- roi_computed: when the card states revenue/savings AND cost/investment — ROI is EXPLICITLY COMPUTED as a number (% or multiple) + payback. FAIL if ROI is empty/only narrative despite both numbers being present; FAIL if budget is only a vague "~400k" in prose without one explicit amount + unit;
- number_consistency: EVERY metric (CAC, ARR, growth %, cost, ROI, customer count) has EXACTLY ONE value/range across the card. FAIL if the same quantity has conflicting values in different fields/paragraphs (e.g. "62%" vs "62-124%" vs "3×"; two different CACs);
- future_dates: ALL dates/deadlines/plan milestones are in the FUTURE relative to the current year. FAIL if a plan deadline is in the past (e.g. Q4 2024, Q1 2025);
- market_grounding: external market anchors (TAM, market size €/$, share, benchmarks) cite a method/source OR are flagged "own estimate, to be sourced". FAIL if fabricated attribution ("according to Gartner", "an IDC report") without certainty, or bare market amounts without a source;
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
export function heuristicReview(sectionKey: string, content: string): SectionReviewResult {
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

  // "do ustalenia"/"do określenia"/"do uzupełnienia" jako WARTOŚĆ celu/KPI/ROI =
  // niefalsyfikowalny cel (defekt sędziego BCG #1). Doktryna wymaga szacunku z
  // założeniem — nie pustej frazy. Karzemy je jak placeholder w sekcjach celów.
  const unquantifiedGoalRe =
    /\bdo ustalenia\b|\bdo określenia\b|\bdo uzupełnienia\b|\bto be determined\b/i;
  const isGoalSection =
    sectionKey === 'kpis' ||
    sectionKey === 'kpi' ||
    sectionKey === 'target-state' ||
    sectionKey === 'targetState' ||
    sectionKey === 'financial-analysis' ||
    sectionKey === 'financial-impact' ||
    sectionKey === 'financialAnalysis' ||
    sectionKey === 'financialImpact';
  if (isGoalSection && unquantifiedGoalRe.test(text)) {
    failedValidators.push('quantified_goal');
    qualityGaps.push(
      'Cel/KPI/ROI z frazą „do ustalenia" zamiast liczbowego szacunku — niefalsyfikowalny.'
    );
    fixes.push(
      'Zastąp „do ustalenia" szacunkiem z jawnym założeniem, np. „redukcja o 15% (szacunek; zakładając X)".'
    );
    score -= 30;
  }

  // Section-specific structural checks (cheap, deterministic).
  if (sectionKey === 'kpis' || sectionKey === 'kpi') {
    // A quantified KPI section carries an explicit baseline→target with numbers.
    // Presence of the escape phrase is NO LONGER a PASS signal (see above).
    if (!/baseline/i.test(text) || !/\d/.test(text)) {
      failedValidators.push('kpi_baseline_target');
      qualityGaps.push('Brak liczbowego baseline→target w KPI.');
      fixes.push('Dodaj liczbowy baseline→target + kierunek + jednostkę dla każdego KPI.');
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
  problemDefinition: `WYMÓG FORMUŁY (problem): przyczyny ŹRÓDŁOWE (nie objawy), ugruntowane w dowodach z kontekstu. symptom = obserwowalne objawy; rootCause = analiza przyczyny źródłowej; costOfInaction = skwantyfikowany koszt zaniechania (kwota/%/dni + JAWNE ZAŁOŻENIE). ⛔ costOfInaction NIGDY "do ustalenia" — podaj szacunek liczbowy z założeniem (zakotwicz w danych finansowych org, jeśli są).`,
  targetState: `WYMÓG FORMUŁY: deliverables ≥4, konkretne i rzeczownikowe; successCriteria ≥4, MIERZALNE (każde z liczbą+jednostką+kierunkiem) i spójne z KPI. ⛔ ZAKAZ "do ustalenia"/"TBD" w successCriteria — każde kryterium ma liczbowy cel z jawnym założeniem (np. "skrócenie cyklu o 20% (szacunek; zakładając X)"). targetDescription answer-first.`,
  scope: `WYMÓG FORMUŁY: inScope ≥3 jednoznaczne; outOfScope ≥3 MECE — przynajmniej jedna pozycja odwołuje się do INNEJ inicjatywy; killCriteria ≥2 konkretne warunki STOP (np. "jeśli po 3 mies. baseline nie drgnie → zatrzymaj").`,
  kpis: `WYMÓG FORMUŁY: ≥2 KPI, ≥1 primary. KAŻDY KPI: baseline→target + kierunek (wzrost/spadek) + jednostka. ⛔ ZAKAZ baseline:"do ustalenia" oraz target:"do ustalenia"/"redukcja o do ustalenia %". Brak twardego baseline → OSZACUJ punkt startowy z jawnym założeniem w polu baseline (np. "~40h/mies. (szacunek; zakładając 8 przestojów × 5h)") i target liczbowo. Cele i baseline ZAWSZE liczbowe z jednostką.`,
  raid: `WYMÓG FORMUŁY: min 2×RISK + 1×ASSUMPTION + 1×DEPENDENCY. Każde RISK ma probability ORAZ impact ORAZ mitigation (+contingency). Każdy element ma proposedAction z konkretem. Bez generycznych placeholderów — wszystko ugruntowane w kontekście inicjatywy.`,
  financialAnalysis: `WYMÓG FORMUŁY (sizing): podaj rząd wielkości + JAWNE ZAŁOŻENIE + horyzont oraz ROI (krotność lub %) z logiką. Enabler → wartość pośrednia + proxy. Oznacz jako szacunki AI do walidacji. ⛔ ZAKAZ "do ustalenia"/"do określenia" w kwotach i ROI — zawsze liczbowy szacunek z założeniem (zakotwicz w danych finansowych org, jeśli są). Bez "przyniesie miliony" bez założeń.`,
  financialImpact: `WYMÓG FORMUŁY: revenueImpact/costSavings z rzędem wielkości + JAWNYM ZAŁOŻENIEM; benefitsRealization z horyzontem (kiedy i jak korzyści się zmaterializują). ⛔ ZAKAZ "do ustalenia"/"do określenia PLN"/"o do ustalenia %" — KAŻDA kwota/ROI to szacunek liczbowy z założeniem. Jeśli dane finansowe org są w kontekście, ZAKOTWICZ szacunek jako % przychodu/kosztów/EBITDA i wskaż tę bazę.
⛔ ROI POLICZONY (obowiązkowo): wypełnij pole "expectedRoi" JEDNĄ jawną liczbą POLICZONĄ z Twojego revenueImpact/costSavings i nakładu (estimatedBudget), w formacie "[X]%" lub "[N]×" + payback w mies. — NIGDY nie zostawiaj pustego, skoro podałeś przychód i koszt. Przykład: revenue 500k PLN/rok, nakład 400k PLN → "expectedRoi":"25% (zysk netto 100k ÷ nakład 400k), payback ~10 mies.". "estimatedBudget" = JEDNA kwota PLN z jednostką i skalą (np. "400 tys. PLN"), nie "~400k" w prozie. Trzymaj JEDNĄ wartość każdej metryki (revenue, koszt, ROI) w całej karcie — bez sprzecznych liczb.`,
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
 * CODE-LEVEL FALLBACK PROMPTS for the 6 CORE section keys (camelCase).
 *
 * Why this exists: the DB-seeded `ai_prompt_template` is the source of truth, but
 * if the seed migration (20260628_initiative_core_section_prompts / 542) did NOT
 * run — or a row exists with a NULL template (the exact `finding_section_prompt_
 * key_mismatch` snake-vs-camel trap) — then EVERY core card threw
 * "AI prompt template is not configured" and the whole full-fill came back empty
 * (the "cicho pada" demo bug). Rather than depend on migration state at runtime,
 * we fall back to these built-in templates so the card ALWAYS generates.
 *
 * The JSON shapes are IDENTICAL to migration 20260628 so typed-column hydration
 * (cardColumnHydration R3) keeps working (symptom→problem_statement,
 * inScope/outOfScope/killCriteria→scope_*, successCriteria/deliverables, etc.).
 */
const CORE_FALLBACK_PROMPTS: Record<string, string> = {
  problemDefinition: `You are a strategic consultant. Analyze the initiative and generate a structured problem definition.

Context:
- Initiative name: {{initiativeName}}
- Current description: {{summary}}

Generate a structured JSON response with:
{
  "symptom": "Observable symptoms of the problem (2-3 sentences)",
  "rootCause": "Root cause analysis (2-3 sentences)",
  "costOfInaction": "What happens if we do nothing (2-3 sentences)"
}

Language: {{language}}
Respond in the requested language only. Return valid JSON only.`,
  targetState: `You are a strategic consultant. Define the target state for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Current description: {{summary}}

Generate a structured JSON response with:
{
  "targetDescription": "Vision of the desired end state (2-3 sentences)",
  "successCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
  "deliverables": ["Deliverable 1", "Deliverable 2", "Deliverable 3"]
}

Language: {{language}}
Return valid JSON only.`,
  kpis: `You are a performance management consultant. Propose measurable KPIs for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}

Generate a structured JSON response with:
{
  "kpis": [
    { "name": "KPI name", "unit": "unit of measure", "baseline": "numeric current value or estimate with assumption", "target": "numeric target value" }
  ]
}
Provide 2-4 KPIs that are measurable conditions of success, not tasks.
Every baseline and target MUST be a number with a unit. If the real baseline is unknown, ESTIMATE a starting point and state the assumption inline (e.g. "~40h/mo (estimate; assuming X)"). NEVER write "to be determined"/"TBD"/"do ustalenia" as a baseline or target.
Language: {{language}}
Return valid JSON only.`,
  scope: `You are a strategic consultant. Define the scope boundaries for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Description: {{summary}}

Generate a structured JSON response with:
{
  "inScope": ["What is explicitly in scope (3-5 concrete items)"],
  "outOfScope": ["What is explicitly excluded (2-4 items)"],
  "killCriteria": ["Conditions under which the initiative should be stopped (1-3 items)"]
}

Language: {{language}}
Return valid JSON only.`,
  control: `You are a PMO governance consultant. Recommend the control and ownership setup for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Status: {{status}}

Generate a structured JSON response with:
{
  "recommendedOwner": "Profile of the ideal business owner (role, not a person name)",
  "governanceCadence": "Suggested review cadence and forum",
  "escalationTrigger": "Conditions that should trigger escalation"
}

Language: {{language}}
Return valid JSON only.`,
  financialImpact: `You are a business analyst. Estimate the financial impact of this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- KPIs: {{kpis}}

Provide P&L impact estimates as JSON. Put a NUMBER + unit for ROI and budget so they are machine-readable (e.g. "expectedRoi": "285%", "estimatedBudget": "1.2M PLN"):
{
  "revenueImpact": "Numeric revenue impact estimate with an explicit assumption (currency + horizon)",
  "costSavings": "Numeric cost-savings estimate with an explicit assumption (currency + horizon)",
  "benefitsRealization": "How and when benefits will be realized (include payback horizon if known)",
  "expectedRoi": "ROI COMPUTED from your own revenue/savings and budget above, as a single number + unit + payback (e.g. "25% (net gain 100k / investment 400k), payback ~10 months"). MANDATORY when you gave revenue and cost — never leave empty.",
  "estimatedBudget": "Total investment as ONE explicit amount with unit and scale (e.g. "400k PLN"), not a fuzzy "~400k" in prose."
}
Every amount MUST be a number with an assumption (e.g. "~120k PLN/yr (estimate; assuming 2% of operating cost)"). If org financials are available, anchor to them. NEVER write "to be determined"/"TBD"/"do ustalenia" as an amount.
COMPUTE expectedRoi from revenueImpact/costSavings and estimatedBudget — do not leave it blank when both are present. Use EXACTLY ONE value per metric (revenue, cost, ROI) across the whole card — no conflicting numbers for the same quantity.
Language: {{language}}
Return valid JSON only.`,
  // FIX 1a (naprawa-r4Struct): raid is now a CORE section (see
  // initiativeGeneratorBrain CORE_SECTION_KEYS) so it needs a built-in fallback —
  // otherwise a NULL DB ai_prompt_template would throw 503 and leave key_risks null.
  // JSON shape matches buildRiskLines() in cardColumnHydration: risks[] with
  // {type,risk,mitigation}. type:"risk" so the hydrator keeps it (assumptions/
  // dependencies are filtered out of key_risks by design).
  raid: `You are a PMO risk consultant. Build the RAID risk register for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Description: {{summary}}

Generate a structured JSON response with at least 2 RISK items, each grounded in the initiative context (no generic placeholders):
{
  "risks": [
    { "type": "risk", "risk": "Concrete risk (1 sentence)", "probability": "low|medium|high", "impact": "low|medium|high", "mitigation": "Preventive action", "contingency": "Plan B if it happens" }
  ]
}
Language: {{language}}
Return valid JSON only.`,
};

/** Fallback template for a core section when the DB template is missing/NULL. */
export function getCoreFallbackPrompt(sectionKey: string): string | null {
  return CORE_FALLBACK_PROMPTS[sectionKey] || null;
}

/**
 * Build a human-readable evidence/grounding block from the enriched context so the
 * model cites real data instead of inventing it (CARD_CONTENT_FORMULA §A8).
 * Returns null when there is nothing concrete to ground in.
 */
export function buildGroundingBlock(context: GenerationContext): string | null {
  const lines: string[] = [];
  if (context.orgContext)
    lines.push(`Kontekst organizacji: ${String(context.orgContext).slice(0, 800)}`);
  if (context.summary)
    lines.push(`Streszczenie inicjatywy: ${String(context.summary).slice(0, 800)}`);
  if (context.problemStatement)
    lines.push(`Problem: ${String(context.problemStatement).slice(0, 800)}`);
  if (context.sourceLineage) lines.push(`Pochodzenie (lineage): ${context.sourceLineage}`);
  if (context.existingKpis) lines.push(`Istniejące KPI: ${context.existingKpis}`);
  if (context.financialsSummary)
    lines.push(`Dane finansowe org: ${String(context.financialsSummary).slice(0, 800)}`);
  if (context.portfolioSummary)
    lines.push(
      `Istniejące inicjatywy w organizacji (NIE duplikuj; dopasuj do luk): ${String(context.portfolioSummary).slice(0, 1000)}`
    );
  if (context.category) lines.push(`Kategoria: ${context.category}`);
  if (context.module) lines.push(`Obszar/moduł: ${context.module}`);
  // §6 downstream Insight seeds (#57/Z60) — inherited, not guessed: when the
  // source Insight already computed an owner role or baseline→target, USE it
  // directly instead of estimating a fresh one from nothing.
  if (context.seedOwnerRole)
    lines.push(
      `Zalążek właściciela z Insightu (UŻYJ WPROST zamiast proponować inną rolę): ${context.seedOwnerRole}`
    );
  if (context.seedKpiSeeds)
    lines.push(
      `Zalążki KPI z Insightu — metric (baseline → target, horyzont), UŻYJ WPROST zamiast szacować od zera: ${context.seedKpiSeeds}`
    );
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
      return {
        content,
        isJson: false,
        parsedContent: undefined,
        tokensUsed: 0,
        model: 'placeholder',
      };
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

    // CORE-CARD RESILIENCE: for the 6 core sections, a missing section-type row OR
    // a NULL ai_prompt_template (the snake-vs-camel migration trap) must NOT kill
    // the card — fall back to the built-in template so full-fill always produces
    // content. Non-core sections keep the strict behavior (honest 503).
    const coreFallback = getCoreFallbackPrompt(sectionKey);

    if (!sectionType) {
      if (coreFallback) {
        logger.warn(
          `[InitiativeGeneration] section type "${sectionKey}" not found — using built-in core fallback prompt`
        );
      } else {
        throw new Error(`Section type "${sectionKey}" not found`);
      }
    }

    let promptTemplate = sectionType?.aiPromptTemplate;
    if (!promptTemplate) {
      if (coreFallback) {
        if (sectionType) {
          logger.warn(
            `[InitiativeGeneration] ai_prompt_template NULL for core section "${sectionKey}" — using built-in fallback (check migration 20260628/542)`
          );
        }
        promptTemplate = coreFallback;
      } else {
        throw new AppError(
          `AI prompt template is not configured for section "${sectionKey}"`,
          503,
          'FEATURE_UNAVAILABLE'
        );
      }
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
      userPrompt += `\n\n--- DOWODY DOSTĘPNE DO UGRUNTOWANIA (nie zmyślaj faktów poza nie; brak twardej liczby → SZACUNEK z jawnym założeniem, NIGDY "do ustalenia") ---\n${grounding}`;
    }

    // 4. Call LLM with the McKinsey-grade doctrine system prompt.
    const lang = String(enrichedContext.language || context.language || 'en').toLowerCase();
    const isPolish = lang === 'pl' || lang === 'polish';
    const systemPrompt =
      (isPolish ? DOCTRINE_SYSTEM_PROMPT : DOCTRINE_SYSTEM_PROMPT_EN) + buildTemporalRule(isPolish);

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
    const sectionLabel = options?.sectionName
      ? `${options.sectionName} (${sectionKey})`
      : sectionKey;
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
            financialsSummary = await buildOrgFinancialsSummary(
              this.db,
              initiative.organization_id
            );
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
              const parts = [org.name, org.industry ? `branża: ${org.industry}` : ''].filter(
                Boolean
              );
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
      return {
        cardSpec: null,
        issues: [],
        ok: false,
        regenerated: false,
        tokensUsed: 0,
        model: 'placeholder',
      };
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
  const base = isPolish
    ? `Jesteś konsultantem klasy McKinsey (docs/standards/CARD_CONTENT_FORMULA.md, docs/initiatives/INITIATIVE_FORMULA.md). Komponujesz KARTĘ inicjatywy jako listę deklaratywnych BLOKÓW (grammar), nie wolny tekst. Zwracasz WYŁĄCZNIE poprawny JSON — bez markdown, bez code-fence, bez komentarza.
SPÓJNOŚĆ: każda metryka (CAC/ARR/wzrost %/koszt/ROI) = DOKŁADNIE JEDNA wartość lub przedział w całej karcie — bez sprzecznych liczb tej samej wielkości. ROI POLICZONY: masz przychód i koszt → policz ROI jawnie (% = zysk netto ÷ nakład) + payback; budżet jako jedna kwota z jednostką. GROUNDING: kotwic rynkowych (TAM/udziały/benchmarki) bez źródła NIE fabrykuj — oznacz "szacunek własny, do uźródłowienia" lub pomiń; zakaz "według Gartnera" bez pewności.`
    : `You are a McKinsey-grade consultant (per docs/standards/CARD_CONTENT_FORMULA.md and docs/initiatives/INITIATIVE_FORMULA.md). You compose an initiative CARD as a list of declarative BLOCKS (a grammar), not free prose. Return ONLY valid JSON — no markdown, no code fences, no commentary.
CONSISTENCY: each metric (CAC/ARR/growth %/cost/ROI) = EXACTLY ONE value or range across the whole card — no conflicting numbers for the same quantity. COMPUTED ROI: if you have revenue and cost → compute ROI explicitly (% = net gain ÷ investment) + payback; budget as one amount with unit. GROUNDING: do NOT fabricate market anchors (TAM/share/benchmarks) without a source — mark "own estimate, to be sourced" or omit; no "according to Gartner" without certainty.`;
  return base + buildTemporalRule(isPolish);
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
 * looks for `createInitiative` on this module; `generate_initiative` (the Teresa
 * chat tool, ai/tools/generateInitiative.ts) calls it too. Previously no such
 * export existed (the module only default-exports a generation class), so the
 * handoff silently fell back to a synthetic UUID (`real_entity:false`).
 *
 * ZWORNIK DELTA C WIRING (2026-07-11): this was the last AI-facing entry point
 * that still bypassed the project-anchoring gate — it called
 * `initiativeService.createInitiative` (InitiativeDefinitionService), whose raw
 * INSERT path only anchors a project when the UNRELATED, org-wide
 * `INITIATIVE_FUNNEL_ENABLED` flag is 'true' (default OFF everywhere; confirmed
 * by grep — no env file sets it). With that flag off, EVERY caller through this
 * function persisted `project_id = NULL`, i.e. AI creating orphans faster than a
 * human could (audit finding, panel adwersaryjny bloker #5 follow-up).
 *
 * Fix: route through the SAME canonical funnel the wizard and candidate-accept
 * use (createInitiativeService.ts) instead. That funnel already:
 *   - auto-anchors to the org's system "Portfel — inicjatywy bezpośrednie"
 *     project when REQUIRE_INITIATIVE_PROJECT is ON (default ON per code, but
 *     may be pinned 'false' per-env) and no projectId was supplied — the
 *     fail-soft, non-interactive posture background/AI callers need (§5.2.3);
 *   - is a no-op on project_id when the policy is OFF (project_id stays
 *     whatever was resolved, possibly null) — i.e. log-only shadow, ZERO
 *     blocking, exactly the posture requested for this rollout.
 * Additive on top of that:
 *   - project INHERITANCE from the source artifact (assessment/audit carry a
 *     real project_id; interview_insight/manual do not, so they correctly fall
 *     through to the funnel's system-Portfel auto-anchor) — sourceProjectResolver.ts;
 *   - cross-record de-dup (title-similarity vs. ACTIVE initiatives in the org,
 *     reusing initiativeCandidateService's findDuplicateInitiative) — ADVISORY
 *     only: the initiative is still created, `possibleDuplicate`/
 *     `duplicateOfInitiativeId` are returned for the caller to surface, per
 *     spec ("flaga możliwy duplikat, nie twardy blok").
 *
 * Lineage default: existing callers (teresaCopilotService, generate_initiative
 * tool) never passed sourceType/sourceId here — they stamp lineage themselves
 * via a POST-create UPDATE (see generateInitiative.ts's `stampLineage`). To
 * avoid a behaviour change/throw (the funnel's lineage guard requires a
 * sourceId whenever sourceType !== 'manual'), sourceType only becomes
 * non-'manual' when the CALLER explicitly supplies BOTH sourceType and
 * sourceId (e.g. a future caller that already knows it came from an
 * assessment/audit and wants project inheritance to kick in immediately).
 */
export async function createInitiative(params: {
  organizationId: string;
  title?: unknown;
  description?: unknown;
  source?: string;
  proposalId?: string;
  /** Explicit anchor — wins over source-based inheritance when provided. */
  projectId?: string | null;
  /** Only honoured together with sourceId (lineage guard) — see doc comment above. */
  sourceType?: string;
  sourceId?: string;
}): Promise<{
  id: string;
  projectId: string | null;
  possibleDuplicate: boolean;
  duplicateOfInitiativeId: string | null;
}> {
  const orgId = String(params.organizationId || '');
  const title = String(params.title || 'Teresa initiative').slice(0, 500);

  // Lineage: only trust sourceType/sourceId when BOTH are present (see doc
  // comment) — otherwise default to 'manual' so the funnel's lineage guard
  // never throws for the two existing callers, which stamp lineage themselves.
  const hasExplicitSource = Boolean(params.sourceType && params.sourceId);
  const sourceType = hasExplicitSource ? String(params.sourceType) : 'manual';
  const sourceId = hasExplicitSource ? String(params.sourceId) : null;

  // Zwornik project inheritance — explicit projectId wins; otherwise try to
  // inherit from the source artifact (assessment/audit only); null falls
  // through to the funnel's own system-Portfel auto-anchor.
  let projectId: string | null = params.projectId ?? null;
  if (!projectId) {
    try {
      projectId = await resolveProjectIdFromSource(orgId, sourceType, sourceId);
    } catch {
      projectId = null;
    }
  }

  // Cross-record de-dup (advisory) — BEFORE creating, look for an ACTIVE
  // initiative with a near-identical title in this org. Never blocks: the
  // DRAFT is created either way, the caller decides what to do with the flag.
  let possibleDuplicate = false;
  let duplicateOfInitiativeId: string | null = null;
  try {
    const dup = await findDuplicateInitiative(
      {
        queryAll: (sql, p) => queryHelpers.queryAll(sql, p),
        queryOne: (sql, p) => queryHelpers.queryOne(sql, p),
        queryRun: (sql, p) => queryHelpers.queryRun(sql, p),
      },
      orgId,
      title
    );
    if (dup) {
      possibleDuplicate = true;
      duplicateOfInitiativeId = dup.id;
    }
  } catch {
    // advisory only — a lookup failure must never block creation
  }

  // Shadow-log the policy decision regardless of outcome (log-only when
  // REQUIRE_INITIATIVE_PROJECT is OFF — zero blocking either way).
  logger.info(
    `[InitiativeGeneration][zwornik] org=${orgId} requireProject=${isRequireInitiativeProjectEnabled()} ` +
      `resolvedProjectId=${projectId ?? 'null'} possibleDuplicate=${possibleDuplicate}` +
      (duplicateOfInitiativeId ? ` duplicateOf=${duplicateOfInitiativeId}` : '')
  );

  const created = await funnelCreateInitiative(
    orgId,
    {
      title,
      summary: params.description != null ? String(params.description) : null,
      projectId,
      sourceType,
      sourceId,
      // status DRAFT intentionally OMITTED — the funnel normalizes it (F1.11).
    },
    { validate: false }
  );

  return {
    id: String(created?.id || ''),
    projectId: created?.projectId ?? projectId,
    possibleDuplicate,
    duplicateOfInitiativeId,
  };
}
