/**
 * initiativeSectionFill — AI „uzupełnij" dla sekcji inicjatywy BEZ dotychczasowego
 * wsparcia AI (decyzja właściciela 2026-07-19, K4: AI-uzupełnienie UNIWERSALNIE na
 * KAŻDEJ sekcji inicjatywy).
 *
 * Sekcje z AI mają już `initiativeGenerationService.generateSectionContent`
 * (scope/kpi/financial/resources/risk/decisions/gates/success). Ten serwis DOMYKA
 * lukę dla pozostałych 10 sekcji z kanonu
 * (docs/ui-standards/02-components/initiative-sections.md):
 *   team · raci · dependencies · milestones · timeline · technical(-spec) ·
 *   tasks · attachments(-links) · comments · activity(-log).
 *
 * WZORZEC 1:1 = `services/taskSectionGenerationService.ts`:
 *   - prompty jako STAŁE w kodzie (te sekcje NIE mają `ai_prompt_template` w DB),
 *   - SYSTEM prompt = doktryna BCG (answer-first / MECE / kwantyfikacja / zero fillera),
 *   - USER prompt per sekcja interpolowany kontekstem inicjatywy,
 *   - klient AI = ten sam `ai/llmService.js`, tier 'premium', bez hardkodu providera,
 *   - advisory quality flag z `cardContentValidator` (nigdy nie blokuje).
 *
 * ⚠ PROMPTY ZMIENIAJĄ OUTPUT KLIENTA → wymagają weryfikacji Piotra przed live.
 *     Wywołanie jest za flagą `INITIATIVE_SECTION_AIFILL` (default OFF) w routerze.
 *
 * @see server/src/services/taskSectionGenerationService.ts (wzór 1:1)
 * @see server/src/services/initiativeGenerationService.ts (wzór wywołania LLM + doktryna)
 */

import { type CardContentValidationResult, validateCardContent } from '../cardContentValidator.js';
import logger from '../../utils/Logger.js';

// ── Klucze sekcji (kanoniczne + aliasy z frontendu) ──────────────────────────

export type InitiativeFillSectionKey =
  | 'team'
  | 'raci'
  | 'dependencies'
  | 'milestones'
  | 'timeline'
  | 'technical'
  | 'tasks'
  | 'attachments'
  | 'comments'
  | 'activity';

/**
 * Normalizuje warianty kluczy używane przez frontend (tab id, snake/kebab/camel)
 * do kanonicznego klucza sekcji. Zwraca `null` gdy sekcja nie jest obsługiwana
 * przez TEN serwis (wtedy caller powinien użyć `generateSectionContent`).
 */
export function normalizeFillSectionKey(raw: string): InitiativeFillSectionKey | null {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
  switch (k) {
    case 'team':
    case 'team-staffing':
      return 'team';
    case 'raci':
    case 'raci-escalation':
    case 'racieescalation':
      return 'raci';
    case 'dependencies':
    case 'dependency':
      return 'dependencies';
    case 'milestones':
    case 'milestone':
      return 'milestones';
    case 'timeline':
    case 'schedule':
      return 'timeline';
    case 'technical':
    case 'technical-spec':
    case 'technical-specification':
    case 'technicalspecification':
    case 'tech-spec':
      return 'technical';
    case 'tasks':
    case 'task':
    case 'plan':
      return 'tasks';
    case 'attachments':
    case 'attachments-links':
    case 'attachments-and-links':
    case 'attachment':
      return 'attachments';
    case 'comments':
    case 'discussion':
      return 'comments';
    case 'activity':
    case 'activity-log':
    case 'activitylog':
      return 'activity';
    default:
      return null;
  }
}

// ── Kontekst inicjatywy ──────────────────────────────────────────────────────

export interface InitiativeFillContext {
  initiativeId?: string | null;
  initiativeName?: string | null;
  summary?: string | null;
  problemStatement?: string | null;
  category?: string | null;
  module?: string | null;
  status?: string | null;
  /** Zakres (in/out) jeśli znany — pomaga fazowaniu i podziałowi zadań. */
  scope?: string | null;
  /** KPI/kryteria sukcesu jeśli znane — pomaga milestones/timeline/tasks. */
  kpis?: string | null;
  /**
   * Istniejące pozycje sekcji (proza/JSON), by AI UZUPEŁNIŁO, a nie duplikowało.
   * Dla comments/activity: treść dotychczasowych wpisów DO STRESZCZENIA.
   */
  existingItems?: string | null;
  /** Skrótowy kontekst powiązanych zadań (tytuły) — dla milestones/timeline/dependencies. */
  relatedTasks?: string | null;
  /** Skrótowy kontekst zespołu (role/osoby) — dla raci/team. */
  teamContext?: string | null;
}

