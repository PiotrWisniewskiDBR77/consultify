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

import logger from '../../utils/Logger.js';
import {
  DELIVERABLE_GENERATION_PURPOSE,
  deliverableModelConfig,
  resolveDeliverableTier,
} from '../deliverableGenerationTier.js';
import { resolveDeliverableDefaults } from '../deliverables/deliverableDefaults.js';

const LOG_PREFIX = '[docContentGen]';

// Założenia raportu (F1.1) — gęstość prozy sterowana defaultem, nie hardcode.
const REPORT_DEFAULTS = resolveDeliverableDefaults('report');
const DENSITY_WORDS: Record<string, string> = {
  concise: '40-70 words per text block',
  standard: '70-110 words per text block',
  detailed: '110-160 words per text block',
};
const DENSITY_GUIDANCE = DENSITY_WORDS[REPORT_DEFAULTS.content.density] ?? DENSITY_WORDS.standard;

// ──────────────────────────────────────────────────────────────
// Parametry graficzne
// ──────────────────────────────────────────────────────────────
const KPI_MIN = 3;
const KPI_MAX = 5;
const CHART_MAX_SERIES = 6;
const CHART_PALETTE = ['#2563EB', '#0D9488', '#7C3AED', '#DC2626', '#EA580C', '#0891B2', '#65A30D']; // ≤7 (kanon)
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
  /** Deterministic post-generation guard found and removed an unsupported claim. */
  isAssumption?: boolean;
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
  const rawItems = Array.isArray((raw as any)?.items)
    ? (raw as any).items
    : Array.isArray((raw as any)?.kpis)
      ? (raw as any).kpis
      : [];
  let items = rawItems
    .filter((it: any) => it && typeof it === 'object')
    .map((it: any) => ({
      label: String(it.label ?? '').trim() || 'Metric',
      value: String(it.value ?? '').trim() || '—',
      delta: String(it.delta ?? '').trim() || '—',
    }));
  // Clamp do [3,5]: dopełnij placeholderami lub przytnij.
  if (items.length > KPI_MAX) items = items.slice(0, KPI_MAX);
  while (items.length < KPI_MIN) {
    items.push({
      label: `Metric ${String.fromCharCode(65 + items.length)}`,
      value: '—',
      delta: '—',
    });
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
  const rawColumns = Array.isArray((raw as any)?.columns)
    ? (raw as any).columns.map((column: unknown) => String(column))
    : Array.isArray((raw as any)?.headers)
      ? (raw as any).headers.map((column: unknown) => String(column))
      : [];
  const rawRows = Array.isArray((raw as any)?.rows) ? (raw as any).rows : [];
  const keyedRows = rawRows.filter((row: any) => row && typeof row === 'object');
  const inferredKeys: string[] = [];
  for (const row of keyedRows) {
    if (Array.isArray(row)) continue;
    const cells = row.cells && typeof row.cells === 'object' ? row.cells : row;
    for (const key of Object.keys(cells)) {
      if (!inferredKeys.includes(key)) inferredKeys.push(key);
    }
  }
  const columns = rawColumns.length > 0 ? rawColumns : inferredKeys;
  const rows = keyedRows.map((row: any) => {
    if (Array.isArray(row)) return row.map((value: unknown) => String(value ?? ''));
    const cells = row.cells && typeof row.cells === 'object' ? row.cells : row;
    return columns.map((key) => {
      const value = (cells as Record<string, unknown>)[key];
      return String(
        value && typeof value === 'object' && 'value' in value
          ? ((value as any).value ?? '')
          : (value ?? '')
      );
    });
  });
  return { columns, rows };
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

// ──────────────────────────────────────────────────────────────
// Citations (PREMIUM, sourced/diagnostic docs)
// ──────────────────────────────────────────────────────────────

/** Placeholder cytowania — fallback gdy LLM padnie / tier STANDARD. */
function placeholderCitations(n: number): Array<{ id: string; ref: string }> {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, ref: `Source ${i + 1} (2026)` }));
}

