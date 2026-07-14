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

import logger from '../../utils/Logger.js';
import {
  DELIVERABLE_GENERATION_PURPOSE,
  deliverableModelConfig,
  resolveDeliverableTier,
} from '../deliverableGenerationTier.js';
import { resolveDeliverableDefaults } from '../deliverables/deliverableDefaults.js';

// ── Defaults (czytane RAZ) ───────────────────────────────────────────────────
const REPORT_DEFAULTS = resolveDeliverableDefaults('report');

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
  return typeof type === 'string' && (ALLOWED_BLOCK_TYPES as readonly string[]).includes(type);
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
 * Typy "trywialne" — to dokładnie to, co generuje prozowy fallback
 * (heading + paragraph). Premium ma sens tylko gdy doda COKOLWIEK ponad to.
 */
const TRIVIAL_BLOCK_TYPES = new Set<string>(['heading', 'paragraph']);

/**
 * Walidacja jakości (DELIVERABLES_GRAPHIC_PARAMETERS.md): premium plan MUSI
 * zawierać ≥1 blok BOGATY (poza heading/paragraph) — inaczej premium nie zrobił
 * nic lepiej niż prozowy fallback. ORAZ żadna sekcja nie może mieć 0 bloków.
 *
 * UWAGA: wcześniej gate wymagał `distinctTypes > 1`, co FAŁSZYWIE odrzucało
 * legalne dokumenty jednotypowe (KPI-only one-pager, bullet-only streszczenie,
 * pojedyncza tabela compliance). Pojedynczy kpi_strip/bullet_list/table JEST
 * premium-grade vs [heading, paragraph]. (Wykryte przez docGeneratorE2E.)
 *
 * UWAGA 2: gate akceptuje też plan PROZOWY, który jest BOGATSZY niż trywialny
 * fallback (więcej bloków niż heading+paragraph per sekcja). Memo / brief, gdzie
 * premium świadomie wybiera prozę (np. "5 paragrafów"), to LEGALNY premium plan —
 * wcześniej taki plan spadał do 2-blokowego fallbacku (zmierzone: doc S01 memo
 * → premium plan [heading,paragraph×5] odrzucony → fallback 2 bloki → fail
 * minBlocks 5). Trywialny fallback = dokładnie 2 bloki/sekcję (heading+paragraph),
 * więc plan z >2·N bloków NIESIE wartość strukturalną nawet bez rich-typu.
 */
function premiumPlanPassesQuality(sections: StructurePlanSection[]): boolean {
  if (sections.length === 0) return false;
  if (sections.some((s) => s.blocks.length === 0)) return false;

  // (a) ≥1 blok poza zbiorem trywialnym = premium dodał wartość TYPOWĄ.
  const hasRichBlock = sections.some((s) => s.blocks.some((b) => !TRIVIAL_BLOCK_TYPES.has(b.type)));
  if (hasRichBlock) return true;

  // (b) Prozowy, ale BOGATSZY niż fallback (heading+paragraph = 2/sekcję): premium
  // rozwinął treść (memo z wieloma paragrafami) → też wartość strukturalna.
  const totalBlocks = sections.reduce((a, s) => a + s.blocks.length, 0);
  return totalBlocks > 2 * sections.length;
}

/**
 * Block-count floor/ceiling per section, scaled to document size. Concise
 * documents (few sections) must stay lean — otherwise a single section soaks up
 * every block type (measured: 1-section memo → 12 blocks vs expected 5-7).
 * Deterministic safety net behind the prompt guidance: trims over-rich sections
 * in small docs to a sane ceiling while ALWAYS preserving the leading heading and
 * at least one rich (non-trivial) block so the section still beats prose fallback.
 *
 * General by construction — keyed on SECTION COUNT only, never on scenario name.
 */
