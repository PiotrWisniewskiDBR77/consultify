/**
 * documentStructureGenerator — W4 / B3: premium LLM dobiera PEŁNĄ strukturę
 * bloków dokumentu (typy bloków per sekcja: heading / paragraph / table /
 * kpi_strip / callout / chart / bullet_list / …), nie tylko prozę.
 *
 * Dziś `documentContentGenerator.buildDocumentSchema` robi deterministyczny
 * outline + LLM dopisuje TYLKO prozę per blok. B3 dodaje warstwę „architekta
 * struktury": dla każdej sekcji premium LLM proponuje sekwencję typów bloków
 * najlepiej oddającą treść (tabela do porównań, kpi_strip do metryk, callout
 * do kluczowych ostrzeżeń, …). Z fallbackiem do dzisiejszego zachowania
 * (heading + paragraph = sama proza).
 *
 * SAFETY:
 *   - default OFF (tier=STANDARD) ⇒ fallback = dzisiejsze zachowanie.
 *   - FAIL-OPEN: każdy błąd (LLM, walidacja, resolver) → fallback, NIGDY rzut.
 *   - NIE wpięte w żywy pipeline. Gotowe do wpięcia gdy premium doc-gen ruszy.
 */

import {
  resolveDeliverableTier,
  DELIVERABLE_GENERATION_PURPOSE,
} from '../deliverableGenerationTier.js';
import logger from '../../utils/Logger.js';

/** Typy bloków dozwolone w DocumentSchema (mirror types.ts DocumentBlock). */
export const ALLOWED_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'bullet_list',
  'numbered_list',
  'table',
  'risk_table',
  'kpi_strip',
  'chart',
  'quote',
  'callout',
  'image',
  'footnote',
  'citation',
] as const;

export type AllowedBlockType = (typeof ALLOWED_BLOCK_TYPES)[number];

/** Typ na który mapujemy każdy nieprawidłowy / nieznany typ bloku z LLM. */
const FALLBACK_BLOCK_TYPE: AllowedBlockType = 'paragraph';

export interface StructurePlanBlock {
  /** Jeden z {@link ALLOWED_BLOCK_TYPES}. Nieprawidłowy → 'paragraph'. */
  type: string;
  /** Co ten blok ma zawierać — wskazówka dla generateBlockProse later. */
  hint: string;
}

export interface StructurePlanSection {
  title: string;
  purpose: string;
  /** RÓŻNE typy bloków wg treści, nie sama proza. Nigdy puste. */
  blocks: StructurePlanBlock[];
}

export interface DocumentStructurePlan {
  sections: StructurePlanSection[];
  tierUsed: 'PREMIUM' | 'STANDARD';
  fallbackUsed: boolean;
}

export interface OutlineSeed {
  title: string;
  purpose?: string;
}

export interface PlanDocumentStructureOptions {
  orgId: string;
  userId?: string;
  preferPremium?: boolean;
}

/** Czy typ bloku jest dozwolony? */
function isAllowedBlockType(type: unknown): type is AllowedBlockType {
  return (
    typeof type === 'string' &&
    (ALLOWED_BLOCK_TYPES as readonly string[]).includes(type)
  );
}

/** Mapuj nieprawidłowy typ na 'paragraph'. */
function normalizeBlockType(type: unknown): AllowedBlockType {
  return isAllowedBlockType(type) ? type : FALLBACK_BLOCK_TYPE;
}

/**
 * Fallback / STANDARD: każda sekcja = heading + paragraph (dzisiejsze
 * zachowanie — sama proza). Deterministyczny, nigdy nie zawodzi.
 */
function buildFallbackPlan(outline: OutlineSeed[]): StructurePlanSection[] {
  return outline.map((section) => ({
    title: section.title,
    purpose: section.purpose ?? '',
    blocks: [
      { type: 'heading', hint: section.title },
      {
        type: 'paragraph',
        hint: section.purpose ?? `Prose for "${section.title}".`,
      },
    ],
  }));
}

/**
 * Walidacja jakości (DELIVERABLES_GRAPHIC_PARAMETERS.md): premium plan MUSI
 * mieć >1 typ bloku w całym dokumencie (inaczej premium nie zadziałał lepiej
 * niż fallback) ORAZ żadna sekcja nie może mieć 0 bloków.
 */
function premiumPlanPassesQuality(sections: StructurePlanSection[]): boolean {
  if (sections.length === 0) return false;
  if (sections.some((s) => s.blocks.length === 0)) return false;

  const distinctTypes = new Set<string>();
  for (const section of sections) {
    for (const block of section.blocks) {
      distinctTypes.add(block.type);
    }
  }
  return distinctTypes.size > 1;
}

/**
 * PREMIUM: LLM strukturalne — dla każdej sekcji z outline dobiera sekwencję
 * typów bloków najlepiej oddającą treść. Zwraca sekcje lub `null` gdy LLM nie
 * dał użytecznego wyniku (caller spada do fallbacku).
 */
