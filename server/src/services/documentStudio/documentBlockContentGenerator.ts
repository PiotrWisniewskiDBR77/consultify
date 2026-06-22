/**
 * documentBlockContentGenerator — W4-cd / content-gen layer dla doc (premium).
 *
 * B3 (`documentStructureGenerator`) decyduje JAKIE typy bloków idą gdzie
 * (struktura). TEN serwis wypełnia je TREŚCIĄ: kpi_strip → items, chart →
 * series, table → rows, callout → text+tone, listy → items, quote → text+author.
 *
 * Normalizery wymuszają parametry graficzne (DELIVERABLES_GRAPHIC_PARAMETERS.md):
 *   - KPI strip: 3-5 itemów, każdy {label, value, delta}
 *   - chart: ≤6 serii, paleta ≤7 kolorów (clamp), title + axis labels
 *   - callout: tone ∈ {info, warning, danger, success}
 *
 * SAFETY:
 *   - PREMIUM tylko za flagą (B5 resolver). STANDARD → prozowy fallback
 *     (każdy blok = paragraph z hintem) = dzisiejsze zachowanie.
 *   - FAIL-OPEN: błąd LLM / walidacji → prozowy fallback. NIGDY nie rzuca.
 *   - NIE WPIĘTE w żywy `buildDocumentSchema` (komentarz `// B3 ready`) —
 *     opt-in, gotowe do wpięcia gdy premium doc aktywowane per klient.
 *
 * @module services/documentStudio/documentBlockContentGenerator
 */

import {
  resolveDeliverableTier,
  DELIVERABLE_GENERATION_PURPOSE,
} from '../deliverableGenerationTier.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[docContentGen]';

// ──────────────────────────────────────────────────────────────
// Parametry graficzne
// ──────────────────────────────────────────────────────────────
const KPI_MIN = 3;
const KPI_MAX = 5;
const CHART_MAX_SERIES = 6;
const CHART_PALETTE = [
  '#2563EB',
  '#0D9488',
  '#7C3AED',
  '#DC2626',
  '#EA580C',
  '#0891B2',
  '#65A30D',
]; // ≤7 (kanon)
const CHART_KINDS = new Set(['bar', 'line', 'pie', 'donut', 'scatter', 'area']);
const CALLOUT_TONES = new Set(['info', 'warning', 'danger', 'success']);

// ──────────────────────────────────────────────────────────────
// Public contract (mirror docScoring DocBlockType / DocumentArtifact)
// ──────────────────────────────────────────────────────────────
export type ContentBlockType =
  | 'heading'
  | 'text'
  | 'bulletList'
  | 'numberedList'
  | 'quote'
  | 'callout'
  | 'chart'
  | 'table'
  | 'kpi'
  | 'image'
  | 'divider';

export interface ContentBlock {
  blockId: string;
  type: ContentBlockType;
  content: Record<string, unknown>;
}

export interface ContentSection {
  sectionId: string;
  heading?: string;
  blocks: ContentBlock[];
}

export interface GeneratedDocumentContent {
  sections: ContentSection[];
  citations?: Array<{ id: string; ref: string }>;
  tierUsed: 'PREMIUM' | 'STANDARD';
  fallbackUsed: boolean;
}

/** Wejście: plan struktury (z B3) — typy bloków per sekcja. */
export interface StructurePlanInput {
  sections: Array<{
    title: string;
    purpose?: string;
    blocks: Array<{ type: string; hint: string }>;
  }>;
}

export interface GenerateContentOptions {
  orgId: string;
  userId?: string;
  preferPremium?: boolean;
  /** Ile cytowań wstrzyknąć (gdy dokument źródłowy). */
  citationCount?: number;
}

// ──────────────────────────────────────────────────────────────
// Mapowanie B3 type → ContentBlockType
// ──────────────────────────────────────────────────────────────
const B3_TO_CONTENT: Record<string, ContentBlockType> = {
  heading: 'heading',
  paragraph: 'text',
  bullet_list: 'bulletList',
  numbered_list: 'numberedList',
  quote: 'quote',
  callout: 'callout',
  chart: 'chart',
  table: 'table',
  risk_table: 'table',
  kpi_strip: 'kpi',
  image: 'image',
  footnote: 'text',
  citation: 'text',
};

function mapType(b3Type: string): ContentBlockType {
  return B3_TO_CONTENT[b3Type] ?? 'text';
}

// ──────────────────────────────────────────────────────────────
// Normalizery treści per typ
// ──────────────────────────────────────────────────────────────

function clampNumber(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(lo, Math.min(hi, v));
}

/** KPI strip: 3-5 itemów {label, value, delta}. */
export function normalizeKpiContent(raw: unknown): Record<string, unknown> {
  const rawItems = Array.isArray((raw as any)?.items) ? (raw as any).items : [];
  let items = rawItems
    .filter((it: any) => it && typeof it === 'object')
    .map((it: any) => ({
      label: String(it.label ?? '').trim() || 'Metric',
      value: String(it.value ?? '').trim() || '—',
      delta: String(it.delta ?? '').trim() || '0',
    }));
  // Clamp do [3,5]: dopełnij placeholderami lub przytnij.
  if (items.length > KPI_MAX) items = items.slice(0, KPI_MAX);
  while (items.length < KPI_MIN) {
    items.push({ label: `Metric ${items.length + 1}`, value: '—', delta: '0' });
  }
  return { items };
}