function calibrateBlockCounts(sections: StructurePlanSection[]): StructurePlanSection[] {
  // Per-section ceiling: tiny docs (≤2 sections) → 6; otherwise leave as-is
  // (larger docs legitimately carry rich sections; their block budget is spread).
  if (sections.length === 0 || sections.length > 2) return sections;
  const CEILING = 6;

  return sections.map((s) => {
    if (s.blocks.length <= CEILING) return s;
    const heading = s.blocks.find((b) => b.type === 'heading');
    const rest = s.blocks.filter((b) => b !== heading);
    // Prefer keeping a balanced, lean mix: 1 rich block + prose/lists, capped.
    const richKept = rest.filter((b) => !TRIVIAL_BLOCK_TYPES.has(b.type)).slice(0, 2);
    const trivialKept = rest.filter((b) => TRIVIAL_BLOCK_TYPES.has(b.type));
    const kept: StructurePlanBlock[] = [];
    if (heading) kept.push(heading);
    // Interleave: ensure ≥1 rich block survives, then fill with prose up to ceiling.
    for (const b of richKept) {
      if (kept.length >= CEILING) break;
      kept.push(b);
    }
    for (const b of trivialKept) {
      if (kept.length >= CEILING) break;
      kept.push(b);
    }
    return { ...s, blocks: kept };
  });
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
    .map((s, i) => `${i + 1}. "${s.title}"${s.purpose ? ` — ${s.purpose}` : ''}`)
    .join('\n');

  // CALIBRATE richness to document SIZE: a short memo / brief / one-pager (few
  // sections) must stay CONCISE, otherwise a single section accumulates every
  // block type (heading+kpi+table+chart+callout+list = 12 blocks) and a "5-paragraph
  // memo" balloons (measured: doc S01 wanted 5-7 blocks, premium produced 12).
  // Reserve rich multi-block stacks for substantial analytical sections in larger
  // documents. The blocksPerSectionGuide below is a soft target the LLM should honour.
  const sectionCount = outline.length;
  const conciseDoc = sectionCount <= 2;
  const blocksPerSectionGuide = conciseDoc
    ? 'This is a SHORT document. Keep EACH section CONCISE but COMPLETE: a heading ' +
      'followed by about 4-6 blocks total. Do NOT stack every block type into one ' +
      'section, and do NOT collapse it to a single paragraph either. Honour the intent ' +
      'cues — "memo", "brief", "one-pager", "krótki" mean lean structure; "N paragraphs" ' +
      'means roughly N prose blocks. Favour several short prose/callout blocks over one ' +
      'long paragraph, with at most one rich block (table/kpi_strip) where it truly helps.'
    : 'Give each section a focused block sequence (typically 3-6 blocks): a heading, ' +
      'supporting prose, and the ONE or TWO rich blocks that best fit its purpose. ' +
      'Do not pad every section with every block type.';

  const d = REPORT_DEFAULTS.content;
  const registerGuide = `Document register: ${d.register}.`;
  const answerFirstGuide = d.answerFirst
    ? 'Answer-first structure: lead each section with the key finding or recommendation, then support it.'
    : '';
  const actionTitlesGuide = d.actionTitles
    ? 'Section headings must be action-titles (so-what statements). E.g. "Sales grew 40% driven by new channel" not "Sales performance".'
    : '';

  const systemPrompt =
    'You are a document structure architect (McKinsey / Kimi-Claude quality). ' +
    'For each section, choose a sequence of block types that best conveys the ' +
    'content — not just paragraphs. Use tables for comparisons, kpi_strip for ' +
    'metrics, callout for key warnings/insights, bullet_list for enumerations, ' +
    'chart for trends. A good analytical section has heading + paragraph + ' +
    '(table OR kpi_strip) + callout where relevant. ' +
    "Block count must MATCH each section's scope — calibrate to the document size, " +
    'never maximise block variety for its own sake. ' +
    `${blocksPerSectionGuide} ` +
    `${registerGuide} ${answerFirstGuide} ${actionTitlesGuide} ` +
    'A section\'s purpose may carry HARD CONSTRAINTS (e.g. "data-only, no prose", ' +
    '"exactly N items", a required block type) — those OVERRIDE the generic guidance ' +
    'above; obey them exactly. ' +
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
    modelConfig: deliverableModelConfig(),
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: LlmOutputSchema,
    maxTokens: 1500,
    temperature: 0.2,
    cache: false,
    // Duży raport (8+ sekcji) = jeden większy structured-call; 60s bywa za mało
    // → timeout → fallback do prozy (zmierzone na doc S16). 120s daje zapas.
    timeoutMs: 120000,
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
    const llmSectionsRaw = await planViaLlm(intent, outline);
    const llmSections = llmSectionsRaw ? calibrateBlockCounts(llmSectionsRaw) : llmSectionsRaw;

    if (llmSections && premiumPlanPassesQuality(llmSections)) {
      logger.info('[docStructure] premium plan', {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
        orgId: opts.orgId,
        sections: llmSections.length,
        blocks: llmSections.reduce((a, s) => a + s.blocks.length, 0),
      });
      return {
        sections: llmSections,
        tierUsed: 'PREMIUM',
        fallbackUsed: false,
      };
    }

    // LLM nie dał użytecznego / jakościowego planu → fallback.
    logger.warn('[docStructure] premium plan failed quality gate, using fallback', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts.orgId,
    });
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
