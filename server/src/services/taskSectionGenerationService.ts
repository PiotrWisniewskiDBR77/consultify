/**
 * taskSectionGenerationService — AI generacja treści kart Task (wzorzec N)
 *
 * NIE MA tabeli `task_section_types` z `ai_prompt_template` (zweryfikowane:
 * grep migracji — brak). Dlatego prompty trzymamy jako STAŁE w kodzie
 * (`TASK_SECTION_PROMPTS`), z treścią wg:
 *   - doktryna BCG §0  → SYSTEM prompt (TASK_DOCTRINE_SYSTEM_PROMPT / _EN)
 *   - instrukcja per karta §3 → USER prompt per sekcja
 *   (Harvard/wdrozenie-100/_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md)
 *
 * ⚠ PROMPTY ZMIENIAJĄ OUTPUT KLIENTA → wymagają weryfikacji Piotra przed live.
 *
 * Klient AI = ten sam co initiativeGenerationService (`ai/llmService.js`,
 * tier 'premium'), bez hardkodowania providera/klucza.
 *
 * @see server/src/services/initiativeGenerationService.ts (wzór wywołania LLM)
 * @see Harvard/wdrozenie-100/_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §10 (jakość=prompt)
 */

import logger from '../utils/Logger.js';
import { validateCardContent, type CardContentValidationResult } from './cardContentValidator.js';

export type TaskSectionKey = 'strategy' | 'execution' | 'evidence' | 'dependencies';

interface TaskContext {
  title?: string | null;
  description?: string | null;
  why?: string | null;
  expectedOutcome?: string | null;
  taskType?: string | null;
  priority?: string | null;
  status?: string | null;
  initiativeName?: string | null;
  initiativeContext?: string | null;
}

interface GenerateOptions {
  language?: 'pl' | 'en' | string;
}

export interface TaskSectionResult {
  /** Surowa treść modelu (proza lub JSON string). */
  content: string;
  /** Sparsowany JSON (gdy prompt wymaga JSON i parsowanie się powiodło). */
  parsedContent?: unknown;
  isJson: boolean;
  model: string;
  tokensUsed: number;
  /**
   * Advisory-only quality flag from `cardContentValidator` (BCG §0 heuristics).
   * `pass: false` means the output LOOKS weak (thin list, filler, bare number,
   * etc.) — it is a signal for logging/review, never a reason to reject or
   * retry automatically. Callers may surface this to the UI as a soft warning.
   */
  qualityFlags?: CardContentValidationResult;
}

// ── Doktryna BCG (§0) — SYSTEM prompt ────────────────────────────────────────

export const TASK_DOCTRINE_SYSTEM_PROMPT = `Jesteś konsultantem klasy BCG piszącym treść karty zadania (Task) w systemie doradczym.
Reguły twarde (FAIL jeśli złamane):
1. Answer-first / Pyramid Principle — najpierw wniosek/rezultat, potem szczegóły. Bez rozgrzewki.
2. MECE — listy wzajemnie wykluczające się i wyczerpujące; brak nakładania.
3. Kwantyfikacja z jawnym założeniem — każda liczba ma źródło LUB oznaczenie „szacunek: [założenie]".
4. Ugruntowanie — opieraj się TYLKO na dostępnym kontekście zadania i inicjatywy. Nie halucynuj faktów o firmie.
5. Zero fillera — bez ozdobników. Każde zdanie niesie informację.
6. Falsyfikowalność — kryteria akceptacji testowalne („zrobione, gdy X mierzalnie osiągnięte").
7. Uczciwość niepewności — gdy brak danych, powiedz to wprost + co trzeba zbadać.
8. Język: PISZ PO POLSKU.
Anty-wzorce = FAIL: ogólniki bez liczb, listy 1-elementowe tam gdzie wymagane ≥3, „TBD" bez planu, przepisanie tytułu jako treści.`;

export const TASK_DOCTRINE_SYSTEM_PROMPT_EN = `You are a BCG-grade consultant writing the content of a Task card in an advisory system.
Hard rules (FAIL if broken):
1. Answer-first / Pyramid Principle — conclusion/outcome first, then detail. No warm-up.
2. MECE — mutually exclusive, collectively exhaustive lists; no overlap.
3. Quantify with explicit assumptions — every number has a source OR is tagged "estimate: [assumption]".
4. Grounded — rely ONLY on the provided task/initiative context. Do not hallucinate company facts.
5. Zero filler — no ornaments. Every sentence carries information.
6. Falsifiable — acceptance criteria must be testable ("done when X is measurably achieved").
7. Honest about uncertainty — when data is missing, say so + what must be investigated.
8. Language: WRITE IN ENGLISH.
Anti-patterns = FAIL: vague statements without numbers, 1-item lists where ≥3 required, "TBD" without a plan, restating the title as content.`;