/** Chart: kind ważny, ≤6 serii, paleta ≤7 (clamp), title + osie. */
export function normalizeChartContent(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as any;
  const kind = CHART_KINDS.has(String(r.kind)) ? String(r.kind) : 'bar';
  const rawSeries = Array.isArray(r.series) ? r.series : [];
  const series = rawSeries
    .filter((s: any) => s && typeof s === 'object')
    .slice(0, CHART_MAX_SERIES)
    .map((s: any, i: number) => ({
      label: String(s.label ?? `Series ${i + 1}`),
      values: Array.isArray(s.values)
        ? s.values.map((v: any) => (typeof v === 'number' ? v : Number(v) || 0))
        : [],
      // Paleta clamp: kolor z palety per indeks (≤7), ignoruj surowy kolor LLM
      // jeśli spoza palety (gwarancja spójności).
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
  return {
    kind,
    title: String(r.title ?? '').trim() || 'Chart',
    xAxisLabel: String(r.xAxisLabel ?? '').trim() || 'oś X',
    yAxisLabel: String(r.yAxisLabel ?? '').trim() || 'oś Y',
    categories: Array.isArray(r.categories) ? r.categories.map(String) : undefined,
    series,
  };
}

/** Table: rows (cells keyed). Opcjonalnie styled cells (bgColor). */
export function normalizeTableContent(raw: unknown): Record<string, unknown> {
  const rawRows = Array.isArray((raw as any)?.rows) ? (raw as any).rows : [];
  const rows = rawRows
    .filter((row: any) => row && typeof row === 'object')
    .map((row: any) => {
      const cells = row.cells && typeof row.cells === 'object' ? row.cells : row;
      const outCells: Record<string, { value?: unknown; style?: { bgColor?: string } }> = {};
      for (const [k, v] of Object.entries(cells as Record<string, unknown>)) {
        if (v && typeof v === 'object' && 'value' in (v as any)) {
          outCells[k] = v as any;
        } else {
          outCells[k] = { value: v };
        }
      }
      return { cells: outCells };
    });
  return { rows };
}

/** Callout: text + tone ∈ {info, warning, danger, success}. */
export function normalizeCalloutContent(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as any;
  const tone = CALLOUT_TONES.has(String(r.tone)) ? String(r.tone) : 'info';
  return { text: String(r.text ?? '').trim() || 'Callout', tone };
}

function normalizeListContent(raw: unknown): Record<string, unknown> {
  const rawItems = Array.isArray((raw as any)?.items) ? (raw as any).items : [];
  const items = rawItems.map((it: any) => String(it ?? '').trim()).filter(Boolean);
  return { items: items.length > 0 ? items : ['—'] };
}

function normalizeQuoteContent(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as any;
  return {
    text: String(r.text ?? '').trim() || 'Quote',
    author: String(r.author ?? '').trim() || 'Anonim',
  };
}

function normalizeTextContent(raw: unknown, hint: string): Record<string, unknown> {
  const text = String((raw as any)?.text ?? '').trim() || hint || 'Treść.';
  return { text };
}

/** Dyspozytor normalizera per typ. */
function normalizeBlockContent(
  type: ContentBlockType,
  raw: unknown,
  hint: string
): Record<string, unknown> {
  switch (type) {
    case 'kpi':
      return normalizeKpiContent(raw);
    case 'chart':
      return normalizeChartContent(raw);
    case 'table':
      return normalizeTableContent(raw);
    case 'callout':
      return normalizeCalloutContent(raw);
    case 'bulletList':
    case 'numberedList':
      return normalizeListContent(raw);
    case 'quote':
      return normalizeQuoteContent(raw);
    case 'heading':
      return { text: String((raw as any)?.text ?? '').trim() || hint };
    case 'image':
      return { alt: String((raw as any)?.alt ?? '').trim() || hint, url: (raw as any)?.url ?? null };
    case 'divider':
      return {};
    default:
      return normalizeTextContent(raw, hint);
  }
}

// ──────────────────────────────────────────────────────────────
// Fallback prozowy (STANDARD lub LLM fail)
// ──────────────────────────────────────────────────────────────
function buildProseFallback(plan: StructurePlanInput): ContentSection[] {
  return plan.sections.map((s, si) => ({
    sectionId: `sec-${si}`,
    heading: s.title,
    blocks: [
      { blockId: `b-${si}-h`, type: 'heading' as const, content: { text: s.title } },
      {
        blockId: `b-${si}-p`,
        type: 'text' as const,
        content: { text: s.purpose || s.title || 'Treść sekcji.' },
      },
    ],
  }));
}

// ──────────────────────────────────────────────────────────────
// LLM content fill (premium)
// ──────────────────────────────────────────────────────────────
async function fillViaLlm(
  intent: string,
  plan: StructurePlanInput
): Promise<Map<string, unknown> | null> {
  const { llmService } = await import('../ai/llmService.js');
  const { z } = await import('zod');

  // Spłaszcz plan do listy bloków z blockId — LLM wypełnia content per blockId.
  const blockSpecs: Array<{ blockId: string; type: ContentBlockType; hint: string }> = [];
  plan.sections.forEach((s, si) => {
    s.blocks.forEach((b, bi) => {
      blockSpecs.push({ blockId: `b-${si}-${bi}`, type: mapType(b.type), hint: b.hint });
    });
  });

  const specList = blockSpecs
    .map((b) => `- ${b.blockId} (${b.type}): ${b.hint}`)
    .join('\n');

  const systemPrompt =
    'You are a document content writer (McKinsey / Kimi-Claude quality). For each ' +
    'block spec, produce its content matching the block TYPE:\n' +
    '- kpi: {items:[{label, value, delta}]} (3-5 items)\n' +
    '- chart: {kind: bar|line|pie|donut|scatter|area, title, xAxisLabel, yAxisLabel, series:[{label, values:number[]}]} (≤6 series)\n' +
    '- table: {rows:[{cells:{colKey:{value}}}]}\n' +
    '- callout: {text, tone: info|warning|danger|success}\n' +
    '- bulletList/numberedList: {items:[string]}\n' +
    '- quote: {text, author}\n' +
    '- text/heading: {text}\n' +
    'Reply with ONLY a JSON object: {blocks:[{blockId, content}]}.';

  const OutputSchema = z.object({
    blocks: z.array(z.object({ blockId: z.string(), content: z.record(z.string(), z.unknown()) })),
  });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: { id: 'premium' },
    systemPrompt,
    messages: [{ role: 'user', content: `Intent: "${intent}"\nBlocks:\n${specList}` }],
    schema: OutputSchema,
    maxTokens: 3000,
    temperature: 0.3,
    cache: false,
  });

  const obj = (result as any)?.object;
  const rawBlocks: unknown[] = Array.isArray(obj?.blocks) ? obj.blocks : [];
  if (rawBlocks.length === 0) return null;

  const byId = new Map<string, unknown>();
  for (const b of rawBlocks) {
    const id = (b as any)?.blockId;
    if (typeof id === 'string') byId.set(id, (b as any)?.content);
  }
  return byId;
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
/**
 * Wypełnia plan struktury (z B3) treścią bloków. PREMIUM → LLM content +
 * normalizery; STANDARD lub fail → prozowy fallback. NIGDY nie rzuca.
 */
export async function generateDocumentContent(
  intent: string,
  plan: StructurePlanInput,
  opts: GenerateContentOptions
): Promise<GeneratedDocumentContent> {
  const safePlan: StructurePlanInput = {
    sections: Array.isArray(plan?.sections) ? plan.sections : [],
  };

  let tier: 'PREMIUM' | 'STANDARD';
  try {
    tier = resolveDeliverableTier({ orgId: opts?.orgId, preferPremium: opts?.preferPremium });
  } catch {
    tier = 'STANDARD';
  }

  const citations =
    opts?.citationCount && opts.citationCount > 0
      ? Array.from({ length: opts.citationCount }, (_, i) => ({
          id: `c${i + 1}`,
          ref: `Source ${i + 1} (2026)`,
        }))
      : undefined;

  if (tier !== 'PREMIUM') {
    return {
      sections: buildProseFallback(safePlan),
      citations,
      tierUsed: 'STANDARD',
      fallbackUsed: true,
    };
  }

  try {
    const contentById = await fillViaLlm(intent, safePlan);
    if (!contentById) {
      logger.warn(`${LOG_PREFIX} LLM returned no content, prose fallback`, {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
        orgId: opts?.orgId,
      });
      return {
        sections: buildProseFallback(safePlan),
        citations,
        tierUsed: 'PREMIUM',
        fallbackUsed: true,
      };
    }

    const sections: ContentSection[] = safePlan.sections.map((s, si) => ({
      sectionId: `sec-${si}`,
      heading: s.title,
      blocks: s.blocks.map((b, bi) => {
        const blockId = `b-${si}-${bi}`;
        const type = mapType(b.type);
        const raw = contentById.get(blockId);
        return { blockId, type, content: normalizeBlockContent(type, raw, b.hint) };
      }),
    }));

    logger.info(`${LOG_PREFIX} premium content`, {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts?.orgId,
      sections: sections.length,
    });

    return { sections, citations, tierUsed: 'PREMIUM', fallbackUsed: false };
  } catch (err) {
    logger.warn(`${LOG_PREFIX} content generation failed, prose fallback`, {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts?.orgId,
      err: (err as Error)?.message,
    });
    return {
      sections: buildProseFallback(safePlan),
      citations,
      tierUsed: 'PREMIUM',
      fallbackUsed: true,
    };
  }
}