/**
 * Czy intent IMPLIKUJE dokument źródłowy/diagnostyczny (raport oparty o dane,
 * ankietę, badanie, audyt)? Wtedy generujemy cytowania nawet bez explicit
 * citationCount. Heurystyka leksykalna PL/EN — celowo konserwatywna.
 */
const SOURCED_INTENT_RE =
  /\b(raport|report|diagnoz|diagnost|audyt|audit|ankiet|survey|badani|research|study|gotowo|readiness|analiz|analysis|metodyk|methodolog|źród|source|evidence|wnioski|findings)\w*/i;

function intentImpliesSources(intent: string): boolean {
  return typeof intent === 'string' && SOURCED_INTENT_RE.test(intent);
}

const CITATION_SYSTEM_PROMPT =
  'You produce a SHORT structured source list ("works cited") for a business / ' +
  'consulting report. The references must be ILLUSTRATIVE and GROUNDED in the ' +
  "report's own subject — name the surveys, datasets, frameworks, internal reports " +
  'or methodologies the report itself would plausibly draw on (e.g. "Ankieta ' +
  'diagnostyczna VTS Group, fala 2, 2026 (n=131)", "Raport gotowości AI — metodyka ' +
  '5-wymiarowa, DBR77 2026"). DO NOT invent precise external academic citations, DOI, ' +
  'page numbers, or real third-party authors/publishers — keep them internal/illustrative ' +
  'and tied to the intent. Match the language of the intent. Each ref is ONE concise line. ' +
  'Reply with ONLY a JSON object: {citations:[{ref}]} (no ids — caller assigns them).';

/**
 * Generuje SENSOWNE cytowania (strukturalna lista odrębna od prozy) jednym tanim
 * callem LLM. FAIL-OPEN: każdy błąd / pusty wynik → placeholdery o długości `want`.
 * NIGDY nie rzuca, NIGDY nie blokuje treści.
 */
