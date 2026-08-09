/**
 * presentationLayoutVariantsService — W4 / B2 (seria B, domena Deck)
 *
 * Dwie operacje, obydwie nadbudowane nad B1
 * (`presentationLayoutDirectorService.planDeckLayout`):
 *
 *   1) `generateDeckVariants` — N=3 alternatywnych planów dla tej samej treści,
 *      każdy z INNĄ paletą (z 13) i potencjalnie innym doborem intentów —
 *      „remiks wzrokowy" dla użytkownika do wyboru w UI.
 *   2) `remixDeckLayout` — regeneracja istniejącego planu wg instrukcji
 *      użytkownika („więcej wizualnie", „użyj palety ocean", „mniej tekstu") —
 *      pojedynczy nowy plan.
 *
 * SAFETY (Znalezisko #1 — generacja dotyka żywych klientów):
 *   - PREMIUM tylko za flagą `ENABLE_DELIVERABLES_PREMIUM` (B5 resolver, OFF
 *     domyślnie ⇒ STANDARD ⇒ 1 deterministyczny wariant / brak remixa).
 *   - FAIL-OPEN ZAWSZE: każdy błąd LLM → deterministyczny pojedynczy wariant
 *     z B1 (`planDeckLayout` ma własny fail-open). NIGDY nie rzuca.
 *   - NIE wpięte w żywy pipeline — eksport tylko.
 *
 * Quality-gate (DELIVERABLES_GRAPHIC_PARAMETERS.md):
 *   - variants ≥2 muszą mieć DYSTYNKTNE `paletteId` (różnorodność wzrokowa).
 *     Jeśli LLM zwróci same identyczne palety → fail-open: 1 deterministyczny
 *     wariant z dziedziczonej palety + odrzucamy resztę.
 *
 * @module services/presentationLayoutVariantsService
 */

import logger from '../utils/Logger.js';
import {
  DELIVERABLE_GENERATION_PURPOSE,
  resolveDeliverableTier,
} from './deliverableGenerationTier.js';
import {
  type DeckLayoutDirectorResult,
  LAYOUT_INTENT_CATALOG,
  PALETTE_CATALOG,
  planDeckLayout,
  type PlanDeckLayoutOptions,
  type SlideLayoutPlan,
} from './presentationLayoutDirectorService.js';
import type { SlideIntent, UnifiedReportMeta, UnifiedSlide } from './report/pptx/types.js';

// ──────────────────────────────────────────────────────────────
// Stałe + helpery walidujące (mirror B1 — bez re-exportu wewnętrznych)
// ──────────────────────────────────────────────────────────────

/** Liczba wariantów generowanych w jednym wywołaniu LLM (premium). */
export const DECK_VARIANT_COUNT = 3;

const LAYOUT_INTENT_SET = new Set<string>(LAYOUT_INTENT_CATALOG);
const PALETTE_SET = new Set<string>(PALETTE_CATALOG);

function isValidLayoutIntent(value: unknown): value is SlideIntent {
  return typeof value === 'string' && LAYOUT_INTENT_SET.has(value);
}

function isValidPalette(value: unknown): boolean {
  return typeof value === 'string' && PALETTE_SET.has(value);
}

// ──────────────────────────────────────────────────────────────
// Kontrakty publiczne
// ──────────────────────────────────────────────────────────────

export interface DeckVariantsResult {
  variants: DeckLayoutDirectorResult[];
  tierUsed: 'PREMIUM' | 'STANDARD';
  fallbackUsed: boolean;
}

export interface GenerateDeckVariantsOptions extends PlanDeckLayoutOptions {
  /** Ile wariantów wygenerować (default DECK_VARIANT_COUNT). */
  count?: number;
}

export interface RemixDeckOptions extends PlanDeckLayoutOptions {
  /** Instrukcja użytkownika dla LLM (np. "więcej wizualnie", "użyj ocean"). */
  instruction: string;
}

// ──────────────────────────────────────────────────────────────
// Helper — podsumowanie slajdu dla LLM (mirror B1 - keep minimal)
// ──────────────────────────────────────────────────────────────

function summarizeSlideForLlm(slide: UnifiedSlide, index: number): string {
  const content = (slide?.content ?? {}) as unknown as Record<string, unknown>;
  const km = slide?.key_message ? ` key_message="${String(slide.key_message).slice(0, 160)}"` : '';
  const currentIntent = isValidLayoutIntent(slide?.intent) ? slide.intent : '(none)';
  const hintKeys = ['title', 'headline', 'section_title', 'problem', 'verdict', 'closing_message'];
  const hints = hintKeys
    .map((k) => (typeof content[k] === 'string' ? `${k}="${String(content[k]).slice(0, 80)}"` : ''))
    .filter(Boolean)
    .join(' ');
  return `Slide ${index}: currentIntent=${currentIntent}${km} ${hints}`.trim();
}