async function planViaLlm(
  intent: string,
  outline: OutlineSeed[]
): Promise<StructurePlanSection[] | null> {
  // Importy dynamiczne — unit-testy nie ciągną całego stacku AI.
  const { llmService } = await import('../ai/llmService.js');
  const { z } = await import('zod');

  const outlineList = outline
    .map(
      (s, i) =>
        `${i + 1}. "${s.title}"${s.purpose ? ` — ${s.purpose}` : ''}`
    )
    .join('\n');

  const systemPrompt =
    'You are a document structure architect (McKinsey / Kimi-Claude quality). ' +
    'For each section, choose a sequence of block types that best conveys the ' +
    'content — not just paragraphs. Use tables for comparisons, kpi_strip for ' +
    'metrics, callout for key warnings/insights, bullet_list for enumerations, ' +
    'chart for trends. A good audit report section has heading + paragraph + ' +
    '(table OR kpi_strip) + callout where relevant. ' +
    `Allowed block types: ${ALLOWED_BLOCK_TYPES.join(', ')}. ` +
    'Reply with ONLY a JSON object conforming to the schema.';

  const userPrompt =
    `Document intent: "${intent}"\n` +
    `Sections (use these titles, do not invent new sections):\n${outlineList}\n\n` +
    'For each section return its block sequence. Each block needs a `type` ' +
    '(one of the allowed types) and a `hint` describing what the block should contain.';

  const LlmBlockSchema = z.object({
    type: z.string(),
    hint: z.string(),
  });
  const LlmSectionSchema = z.object({
    title: z.string(),
    purpose: z.string().optional(),
    blocks: z.array(LlmBlockSchema),
  });
  const LlmOutputSchema = z.object({
    sections: z.array(LlmSectionSchema),
  });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: { id: 'premium' },
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: LlmOutputSchema,
    maxTokens: 1500,
    temperature: 0.2,
    cache: false,
  });

  const obj = (result as any)?.object;
  if (!obj || !Array.isArray(obj.sections) || obj.sections.length === 0) {
    return null;
  }

  // Normalizuj typy bloków (nieprawidłowy → 'paragraph'); odrzuć puste sekcje
  // dosypując fallback heading+paragraph żeby zachować inwariant „0 bloków =
  // niedozwolone".
  const sections: StructurePlanSection[] = obj.sections.map((s: any) => {
    const rawBlocks: any[] = Array.isArray(s.blocks) ? s.blocks : [];
    let blocks: StructurePlanBlock[] = rawBlocks
      .filter((b) => b && typeof b === 'object')
      .map((b) => ({
        type: normalizeBlockType(b.type),
        hint: typeof b.hint === 'string' ? b.hint : '',
      }));

    if (blocks.length === 0) {
      blocks = [
        { type: 'heading', hint: String(s.title ?? '') },
        { type: 'paragraph', hint: String(s.purpose ?? s.title ?? '') },
      ];
    }

    return {
      title: String(s.title ?? ''),
      purpose: typeof s.purpose === 'string' ? s.purpose : '',
      blocks,
    };
  });

  return sections;
}

/**
 * Zaplanuj pełną strukturę bloków dokumentu.
 *
 * 1. Tier resolver decyduje PREMIUM vs STANDARD (B5; OFF domyślnie).
 * 2. PREMIUM: LLM dobiera typy bloków per sekcja; waliduje jakość (>1 typ).
 * 3. Fallback (STANDARD lub LLM fail/słaby): heading + paragraph per sekcja.
 * 4. FAIL-OPEN: każdy błąd → fallback, nigdy nie rzuca.
 */
export async function planDocumentStructure(
  intent: string,
  outline: OutlineSeed[],
  opts: PlanDocumentStructureOptions
): Promise<DocumentStructurePlan> {
  const tier = resolveDeliverableTier({
    orgId: opts.orgId,
    preferPremium: opts.preferPremium,
  });

  if (tier !== 'PREMIUM') {
    return {
      sections: buildFallbackPlan(outline),
      tierUsed: 'STANDARD',
      fallbackUsed: true,
    };
  }

  try {
    const llmSections = await planViaLlm(intent, outline);

    if (llmSections && premiumPlanPassesQuality(llmSections)) {
      logger.info('[docStructure] premium plan', {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
        orgId: opts.orgId,
        sections: llmSections.length,
      });
      return {
        sections: llmSections,
        tierUsed: 'PREMIUM',
        fallbackUsed: false,
      };
    }

    // LLM nie dał użytecznego / jakościowego planu → fallback.
    logger.warn(
      '[docStructure] premium plan failed quality gate, using fallback',
      { purpose: DELIVERABLE_GENERATION_PURPOSE, orgId: opts.orgId }
    );
  } catch (err) {
    // Fail-open: generacja nie może się wywalić bo LLM kichnął.
    logger.warn('[docStructure] premium plan threw, using fallback', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts.orgId,
      err: (err as Error)?.message,
    });
  }

  return {
    sections: buildFallbackPlan(outline),
    tierUsed: 'STANDARD',
    fallbackUsed: true,
  };
}