interface GenerateOptions {
  language?: 'pl' | 'en' | string;
}

export interface InitiativeFillResult {
  /** Surowa treść modelu (proza lub JSON string). */
  content: string;
  /** Sparsowany JSON (gdy prompt wymaga JSON i parsowanie się powiodło). */
  parsedContent?: unknown;
  isJson: boolean;
  sectionKey: InitiativeFillSectionKey;
  model: string;
  tokensUsed: number;
  /**
   * Advisory-only quality flag (BCG §0 heuristics). `pass: false` = output
   * WYGLĄDA słabo — sygnał do logu/review, NIGDY powód do odrzucenia/retry.
   */
  qualityFlags?: CardContentValidationResult;
}

// ── Doktryna BCG (SYSTEM prompt) — spójna z taskSectionGenerationService ──────

export const INITIATIVE_FILL_SYSTEM_PROMPT_PL = `Jesteś konsultantem klasy BCG uzupełniającym sekcję karty INICJATYWY w systemie doradczym.
Reguły twarde (FAIL jeśli złamane):
1. Answer-first / Pyramid Principle — najpierw wniosek/rezultat, potem szczegóły. Bez rozgrzewki.
2. MECE — listy wzajemnie wykluczające się i wyczerpujące; brak nakładania.
3. Kwantyfikacja z jawnym założeniem — każda liczba ma źródło LUB oznaczenie „szacunek: [założenie]".
4. Ugruntowanie — opieraj się TYLKO na dostępnym kontekście inicjatywy. Nie halucynuj faktów o firmie.
5. Zero fillera — bez ozdobników. Każde zdanie niesie informację.
6. Falsyfikowalność — kryteria/kamienie milowe testowalne i datowalne.
7. Uczciwość niepewności — gdy brak danych, powiedz to wprost + co trzeba zbadać.
8. Przyszłe daty — WSZYSTKIE daty/kwartały/kamienie milowe MUSZĄ być w PRZYSZŁOŚCI względem dziś. Zakaz dat przeszłych jako terminów planu; użyj horyzontu względnego („w ciągu 6 mies. od startu") gdy brak twardej daty.
9. Język: PISZ PO POLSKU.
10. ZAKAZ PLACEHOLDERÓW-PÓL: NIGDY nie emituj wypełniaczy udających pole do ręcznego uzupełnienia („[DO UZUPEŁNIENIA]", „[imię i nazwisko]", „[wpisz…]"). Osobę podaj rzeczownikowo po roli („właściciel: lider utrzymania ruchu"), a gdy nie znasz — POMIŃ pole, nie twórz pustego.
Anty-wzorce = FAIL: ogólniki bez liczb, listy 1-elementowe tam gdzie wymagane ≥2, „TBD" bez planu, przepisanie tytułu jako treści, placeholder w nawiasach udający pole.
ZAWSZE zwracaj WYŁĄCZNIE poprawny JSON o wymaganym kształcie — bez komentarzy poza JSON.`;

export const INITIATIVE_FILL_SYSTEM_PROMPT_EN = `You are a BCG-grade consultant filling in a section of an INITIATIVE card in an advisory system.
Hard rules (FAIL if broken):
1. Answer-first / Pyramid Principle — conclusion/outcome first, then detail. No warm-up.
2. MECE — mutually exclusive, collectively exhaustive lists; no overlap.
3. Quantify with explicit assumptions — every number has a source OR is tagged "estimate: [assumption]".
4. Grounded — rely ONLY on the provided initiative context. Do not hallucinate company facts.
5. Zero filler — no ornaments. Every sentence carries information.
6. Falsifiable — criteria/milestones must be testable and datable.
7. Honest about uncertainty — when data is missing, say so + what must be investigated.
8. Future dates — ALL dates/quarters/milestones MUST be in the FUTURE relative to today. No past dates as plan deadlines; use a relative horizon ("within 6 months of start") when no hard date exists.
9. Language: WRITE IN ENGLISH.
10. NO FIELD-PLACEHOLDERS: NEVER emit fill-in placeholders posing as a field ("[TO BE FILLED]", "[full name]", "[enter…]"). Name a person by role noun ("owner: maintenance lead"); if unknown — OMIT the field, do not create an empty one.
Anti-patterns = FAIL: vague statements without numbers, 1-item lists where ≥2 required, "TBD" without a plan, restating the title as content, a bracketed placeholder posing as a field.
ALWAYS return ONLY valid JSON of the required shape — no prose outside the JSON.`;