async function generateCitations(
  intent: string,
  want: number
): Promise<Array<{ id: string; ref: string }>> {
  if (want <= 0) return [];
  try {
    const { llmService } = await import('../ai/llmService.js');
    const { z } = await import('zod');

    // Schema z czystych STRINGÓW (ten sam wzorzec co content-fill) — strukturalny
    // model (Qwen/OpenRouter, Anthropic) spełnia ją trywialnie, zero schema-fall-through.
    const OutputSchema = z.object({
      citations: z.array(z.object({ ref: z.string() })),
    });

    const result = await llmService.call({
      type: 'structured',
      modelConfig: deliverableModelConfig(),
      systemPrompt: CITATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Report intent: "${intent}"\nProduce EXACTLY ${want} reference line(s).`,
        },
      ],
      schema: OutputSchema,
      maxTokens: 700,
      temperature: 0.3,
      cache: false,
      timeoutMs: 30000,
    });

    const obj = (result as { object?: { citations?: unknown[] } })?.object;
    const rawCitations: unknown[] = Array.isArray(obj?.citations) ? obj!.citations! : [];
    const refs = rawCitations
      .map((c) => String((c as { ref?: unknown })?.ref ?? '').trim())
      .filter((r) => r.length > 0);

    if (refs.length === 0) {
      logger.warn(`${LOG_PREFIX} citation LLM returned none, placeholder fallback`, {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
      });
      return placeholderCitations(want);
    }

    // Przytnij do want; dopełnij placeholderami gdy model zwrócił za mało
    // (kontrakt: ≥want strukturalnych cytowań odrębnych od prozy).
    const out = refs.slice(0, want).map((ref, i) => ({ id: `c${i + 1}`, ref }));
    for (let i = out.length; i < want; i++) {
      out.push({ id: `c${i + 1}`, ref: `Source ${i + 1} (2026)` });
    }
    return out;
  } catch (err) {
    logger.warn(`${LOG_PREFIX} citation generation failed, placeholder fallback`, {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      err: (err as Error)?.message,
    });
    return placeholderCitations(want);
  }
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
      return {
        alt: String((raw as any)?.alt ?? '').trim() || hint,
        url: (raw as any)?.url ?? null,
      };
    case 'divider':
      return {};
    default:
      return normalizeTextContent(raw, hint);
  }
}

// ──────────────────────────────────────────────────────────────
// Deterministic grounding guard (post-LLM, before canonical schema)
// ──────────────────────────────────────────────────────────────

const QUANT_TOKEN_RE = /\d+(?:[.,]\d+)?/g;
const SAFE_BUSINESS_ACRONYMS = new Set([
  'AI',
  'CEO',
  'CFO',
  'EUR',
  'GBP',
  'IT',
  'KPI',
  'PLN',
  'PMO',
  'RAG',
  'ROI',
  'USD',
]);
const POLISH_INTENT_RE =
  /[ąćęłńóśźż]|\b(raport|zarząd|zarzadu|ryzyko|ryzyka|wpływ|wplyw|właściciel|wlasciciel|mitygacja|inicjatyw|budżet|budzet|postęp|postep)\b/i;
const POLISH_HEADER_TRANSLATIONS: Record<string, string> = {
  risk: 'Ryzyko',
  likelihood: 'Prawdopodobieństwo',
  impact: 'Wpływ',
  owner: 'Właściciel',
  mitigation: 'Mitygacja',
  status: 'Status',
  metric: 'Metryka',
  value: 'Wartość',
  target: 'Cel',
  severity: 'Waga',
  'total budget': 'Łączny budżet',
  'plan realization': 'Realizacja planu',
  'milestones completed': 'Ukończone kamienie milowe',
  'budget overrun': 'Przekroczenie budżetu',
  high: 'Wysokie',
  medium: 'Średnie',
  low: 'Niskie',
};

function groundingPlaceholder(language: 'pl' | 'en'): string {
  return language === 'pl'
    ? 'Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).'
    : 'Content removed — unsupported claim (assumption to verify).';
}

function unsupportedClaimInString(
  text: string,
  allowedNumbers: ReadonlySet<string>,
  sourceTextUpper: string
): boolean {
  const numericTokens: string[] = text.match(QUANT_TOKEN_RE) ?? [];
  if (numericTokens.some((token) => !allowedNumbers.has(token.replace(',', '.')))) return true;

  // Catch obvious invented named market/entity claims such as "DACH". This is
  // deliberately conservative: normal business abbreviations stay allowed,
  // while a new all-caps name must occur in the brief/source text verbatim.
  const acronyms = text.match(/\b[A-ZĄĆĘŁŃÓŚŹŻ]{2,}\b/g) ?? [];
  return acronyms.some((token) => {
    if (SAFE_BUSINESS_ACRONYMS.has(token)) return false;
    const index = sourceTextUpper.indexOf(token);
    if (index < 0) return true;
    // Merely mentioning a value in a negative constraint ("bez DACH", "zakaz
    // DACH") is not evidence that the named claim is allowed. This was the
    // EPSILON leak: the forbidden example itself accidentally became allowlist.
    const before = sourceTextUpper.slice(Math.max(0, index - 60), index);
    return /\b(BEZ|ZAKAZ|NIE UŻYWAJ|NIE UZYWAJ|NIEDOZWOLON|WYKLUCZ)\b/.test(before);
  });
}

/**
 * Removes unsupported quantitative (and obvious named acronym) claims from one
 * normalized LLM block. It never relies on the model's self-report. The caller
 * receives an explicit `changed` bit which becomes `isAssumption` in the
 * canonical DocumentSchema and therefore feeds EvidenceContract/QA.
 */
export function enforceBlockGrounding(
  content: Record<string, unknown>,
  sourceText: string
): { content: Record<string, unknown>; changed: boolean } {
  const language: 'pl' | 'en' = POLISH_INTENT_RE.test(sourceText) ? 'pl' : 'en';
  const allowedNumbers = new Set(
    (sourceText.match(QUANT_TOKEN_RE) ?? []).map((token) => token.replace(',', '.'))
  );
  const sourceTextUpper = sourceText.toUpperCase();
  let changed = false;

  const visit = (value: unknown, key?: string): unknown => {
    if (typeof value === 'number') {
      if (allowedNumbers.has(String(value))) return value;
      changed = true;
      return undefined;
    }
    if (typeof value === 'string') {
      if (key === 'bgColor' || key === 'color' || key === 'url') return value;
      if (unsupportedClaimInString(value, allowedNumbers, sourceTextUpper)) {
        changed = true;
        return groundingPlaceholder(language);
      }
      if (language === 'pl') {
        return POLISH_HEADER_TRANSLATIONS[value.trim().toLowerCase()] ?? value;
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => visit(entry, key)).filter((entry) => entry !== undefined);
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        const mapped = visit(childValue, childKey);
        if (mapped !== undefined) out[childKey] = mapped;
      }
      return out;
    }
    return value;
  };

  const guarded = visit(content) as Record<string, unknown>;
  if (language === 'pl' && Array.isArray(guarded.columns)) {
    guarded.columns = guarded.columns.map((column) =>
      typeof column === 'string'
        ? (POLISH_HEADER_TRANSLATIONS[column.trim().toLowerCase()] ?? column)
        : column
    );
  }
  return { content: guarded, changed };
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
const CONTENT_SYSTEM_PROMPT =
  'You are a document content writer (McKinsey / Kimi-Claude quality). For each ' +
  'block spec, produce its content matching the block TYPE. The content of each ' +
  'block is a JSON OBJECT, but you MUST return it as a STRING (a serialized JSON ' +
  'object) in the `contentJson` field — escape inner quotes properly. Shapes per type:\n' +
  '- kpi: {items:[{label, value, delta}]} — produce 3-5 items, BUT if the block hint ' +
  'states an exact count (e.g. "exactly 3", "DOKŁADNIE 3", "5 KPI"), produce EXACTLY that ' +
  'many items. delta = a MEANINGFUL change vs a baseline like "+4 vs wave 1" or "▲ 12%". ' +
  'OMIT delta entirely when there is no baseline — never output "0")\n' +
  '- chart: {kind: bar|line|pie|donut|scatter|area, title, xAxisLabel, yAxisLabel, series:[{label, values:number[]}]} (≤6 series)\n' +
  '- table: {rows:[{cells:{colKey:{value, style?}}}]} (≤6 rows; concise cell values). For ' +
  'STATUS / SEVERITY / RISK / RATING tables, add per-cell conditional formatting: set ' +
  'style.bgColor to a semantic hex on the cells carrying the status — green #16A34A (good/low), ' +
  'amber #D97706 (medium), red #DC2626 (bad/high/critical). Example cell: {"value":"Wysokie","style":{"bgColor":"#DC2626"}}.\n' +
  '- callout: {text, tone: info|warning|danger|success}\n' +
  '- bulletList/numberedList: {items:[string]}\n' +
  '- quote: {text, author}\n' +
  '- text/heading: {text}\n' +
  `Density default (override only if the hint says otherwise): aim for ${DENSITY_GUIDANCE}.\n` +
  'Example block: {"blockId":"b-0-1","contentJson":"{\\"text\\":\\"...\\"}"}.\n' +
  'STRICT FACT RULE: do not introduce any number, percentage, currency amount, date, count, ratio, or duration that is not present verbatim in the Intent, Section goal, or block hint. If a quantitative value is needed but absent, write a qualitative statement or explicitly label it as an assumption; never manufacture a plausible value.\n' +
  'Reply with ONLY a JSON object: {blocks:[{blockId, contentJson}]}.\n';

/** Tolerant JSON parse for a per-block contentJson string. Returns {} on failure. */
function parseBlockContentJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>; // already-parsed (defensive)
  if (typeof raw !== 'string') return {};
  let s = raw.trim();
  if (!s) return {};
  // Strip accidental markdown fences.
  s = s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    // Best-effort: isolate the outermost {...} (model sometimes adds a trailing note).
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(s.slice(start, end + 1));
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        /* give up → normalizer defaults this block */
      }
    }
    return {};
  }
}

/**
 * Wypełnia treścią bloki JEDNEJ sekcji (jeden mały call LLM). Zwraca mapę
 * blockId→content lub `null` gdy LLM nie dał użytecznego wyniku.
 *
 * DLACZEGO per-sekcja: wcześniej był JEDEN call dla WSZYSTKICH bloków dokumentu.
 * Przy bogatym, wielosekcyjnym dokumencie (kpi+chart+table+callout×N) ten call
 * przekraczał 60s abort (zmierzone: 247s → timeout → fallback do prozy). Podział
 * per sekcja = każdy call mały i szybki, w budżecie; porażka jednej sekcji
 * degraduje tylko ją, nie cały dokument.
 */
async function fillSectionViaLlm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmService: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  z: any,
  intent: string,
  section: StructurePlanInput['sections'][number],
  sectionIndex: number
): Promise<Map<string, unknown> | null> {
  const blockSpecs = section.blocks.map((b, bi) => ({
    blockId: `b-${sectionIndex}-${bi}`,
    type: mapType(b.type),
    hint: b.hint,
  }));
  const specList = blockSpecs.map((b) => `- ${b.blockId} (${b.type}): ${b.hint}`).join('\n');

  // DLACZEGO contentJson:string a nie content:record — Anthropic `generateObject`
  // buduje STRICT JSON-schema z Zoda. `z.record(z.string(), z.unknown())` =
  // open-ended obiekt z zagnieżdżonymi tablicami (table rows, chart series) —
  // model strukturalny REGULARNIE go nie spełnia: "No object generated: response
  // did not match schema" na bogatych sekcjach (zmierzone: sekcja z kpi+table+
  // chart+3×callout = 4 retry × ~50s = 208s i fall-through do placeholderów,
  // a 5 takich porażek OTWIERA circuit-breaker i kaskadowo kładzie resztę sekcji).
  // Schema z samych STRINGÓW (blockId + contentJson) jest trywialnie spełnialna →
  // zero schema-fall-throughs; bogatą treść parsujemy sami z contentJson.
  const OutputSchema = z.object({
    blocks: z.array(z.object({ blockId: z.string(), contentJson: z.string() })),
  });

  const result = await llmService.call({
    type: 'structured',
    modelConfig: deliverableModelConfig(),
    systemPrompt: CONTENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        // Carry section.purpose too — quantitative cues ("exactly 3 KPIs", status
        // table) live there and must reach the writer even if B3 trimmed them from
        // the per-block hint.
        content:
          `Intent: "${intent}"\nSection: "${section.title}"` +
          `${section.purpose ? `\nSection goal: ${section.purpose}` : ''}\nBlocks:\n${specList}`,
      },
    ],
    schema: OutputSchema,
    maxTokens: 4000,
    temperature: 0.3,
    cache: false,
    // Bogata sekcja bywa wolna; 60s czasem za mało.
    timeoutMs: 120000,
  });

  const obj = (result as { object?: { blocks?: unknown[] } })?.object;
  const rawBlocks: unknown[] = Array.isArray(obj?.blocks) ? obj!.blocks! : [];
  if (rawBlocks.length === 0) return null;

  const byId = new Map<string, unknown>();
  for (const b of rawBlocks) {
    const id = (b as { blockId?: unknown })?.blockId;
    if (typeof id === 'string') {
      const rawContent =
        (b as { contentJson?: unknown; content?: unknown })?.contentJson ??
        (b as { content?: unknown })?.content; // back-compat if model still nests an object
      byId.set(id, parseBlockContentJson(rawContent));
    }
  }
  return byId;
}

/**
 * Wypełnia plan treścią — JEDEN call LLM per sekcja, RÓWNOLEGLE (Promise.allSettled).
 * Łączy wyniki; gdy CHOĆ JEDNA sekcja się powiodła → zwraca mapę (reszta bloków
 * dostanie default w normalizerze). Gdy WSZYSTKIE padły → `null` (caller → proza).
 */
async function fillViaLlm(
  intent: string,
  plan: StructurePlanInput
): Promise<Map<string, unknown> | null> {
  const { llmService } = await import('../ai/llmService.js');
  const { z } = await import('zod');

  // Batchuj po CONCURRENCY sekcji naraz (nie wszystkie równolegle). Powód: przy
  // dużym raporcie (8+ sekcji) jednoczesne wszystkie calle mogą spiętrzyć ≥5
  // wolnych/abort → otwarcie circuit-breakera anthropic → reszta pada → cały
  // dokument do prozy (zmierzone na doc S16). Batch 3 trzyma równoległość małą,
  // a sukcesy między batchami resetują licznik błędów breakera.
  const CONCURRENCY = 3;
  const merged = new Map<string, unknown>();
  let anyOk = false;

  for (let start = 0; start < plan.sections.length; start += CONCURRENCY) {
    const batch = plan.sections.slice(start, start + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((s, bi) => fillSectionViaLlm(llmService, z, intent, s, start + bi))
    );
    settled.forEach((res, bi) => {
      const si = start + bi;
      if (res.status === 'fulfilled' && res.value && res.value.size > 0) {
        anyOk = true;
        for (const [k, v] of res.value) merged.set(k, v);
      } else {
        const reason = res.status === 'rejected' ? (res.reason as Error)?.message : 'empty result';
        logger.warn(`${LOG_PREFIX} section ${si} content failed, will default its blocks`, {
          purpose: DELIVERABLE_GENERATION_PURPOSE,
          reason,
        });
      }
    });
  }

  return anyOk ? merged : null;
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

  // Ile cytowań chcemy: explicit citationCount, ALBO (gdy nie podano) heurystyka —
  // intent diagnostyczny/źródłowy → domyślnie 3 (raport oparty o dane/badanie).
  const DEFAULT_SOURCED_CITATIONS = 3;
  const wantCitations =
    opts?.citationCount && opts.citationCount > 0
      ? opts.citationCount
      : intentImpliesSources(intent)
        ? DEFAULT_SOURCED_CITATIONS
        : 0;

  // STANDARD lub brak źródeł → zachowanie jak dotąd (placeholdery lub brak).
  if (tier !== 'PREMIUM') {
    return {
      sections: buildProseFallback(safePlan),
      citations: wantCitations > 0 ? placeholderCitations(wantCitations) : undefined,
      tierUsed: 'STANDARD',
      fallbackUsed: true,
    };
  }

  try {
    // KOLEJNOŚĆ: content-fill NAJPIERW (ma pierwszeństwo dostępu do LLM), DOPIERO
    // POTEM cytowania (osobny, tani call). generateCitations jest fail-open —
    // nigdy nie rzuca, placeholder fallback wbudowany.
    const contentById = await fillViaLlm(intent, safePlan);
    const citations =
      wantCitations > 0 ? await generateCitations(intent, wantCitations) : undefined;

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
        const normalized =
          type === 'heading' ? { text: s.title } : normalizeBlockContent(type, raw, b.hint);
        const guarded = enforceBlockGrounding(normalized, intent);
        return {
          blockId,
          type,
          content: guarded.content,
          isAssumption: guarded.changed,
        };
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
      // Ścieżka błędu → placeholdery (kontrakt: wantCitations strukturalnych pozycji).
      citations: wantCitations > 0 ? placeholderCitations(wantCitations) : undefined,
      tierUsed: 'PREMIUM',
      fallbackUsed: true,
    };
  }
}