// ── Instrukcje per karta (§3 BCG) — USER prompt ──────────────────────────────

interface SectionPrompt {
  /** Instrukcja karty (interpolowana z kontekstem w USER prompt). */
  instruction: string;
  /** Czy oczekujemy JSON na wyjściu. */
  json: boolean;
}

export const TASK_SECTION_PROMPTS: Record<TaskSectionKey, SectionPrompt> = {
  // §3: „Strategy (why/opis)" — zadanie jako rezultat + why (link do celu inicjatywy) + mierzalny outcome.
  strategy: {
    json: true,
    instruction:
      'Napisz kartę STRATEGIA zadania. Zwróć JSON o kluczach: ' +
      '{"description": "zadanie sformułowane jako REZULTAT (nie tylko czynność), 2-4 zdania answer-first", ' +
      '"why": "po co to zadanie — jawny link do celu inicjatywy / wartości biznesowej, 1-2 zdania", ' +
      '"expectedOutcome": "mierzalny STAN KOŃCOWY, nie czynność — MUSI zawierać: liczbę + jednostkę + kierunek zmiany ' +
      '(np. \'ranking 3 maszyn z payback <18 mies, redukcja przestojów >15%\'), 1-2 zdania"}. ' +
      'expectedOutcome ZAKAZ: czasowniki-aktywności jako outcome (\'identyfikacja X\', \'szacowanie Y\', \'przegląd Z\', ' +
      '\'analiza...\', \'zebranie danych...\') — to są kroki WYKONANIA, nie efekt końcowy. Napisz co JEST PRAWDĄ po zakończeniu, ' +
      'mierzalnie (liczba+jednostka+kierunek: spadek/wzrost/próg). Jeśli liczba jest szacunkiem/benchmarkiem bez twardego źródła ' +
      'z kontekstu zadania — oznacz ją jawnie („szacunek:", „benchmark, do walidacji:", „założenie:"), NIGDY nie podawaj liczby ' +
      'branżowej jako faktu. Nie mieszaj warstw: description=CO, why=PO CO, expectedOutcome=EFEKT MIERZALNY. Return valid JSON.',
  },
  // §3: „Acceptance / checklist" — kryteria akceptacji jako sprawdzalne kroki (definition of done).
  execution: {
    json: true,
    instruction:
      'Napisz kartę WYKONANIE — listę kryteriów akceptacji (definition of done) jako sprawdzalne kroki. ' +
      'Zwróć JSON: {"checklist": ["krok 1 sprawdzalny", "krok 2 sprawdzalny", ...]} — MINIMUM 3 pozycje, ' +
      'każda testowalna (można jednoznacznie stwierdzić zrobione/niezrobione), MECE, bez ogólników. ' +
      'Return valid JSON.',
  },
  // §3 doktryna: dowody potrzebne by uznać zadanie za wykonane (evidence-based delivery).
  evidence: {
    json: true,
    instruction:
      'Napisz kartę DOWODY — jakie konkretne dowody/artefakty potwierdzą wykonanie tego zadania. ' +
      'Zwróć JSON: {"evidence": ["dowód 1 (konkretny artefakt/pomiar/dokument)", ...]} — MINIMUM 2 pozycje, ' +
      'każdy dowód konkretny i weryfikowalny (nie „raport", lecz „raport X z metryką Y"). Return valid JSON.',
  },
  // Zależności blokujące + wymagane wejścia (grounded na kontekście inicjatywy).
  dependencies: {
    json: true,
    instruction:
      'Napisz kartę ZALEŻNOŚCI — co musi być gotowe ZANIM to zadanie ruszy lub się zakończy. ' +
      'Zwróć JSON: {"dependencies": ["zależność 1 (co / od kogo / dlaczego blokuje)", ...]}. ' +
      'Jeśli z kontekstu nie wynikają realne zależności — zwróć pustą listę [] (NIE zmyślaj). Return valid JSON.',
  },
};

// ── Interpolacja kontekstu ───────────────────────────────────────────────────