// ── Instrukcje per sekcja (USER prompt) ──────────────────────────────────────

interface SectionPrompt {
  /** Instrukcja karty (interpolowana z kontekstem w USER prompt). */
  instruction: string;
  /** Zawsze JSON dla tych sekcji (kształt jawnie w instrukcji). */
  json: boolean;
}

export const INITIATIVE_FILL_PROMPTS: Record<InitiativeFillSectionKey, SectionPrompt> = {
  // Skład zespołu wykonawczego inicjatywy: role + odpowiedzialność + FTE.
  team: {
    json: true,
    instruction:
      'Zaproponuj SKŁAD ZESPOŁU realizującego tę inicjatywę. Zwróć JSON: ' +
      '{"team": [{"role": "nazwa roli (rzeczownikowo, np. lider projektu / analityk procesów)", ' +
      '"responsibility": "za co odpowiada w tej inicjatywie, 1 zdanie", ' +
      '"fte": "zaangażowanie jako ułamek FTE z założeniem, np. 0.2 (szacunek)", ' +
      '"name": "imię i nazwisko TYLKO jeśli jest w kontekście — inaczej pomiń klucz"}]}. ' +
      'MINIMUM 3 role, MECE (bez nakładania odpowiedzialności). Dobierz role adekwatne do zakresu i modułu inicjatywy. Return valid JSON.',
  },
  // Macierz RACI: aktywność × R/A/C/I.
  raci: {
    json: true,
    instruction:
      'Zbuduj MACIERZ RACI dla kluczowych aktywności tej inicjatywy. Zwróć JSON: ' +
      '{"raci": [{"activity": "aktywność/kamień decyzyjny", ' +
      '"responsible": "rola wykonawcza (R)", "accountable": "JEDNA rola rozliczająca (A)", ' +
      '"consulted": "rola/e konsultowane (C)", "informed": "rola/e informowane (I)"}]}. ' +
      'MINIMUM 3 aktywności. Twarda reguła RACI: dokładnie JEDNA rola Accountable na wiersz. Używaj ról rzeczownikowo (nie placeholderów). Return valid JSON.',
  },
  // Zależności blokujące (co musi być gotowe zanim / od kogo).
  dependencies: {
    json: true,
    instruction:
      'Wypisz ZALEŻNOŚCI tej inicjatywy — co musi być gotowe ZANIM ruszy lub się zakończy. Zwróć JSON: ' +
      '{"dependencies": [{"dependency": "co / od kogo", ' +
      '"type": "internal|external|technical|organizational", ' +
      '"blocks": "co zablokuje jeśli niegotowe, 1 zdanie", ' +
      '"owner": "rola odpowiedzialna — pomiń klucz jeśli nieznana"}]}. ' +
      'Jeśli z kontekstu nie wynikają realne zależności — zwróć {"dependencies": []} (NIE zmyślaj). Return valid JSON.',
  },
  // Kamienie milowe: fazowanie z datami/horyzontem.
  milestones: {
    json: true,
    instruction:
      'Zaproponuj KAMIENIE MILOWE (fazowanie) tej inicjatywy. Zwróć JSON: ' +
      '{"milestones": [{"title": "nazwa kamienia (rezultat, nie czynność)", ' +
      '"targetDate": "data lub horyzont względny w PRZYSZŁOŚCI (np. „+6 tyg. od startu")", ' +
      '"description": "mierzalny warunek osiągnięcia, 1 zdanie"}]}. ' +
      'MINIMUM 3 kamienie, uporządkowane chronologicznie, każdy z falsyfikowalnym warunkiem. WSZYSTKIE terminy w przyszłości. Return valid JSON.',
  },
  // Harmonogram: fazy start/end/cel.
  timeline: {
    json: true,
    instruction:
      'Zaproponuj HARMONOGRAM (fazy) tej inicjatywy. Zwróć JSON: ' +
      '{"phases": [{"phase": "nazwa fazy", ' +
      '"start": "start jako data lub horyzont względny (przyszłość)", ' +
      '"end": "koniec jako data lub horyzont względny (przyszłość)", ' +
      '"goal": "cel fazy — mierzalny rezultat, 1 zdanie"}]}. ' +
      'MINIMUM 3 fazy, następujące po sobie, spójne z kamieniami milowymi i zakresem. WSZYSTKIE daty w przyszłości. Return valid JSON.',
  },
  // Specyfikacja techniczna: architektura/komponenty/integracje/ograniczenia.
  technical: {
    json: true,
    instruction:
      'Naszkicuj SPECYFIKACJĘ TECHNICZNĄ tej inicjatywy. Zwróć JSON: ' +
      '{"technicalSpec": {"architecture": "1-2 zdania answer-first o podejściu/architekturze", ' +
      '"components": ["komponent/moduł 1", "komponent 2", ...], ' +
      '"integrations": ["integracja/system zewnętrzny 1", ...], ' +
      '"constraints": ["ograniczenie/wymóg niefunkcjonalny 1 (np. wydajność, bezpieczeństwo, zgodność)", ...]}}. ' +
      'components ≥3, constraints ≥2. Ugruntuj na module i zakresie inicjatywy; oznacz założenia gdy brak danych. Return valid JSON.',
  },
  // Rozbicie na zadania.
  tasks: {
    json: true,
    instruction:
      'Rozbij tę inicjatywę na ZADANIA wykonawcze. Zwróć JSON: ' +
      '{"tasks": [{"title": "zadanie sformułowane jako REZULTAT (nie ogólnik)", ' +
      '"why": "po co — link do celu/kamienia inicjatywy, 1 zdanie", ' +
      '"expectedOutcome": "mierzalny stan końcowy (liczba+jednostka+kierunek gdy ma sens), 1 zdanie"}]}. ' +
      'MINIMUM 4 zadania, fazowane i konkretne, powiązane z zakresem/kamieniami inicjatywy, MECE. Return valid JSON.',
  },
  // Sugestie dokumentów/załączników.
  attachments: {
    json: true,
    instruction:
      'Zasugeruj DOKUMENTY/ZAŁĄCZNIKI, których ta inicjatywa powinna się dorobić (czego brakuje). Zwróć JSON: ' +
      '{"suggestedDocuments": [{"name": "nazwa dokumentu", ' +
      '"type": "spec|analysis|contract|report|diagram|dataset|other", ' +
      '"purpose": "po co ten dokument dla tej inicjatywy, 1 zdanie"}]}. ' +
      'MINIMUM 3 sugestie, adekwatne do etapu/zakresu, bez duplikowania już istniejących (jeśli podane w kontekście). Return valid JSON.',
  },
  // Podsumowanie dyskusji (komentarzy).
  comments: {
    json: true,
    instruction:
      'PODSUMUJ dotychczasową dyskusję (komentarze) tej inicjatywy dla osoby, która dopiero dołącza. Zwróć JSON: ' +
      '{"summary": "answer-first streszczenie 2-4 zdania: główne ustalenia i otwarte kwestie", ' +
      '"openQuestions": ["nierozstrzygnięta kwestia 1", ...], ' +
      '"decisionsReached": ["ustalenie/decyzja z dyskusji 1", ...]}. ' +
      'Opieraj się TYLKO na treści komentarzy z kontekstu. Gdy brak komentarzy — zwróć {"summary": "Brak dyskusji do podsumowania.", "openQuestions": [], "decisionsReached": []}. Return valid JSON.',
  },
  // Streszczenie przebiegu (dziennik aktywności).
  activity: {
    json: true,
    instruction:
      'STREŚĆ przebieg tej inicjatywy na podstawie dziennika aktywności — co się wydarzyło i jaki jest kierunek. Zwróć JSON: ' +
      '{"summary": "answer-first streszczenie 2-4 zdania: postęp i najważniejsze zmiany", ' +
      '"recentHighlights": ["istotne zdarzenie 1", ...], ' +
      '"momentum": "on-track|at-risk|stalled — z 1-zdaniowym uzasadnieniem"}. ' +
      'Opieraj się TYLKO na wpisach z kontekstu. Gdy brak aktywności — zwróć {"summary": "Brak zarejestrowanej aktywności do streszczenia.", "recentHighlights": [], "momentum": "stalled — brak danych o postępie."}. Return valid JSON.',
  },
};