// ──────────────────────────────────────────────────────────────
// Normalizacja planu z LLM → SlideLayoutPlan[]
// ──────────────────────────────────────────────────────────────

function normalizeLlmPlans(
  rawPlans: unknown,
  slides: UnifiedSlide[],
  paletteFallback: string
): SlideLayoutPlan[] {
  const arr = Array.isArray(rawPlans) ? rawPlans : [];
  const byIndex = new Map<number, any>();
  for (const p of arr) {
    const idx = (p as any)?.slideIndex;
    if (typeof idx === 'number') byIndex.set(idx, p);
  }

  return slides.map((slide, index) => {
    const raw = byIndex.get(index);
    const baseIntent: SlideIntent = isValidLayoutIntent(slide?.intent)
      ? slide.intent
      : index === 0
        ? 'cover'
        : index === slides.length - 1
          ? 'next_steps'
          : 'key_messages';

    if (!raw) {
      return {
        slideIndex: index,
        layoutIntent: baseIntent,
        paletteId: paletteFallback,
        imageBrief: null,
        reasoning: `Variant fallback (LLM omitted slide ${index + 1})`,
        source: 'deterministic' as const,
      };
    }

    const layoutIntent: SlideIntent = isValidLayoutIntent(raw.layoutIntent)
      ? raw.layoutIntent
      : baseIntent;
    const paletteId = isValidPalette(raw.paletteId) ? raw.paletteId : paletteFallback;

    return {
      slideIndex: index,
      layoutIntent,
      paletteId,
      imageBrief:
        typeof raw.imageBrief === 'string' && raw.imageBrief.trim() ? raw.imageBrief.trim() : null,
      reasoning: (typeof raw.reasoning === 'string' && raw.reasoning) || 'LLM variant',
      source: isValidLayoutIntent(raw.layoutIntent) ? ('llm' as const) : ('deterministic' as const),
    };
  });
}

/** Wymusza jedną paletę na cały wariant (spójność wizualna). */
function enforceSinglePalette(plans: SlideLayoutPlan[], paletteId: string): SlideLayoutPlan[] {
  if (plans.length === 0) return plans;
  const chosen = isValidPalette(paletteId) ? paletteId : plans[0].paletteId;
  return plans.map((p) => (p.paletteId === chosen ? p : { ...p, paletteId: chosen }));
}

// ──────────────────────────────────────────────────────────────
// generateDeckVariants — N alternatywnych planów (PREMIUM single-shot LLM)
// ──────────────────────────────────────────────────────────────

interface RawVariant {
  paletteId: string;
  plans: unknown[];
}

async function generateVariantsViaLlm(
  slides: UnifiedSlide[],
  meta: UnifiedReportMeta,
  count: number
): Promise<RawVariant[] | null> {
  // Dynamic import — unit testy nie ciągną stacku AI.
  const { llmService } = await import('./ai/llmService.js');
  const { z } = await import('zod');

  const slideDigest = slides.map((s, i) => summarizeSlideForLlm(s, i)).join('\n');

  const systemPrompt =
    `You are a presentation REMIX director (Gamma-quality). Produce ${count} ALTERNATIVE ` +
    'deck plans for the same content — each variant is a different "vibe" the user picks from. ' +
    'Hard rules:\n' +
    `  - Each variant MUST use a DISTINCT palette from the catalog (no two variants share a palette).\n` +
    '  - Within a variant, one palette for ALL slides (consistency).\n' +
    '  - Vary layout intents across variants where it makes sense (no copy-paste).\n' +
    '  - Never >2 consecutive identical layouts within a variant.\n' +
    `Layout intent catalog (choose ONLY from these): ${LAYOUT_INTENT_CATALOG.join(', ')}.\n` +
    `Palette catalog (choose ONLY from these): ${PALETTE_CATALOG.join(', ')}.`;

  const userPrompt =
    `Deck language: ${meta?.language ?? 'en'}. Template: ${meta?.template ?? 'corporate'}. ` +
    `Project: "${meta?.project ?? ''}" for client "${meta?.client ?? ''}".\n` +
    `Slides (${slides.length}):\n${slideDigest}\n\n` +
    `Return exactly ${count} variants with distinct palettes. Each variant has one plan per slide.`;

  const PlanItemSchema = z.object({
    slideIndex: z.number(),
    layoutIntent: z.enum(LAYOUT_INTENT_CATALOG as unknown as [string, ...string[]]),
    paletteId: z.enum(PALETTE_CATALOG as unknown as [string, ...string[]]),
    imageBrief: z.string().nullable(),
    reasoning: z.string(),
  });
  const VariantSchema = z.object({
    paletteId: z.enum(PALETTE_CATALOG as unknown as [string, ...string[]]),
    plans: z.array(PlanItemSchema),
  });
  const OutputSchema = z.object({ variants: z.array(VariantSchema) });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: { id: 'premium' },
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: OutputSchema,
    maxTokens: 3000,
    temperature: 0.5,
    cache: false,
  });

  const obj = (result as any)?.object;
  const rawVariants: unknown[] = Array.isArray(obj?.variants) ? obj.variants : [];
  if (rawVariants.length === 0) return null;

  return rawVariants
    .filter((v) => v && typeof v === 'object')
    .map((v) => ({
      paletteId: String((v as any).paletteId ?? ''),
      plans: Array.isArray((v as any).plans) ? (v as any).plans : [],
    }));
}