function buildUserPrompt(
  sectionKey: TaskSectionKey,
  ctx: TaskContext,
  isPolish: boolean
): string {
  const prompt = TASK_SECTION_PROMPTS[sectionKey];
  const label: Record<TaskSectionKey, string> = {
    strategy: isPolish ? 'STRATEGIA' : 'STRATEGY',
    execution: isPolish ? 'WYKONANIE' : 'EXECUTION',
    evidence: isPolish ? 'DOWODY' : 'EVIDENCE',
    dependencies: isPolish ? 'ZALEŻNOŚCI' : 'DEPENDENCIES',
  };

  const contextLines: string[] = [];
  if (ctx.title) contextLines.push(`- Tytuł zadania: ${ctx.title}`);
  if (ctx.description) contextLines.push(`- Obecny opis: ${ctx.description}`);
  if (ctx.why) contextLines.push(`- Why (istniejące): ${ctx.why}`);
  if (ctx.expectedOutcome) contextLines.push(`- Oczekiwany efekt (istniejący): ${ctx.expectedOutcome}`);
  if (ctx.taskType) contextLines.push(`- Typ zadania: ${ctx.taskType}`);
  if (ctx.priority) contextLines.push(`- Priorytet: ${ctx.priority}`);
  if (ctx.initiativeName) contextLines.push(`- Inicjatywa nadrzędna: ${ctx.initiativeName}`);
  if (ctx.initiativeContext) contextLines.push(`- Kontekst inicjatywy: ${ctx.initiativeContext}`);

  const contextBlock =
    contextLines.length > 0
      ? contextLines.join('\n')
      : isPolish
        ? '(brak dodatkowego kontekstu — oprzyj się na tytule i typie zadania)'
        : '(no extra context — rely on the title and task type)';

  return [
    `${isPolish ? 'Sekcja' : 'Section'}: ${label[sectionKey]}`,
    '',
    `${isPolish ? '--- KONTEKST ZADANIA ---' : '--- TASK CONTEXT ---'}`,
    contextBlock,
    '',
    `${isPolish ? '--- INSTRUKCJA KARTY ---' : '--- CARD INSTRUCTION ---'}`,
    prompt.instruction,
  ].join('\n');
}

// ── LLM instance (memoized, fail-soft) ───────────────────────────────────────

let _llmInstance: any = null;
async function getLLM(): Promise<any> {
  if (_llmInstance) return _llmInstance;
  try {
    const mod = await import('./ai/llmService.js');
    _llmInstance = (mod as any).llmService || (mod as any).default;
    return _llmInstance;
  } catch (err) {
    logger.warn('[TaskSectionGeneration] LLM Service not available');
    return null;
  }
}

/** Test seam — reset memoized LLM instance. */
export function __resetTaskLlmForTests(): void {
  _llmInstance = null;
}

// ── Główna funkcja ───────────────────────────────────────────────────────────

/**
 * Generuje treść jednej karty-sekcji Task wg promptu BCG + kontekstu.
 * Fail-soft: rzuca tylko gdy LLM nie skonfigurowany lub call padnie — kontroler
 * mapuje to na uczciwy błąd (stan karty 'error' → retry).
 */
export async function generateTaskSection(
  sectionKey: TaskSectionKey,
  ctx: TaskContext,
  options: GenerateOptions = {}
): Promise<TaskSectionResult> {
  if (!TASK_SECTION_PROMPTS[sectionKey]) {
    throw new Error(`Unknown task section: ${sectionKey}`);
  }

  const lang = String(options.language || 'en').toLowerCase();
  const isPolish = lang === 'pl' || lang === 'polish';
  const systemPrompt = isPolish ? TASK_DOCTRINE_SYSTEM_PROMPT : TASK_DOCTRINE_SYSTEM_PROMPT_EN;
  const userPrompt = buildUserPrompt(sectionKey, ctx, isPolish);

  const llm = await getLLM();
  if (!llm || typeof llm.call !== 'function') {
    throw new Error('AI service is not configured');
  }

  const result = await llm.call({
    type: 'text',
    modelConfig: { id: 'premium' },
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1500,
    temperature: 0.4,
    cache: true,
    cacheTtl: 3600,
    timeoutMs: 90000,
  });

  const content = String(result?.content || '');
  const usage = (result?.usage || {}) as Record<string, number>;
  const tokensUsed =
    usage.totalTokens || usage.completionTokens || Math.floor(content.length / 4);
  const model = String(result?.model || result?.modelId || 'llm-premium');

  const wantsJson = TASK_SECTION_PROMPTS[sectionKey].json;
  let parsedContent: unknown = undefined;
  if (wantsJson) {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      parsedContent = JSON.parse((jsonMatch[1] as string) || content);
    } catch {
      parsedContent = undefined;
    }
  }

  // Advisory quality flag (BCG §0 heuristics) — never blocks the response;
  // logged so weak sections are visible without a human re-reading every card.
  let qualityFlags: CardContentValidationResult | undefined;
  try {
    qualityFlags = validateCardContent(sectionKey, parsedContent ?? content);
    if (!qualityFlags.pass) {
      logger.warn('[TaskSectionGeneration] quality flags on generated section', {
        sectionKey,
        violations: qualityFlags.violations,
      });
    }
  } catch (err) {
    // Validator must never break generation — swallow and omit the flag.
    logger.warn('[TaskSectionGeneration] cardContentValidator threw, skipping', { sectionKey });
  }

  return {
    content,
    parsedContent,
    isJson: wantsJson,
    model,
    tokensUsed,
    qualityFlags,
  };
}

export default { generateTaskSection, TASK_SECTION_PROMPTS };