// ── Interpolacja kontekstu ───────────────────────────────────────────────────

const SECTION_LABEL_PL: Record<InitiativeFillSectionKey, string> = {
  team: 'ZESPÓŁ',
  raci: 'MACIERZ RACI',
  dependencies: 'ZALEŻNOŚCI',
  milestones: 'KAMIENIE MILOWE',
  timeline: 'HARMONOGRAM',
  technical: 'SPECYFIKACJA TECHNICZNA',
  tasks: 'ZADANIA',
  attachments: 'DOKUMENTY / ZAŁĄCZNIKI',
  comments: 'PODSUMOWANIE DYSKUSJI',
  activity: 'STRESZCZENIE PRZEBIEGU',
};

const SECTION_LABEL_EN: Record<InitiativeFillSectionKey, string> = {
  team: 'TEAM',
  raci: 'RACI MATRIX',
  dependencies: 'DEPENDENCIES',
  milestones: 'MILESTONES',
  timeline: 'TIMELINE',
  technical: 'TECHNICAL SPECIFICATION',
  tasks: 'TASKS',
  attachments: 'DOCUMENTS / ATTACHMENTS',
  comments: 'DISCUSSION SUMMARY',
  activity: 'ACTIVITY SUMMARY',
};

function buildUserPrompt(
  sectionKey: InitiativeFillSectionKey,
  ctx: InitiativeFillContext,
  isPolish: boolean
): string {
  const prompt = INITIATIVE_FILL_PROMPTS[sectionKey];
  const label = (isPolish ? SECTION_LABEL_PL : SECTION_LABEL_EN)[sectionKey];

  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;

  const contextLines: string[] = [];
  if (ctx.initiativeName) contextLines.push(`- Inicjatywa: ${ctx.initiativeName}`);
  if (ctx.summary) contextLines.push(`- Streszczenie: ${String(ctx.summary).slice(0, 1200)}`);
  if (ctx.problemStatement)
    contextLines.push(`- Problem: ${String(ctx.problemStatement).slice(0, 800)}`);
  if (ctx.category) contextLines.push(`- Kategoria: ${ctx.category}`);
  if (ctx.module) contextLines.push(`- Moduł: ${ctx.module}`);
  if (ctx.status) contextLines.push(`- Status: ${ctx.status}`);
  if (ctx.scope) contextLines.push(`- Zakres: ${String(ctx.scope).slice(0, 800)}`);
  if (ctx.kpis) contextLines.push(`- KPI/kryteria sukcesu: ${String(ctx.kpis).slice(0, 800)}`);
  if (ctx.teamContext) contextLines.push(`- Zespół (kontekst): ${String(ctx.teamContext).slice(0, 800)}`);
  if (ctx.relatedTasks)
    contextLines.push(`- Powiązane zadania: ${String(ctx.relatedTasks).slice(0, 1200)}`);
  if (ctx.existingItems)
    contextLines.push(
      `- ${sectionKey === 'comments' || sectionKey === 'activity' ? 'Wpisy do streszczenia' : 'Istniejące pozycje (uzupełnij, nie duplikuj)'}: ${String(ctx.existingItems).slice(0, 4000)}`
    );

  const contextBlock =
    contextLines.length > 0
      ? contextLines.join('\n')
      : isPolish
        ? '(brak dodatkowego kontekstu — oprzyj się na nazwie inicjatywy i typie sekcji)'
        : '(no extra context — rely on the initiative name and section type)';

  const timeRule = isPolish
    ? `⏱ DZIŚ: Q${q} ${year}. WSZYSTKIE daty/terminy MUSZĄ być ${year} lub później.`
    : `⏱ TODAY: Q${q} ${year}. ALL dates/deadlines MUST be ${year} or later.`;

  return [
    `${isPolish ? 'Sekcja' : 'Section'}: ${label}`,
    timeRule,
    '',
    `${isPolish ? '--- KONTEKST INICJATYWY ---' : '--- INITIATIVE CONTEXT ---'}`,
    contextBlock,
    '',
    `${isPolish ? '--- INSTRUKCJA SEKCJI ---' : '--- SECTION INSTRUCTION ---'}`,
    prompt.instruction,
  ].join('\n');
}