/**
 * Generuje N wariantów planu decka. PREMIUM = jeden LLM call zwraca N wariantów
 * z DYSTYNKTNYMI paletami; STANDARD = jeden deterministyczny wariant z B1.
 *
 * Fail-open: każda błąd LLM / brak dystynktnych palet → 1 deterministyczny
 * wariant z B1. NIGDY nie rzuca.
 */
export async function generateDeckVariants(
  slides: UnifiedSlide[],
  meta: UnifiedReportMeta,
  opts: GenerateDeckVariantsOptions
): Promise<DeckVariantsResult> {
  const safeSlides = Array.isArray(slides) ? slides : [];
  const count = Math.max(1, opts?.count ?? DECK_VARIANT_COUNT);

  // 1. Tier — fail-open: resolver sam nie rzuca, ale wrapper na wszelki wypadek.
  let tier: 'PREMIUM' | 'STANDARD';
  try {
    tier = resolveDeliverableTier({
      orgId: opts?.orgId,
      preferPremium: opts?.preferPremium,
    });
  } catch {
    tier = 'STANDARD';
  }

  // 2. STANDARD → jeden deterministyczny wariant przez B1.
  if (tier !== 'PREMIUM') {
    const single = await planDeckLayout(safeSlides, meta, opts);
    return {
      variants: [single],
      tierUsed: 'STANDARD',
      fallbackUsed: true,
    };
  }

  // 3. PREMIUM → LLM single-shot. Fail-open na każdym kroku.
  try {
    logger.info('[deckVariants] premium remix', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts?.orgId,
      slides: safeSlides.length,
      count,
    });

    const rawVariants = await generateVariantsViaLlm(safeSlides, meta, count);
    if (!rawVariants || rawVariants.length === 0) {
      logger.warn('[deckVariants] premium LLM returned no variants, falling back', {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
        orgId: opts?.orgId,
      });
      const single = await planDeckLayout(safeSlides, meta, opts);
      return { variants: [single], tierUsed: 'PREMIUM', fallbackUsed: true };
    }

    // 4. Quality-gate: ≥2 wariantów z dystynktnymi paletami (jeśli count≥2).
    const variants: DeckLayoutDirectorResult[] = [];
    const seenPalettes = new Set<string>();
    for (const v of rawVariants) {
      if (!isValidPalette(v.paletteId)) continue;
      if (seenPalettes.has(v.paletteId)) continue; // skip duplicate palettes
      seenPalettes.add(v.paletteId);
      const plans = enforceSinglePalette(
        normalizeLlmPlans(v.plans, safeSlides, v.paletteId),
        v.paletteId
      );
      const fromLlm = plans.some((p) => p.source === 'llm');
      variants.push({
        plans,
        tierUsed: 'PREMIUM',
        fallbackUsed: !fromLlm,
      });
    }

    // 5. Gdy quality-gate nie spełniony (mniej niż 2 dystynktnych palet przy
    //    count≥2) → fail-open na pełen fallback.
    if (count >= 2 && variants.length < 2) {
      logger.warn('[deckVariants] failed distinct-palette quality gate, falling back', {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
        orgId: opts?.orgId,
        got: variants.length,
        wanted: count,
      });
      const single = await planDeckLayout(safeSlides, meta, opts);
      return { variants: [single], tierUsed: 'PREMIUM', fallbackUsed: true };
    }

    return { variants, tierUsed: 'PREMIUM', fallbackUsed: false };
  } catch (err) {
    logger.warn('[deckVariants] premium generation failed, falling back', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts?.orgId,
      err: (err as Error)?.message,
    });
    const single = await planDeckLayout(safeSlides, meta, opts);
    return { variants: [single], tierUsed: 'PREMIUM', fallbackUsed: true };
  }
}

// ──────────────────────────────────────────────────────────────
// remixDeckLayout — regeneracja planu wg instrukcji użytkownika
// ──────────────────────────────────────────────────────────────