// ── LLM instance (memoized, fail-soft) — jak taskSectionGenerationService ─────

let _llmInstance: any = null;
async function getLLM(): Promise<any> {
  if (_llmInstance) return _llmInstance;
  try {
    const mod = await import('./llmService.js');
    _llmInstance = (mod as any).llmService || (mod as any).default;
    return _llmInstance;
  } catch (err) {
    logger.warn('[InitiativeSectionFill] LLM Service not available');
    return null;
  }
}

/** Test seam — reset memoized LLM instance. */
export function __resetInitiativeFillLlmForTests(): void {
  _llmInstance = null;
}

// ── Główna funkcja ───────────────────────────────────────────────────────────

/**
 * Generuje treść „uzupełnij AI" jednej sekcji inicjatywy (spośród 10 bez natywnego AI).
 * Fail-soft: rzuca tylko gdy klucz nieznany, LLM nieskonfigurowany lub call padnie —
 * router mapuje to na uczciwy błąd (503 → notConfigured / 500 → fail-closed).
 */
export async function generateInitiativeSectionFill(
  sectionKeyRaw: string,
  ctx: InitiativeFillContext,
  options: GenerateOptions = {}
): Promise<InitiativeFillResult> {
  const sectionKey = normalizeFillSectionKey(sectionKeyRaw);
  if (!sectionKey) {
    throw new Error(`Unsupported initiative fill section: ${sectionKeyRaw}`);
  }

  const lang = String(options.language || 'en').toLowerCase();
  const isPolish = lang === 'pl' || lang === 'polish';
  const systemPrompt = isPolish
    ? INITIATIVE_FILL_SYSTEM_PROMPT_PL
    : INITIATIVE_FILL_SYSTEM_PROMPT_EN;
  const userPrompt = buildUserPrompt(sectionKey, ctx, isPolish);

  const llm = await getLLM();
  if (!llm || typeof llm.call !== 'function') {
    const err: any = new Error('AI service is not configured');
    err.statusCode = 503;
    err.code = 'FEATURE_UNAVAILABLE';
    throw err;
  }

  const result = await llm.call({
    type: 'text',
    modelConfig: { id: 'premium' },
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1800,
    temperature: 0.4,
    cache: true,
    cacheTtl: 3600,
    timeoutMs: 90000,
  });

  const content = String(result?.content || '');
  const usage = (result?.usage || {}) as Record<string, number>;
  const tokensUsed = usage.totalTokens || usage.completionTokens || Math.floor(content.length / 4);
  const model = String(result?.model || result?.modelId || 'llm-premium');

  let parsedContent: unknown;
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
    parsedContent = JSON.parse((jsonMatch[1] as string) || content);
  } catch {
    parsedContent = undefined;
  }

  // Advisory quality flag (BCG §0). Nigdy nie blokuje — tylko log dla widoczności
  // słabych sekcji. Klucze tych sekcji nie mają twardych wymogów w validatorze,
  // więc heurystyka jest miękka (placeholdery/filler wciąż łapane globalnie).
  let qualityFlags: CardContentValidationResult | undefined;
  try {
    qualityFlags = validateCardContent(sectionKey, parsedContent ?? content);
    if (!qualityFlags.pass) {
      logger.warn('[InitiativeSectionFill] quality flags on generated section', {
        sectionKey,
        violations: qualityFlags.violations,
      });
    }
  } catch {
    logger.warn('[InitiativeSectionFill] cardContentValidator threw, skipping', { sectionKey });
  }

  return {
    content,
    parsedContent,
    isJson: true,
    sectionKey,
    model,
    tokensUsed,
    qualityFlags,
  };
}

export default {
  generateInitiativeSectionFill,
  normalizeFillSectionKey,
  INITIATIVE_FILL_PROMPTS,
};