async function remixViaLlm(
  slides: UnifiedSlide[],
  meta: UnifiedReportMeta,
  currentPlans: SlideLayoutPlan[],
  instruction: string
): Promise<SlideLayoutPlan[] | null> {
  const { llmService } = await import('./ai/llmService.js');
  const { z } = await import('zod');

  const slideDigest = slides.map((s, i) => summarizeSlideForLlm(s, i)).join('\n');
  const currentDigest = currentPlans
    .map((p) => `  - Slide ${p.slideIndex}: layout=${p.layoutIntent}, palette=${p.paletteId}`)
    .join('\n');

  const systemPrompt =
    'You are a presentation REMIX director (Gamma-quality). Adjust the existing deck plan ' +
    'per the user instruction. Keep the same number of slides. Pick layout intents + ONE ' +
    'consistent palette for the whole deck. Avoid >2 consecutive identical layouts.\n' +
    `Layout intent catalog (choose ONLY from these): ${LAYOUT_INTENT_CATALOG.join(', ')}.\n` +
    `Palette catalog (choose ONLY from these, same paletteId for every slide): ${PALETTE_CATALOG.join(', ')}.`;

  const userPrompt =
    `Deck language: ${meta?.language ?? 'en'}. Template: ${meta?.template ?? 'corporate'}.\n` +
    `Current plan:\n${currentDigest}\n\n` +
    `Slides (${slides.length}):\n${slideDigest}\n\n` +
    `User instruction: "${instruction.slice(0, 400)}"\n\n` +
    'Return one plan object per slide, in order, with slideIndex matching the slide number above.';

  const PlanItemSchema = z.object({
    slideIndex: z.number(),
    layoutIntent: z.enum(LAYOUT_INTENT_CATALOG as unknown as [string, ...string[]]),
    paletteId: z.enum(PALETTE_CATALOG as unknown as [string, ...string[]]),
    imageBrief: z.string().nullable(),
    reasoning: z.string(),
  });
  const OutputSchema = z.object({ plans: z.array(PlanItemSchema) });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: { id: 'premium' },
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: OutputSchema,
    maxTokens: 1500,
    temperature: 0.4,
    cache: false,
  });

  const obj = (result as any)?.object;
  const rawPlans: unknown[] = Array.isArray(obj?.plans) ? obj.plans : [];
  if (rawPlans.length === 0) return null;

  // Wybierz paletę z PIERWSZEGO ważnego planu z LLM (do enforceSinglePalette).
  const firstRawPalette = rawPlans.find((p) => isValidPalette((p as any)?.paletteId)) as any;
  const paletteFallback: string =
    firstRawPalette?.paletteId ?? currentPlans[0]?.paletteId ?? 'harvard';

  const plans = normalizeLlmPlans(rawPlans, slides, paletteFallback);
  return enforceSinglePalette(plans, paletteFallback);
}

/**
 * Remiks planu decka wg instrukcji użytkownika.
 *
 * PREMIUM → LLM dostaje currentPlans + instruction, zwraca nowy plan. STANDARD
 * → zwraca currentPlans bez zmian (deterministycznie; remix wymaga LLM).
 *
 * Fail-open: każdy błąd → currentPlans nietknięte. NIGDY nie rzuca.
 */
export async function remixDeckLayout(
  slides: UnifiedSlide[],
  meta: UnifiedReportMeta,
  currentPlans: SlideLayoutPlan[],
  opts: RemixDeckOptions
): Promise<DeckLayoutDirectorResult> {
  const safeSlides = Array.isArray(slides) ? slides : [];
  const safePlans = Array.isArray(currentPlans) ? currentPlans : [];
  const instruction = String(opts?.instruction ?? '').trim();

  let tier: 'PREMIUM' | 'STANDARD';
  try {
    tier = resolveDeliverableTier({
      orgId: opts?.orgId,
      preferPremium: opts?.preferPremium,
    });
  } catch {
    tier = 'STANDARD';
  }

  // Brak instrukcji albo STANDARD → zwróć currentPlans bez zmian.
  if (tier !== 'PREMIUM' || !instruction) {
    return {
      plans: safePlans,
      tierUsed: tier,
      fallbackUsed: true,
    };
  }

  try {
    logger.info('[deckRemix] premium', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts?.orgId,
      slides: safeSlides.length,
      instructionLen: instruction.length,
    });

    const remixed = await remixViaLlm(safeSlides, meta, safePlans, instruction);
    if (!remixed || remixed.length === 0) {
      return { plans: safePlans, tierUsed: 'PREMIUM', fallbackUsed: true };
    }
    const fromLlm = remixed.some((p) => p.source === 'llm');
    return {
      plans: remixed,
      tierUsed: 'PREMIUM',
      fallbackUsed: !fromLlm,
    };
  } catch (err) {
    logger.warn('[deckRemix] premium failed, returning current plans', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts?.orgId,
      err: (err as Error)?.message,
    });
    return { plans: safePlans, tierUsed: 'PREMIUM', fallbackUsed: true };
  }
}
