/**
 * proposeEngineService — additive "propose candidates" engine (Faza 2b).
 *
 * Turns a SOURCE (insight / gap / free text) into candidate initiatives. AI-first
 * with a STRICT timeout and a deterministic fallback so the endpoint never hangs and
 * always degrades gracefully.
 *
 *   1) Try the existing cheap LLM service (server/src/services/ai/llmService.ts) with
 *      a structured prompt, wrapped in a hard Promise.race timeout (~6-8s). ZERO
 *      OpenAI-specific code — we use the shared llmService, which routes by tier.
 *   2) On timeout / error / unavailable / empty → return [] (the frontend has its own
 *      deterministic fallback). This service NEVER throws.
 */

import { CARD_CONTENT_FORMULA_A3_LITE } from './cardContentFormulaPrompt.js';

export interface ProposeCandidate {
  title: string;
  description?: string;
  goalKey?: string;
  tags?: string[];
  novelScope?: boolean;
}

export interface ProposeInput {
  text: string;
  goalKeys?: string[];
  max?: number;
  projectId?: string | null;
}

const DEFAULT_MAX = 5;
const HARD_CAP = 10;
const DEFAULT_TIMEOUT_MS = 7000;
const TITLE_MAX = 80;

let _llmServiceInstance: any = null;
let _llmLoadAttempted = false;

async function getLLMServiceInstance(): Promise<any | null> {
  if (_llmServiceInstance) return _llmServiceInstance;
  if (_llmLoadAttempted) return _llmServiceInstance;
  _llmLoadAttempted = true;
  try {
    const mod: any = await import('../ai/llmService.js');
    _llmServiceInstance = mod.llmService || mod.default || null;
  } catch {
    _llmServiceInstance = null;
  }
  return _llmServiceInstance;
}

/** Race a promise against a timeout; resolves to null on timeout. Never rejects on timeout. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([p.catch(() => null), timeout]).then((v) => {
    clearTimeout(timer);
    return v as T | null;
  });
}

function clampTitle(text: string): string {
  const t = String(text || '').trim();
  if (t.length <= TITLE_MAX) return t;
  const slice = t.slice(0, TITLE_MAX);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
}

function dedupeAndCap(candidates: ProposeCandidate[], max: number): ProposeCandidate[] {
  const seen = new Set<string>();
  const out: ProposeCandidate[] = [];
  for (const c of candidates) {
    const key = (c.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** Extract a candidate array from whatever shape the LLM returned. */
function extractRawCandidates(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) return obj.candidates as any[];
    if (Array.isArray(obj.initiatives)) return obj.initiatives as any[];
    if (Array.isArray(obj.items)) return obj.items as any[];
    const data = obj.data;
    if (Array.isArray(data)) return data as any[];
    if (data && typeof data === 'object' && Array.isArray((data as any).candidates)) {
      return (data as any).candidates as any[];
    }
  }
  return [];
}

function mapRawCandidate(raw: any, fallbackGoalKey?: string): ProposeCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const candidate: ProposeCandidate = { title: clampTitle(title) };

  if (typeof raw.description === 'string' && raw.description.trim()) {
    candidate.description = raw.description.trim();
  }
  if (Array.isArray(raw.tags)) {
    const tags = raw.tags.filter(
      (t: unknown): t is string => typeof t === 'string' && t.trim().length > 0
    );
    if (tags.length) candidate.tags = tags;
  }
  const goalKey =
    typeof raw.goalKey === 'string' && raw.goalKey.trim() ? raw.goalKey.trim() : fallbackGoalKey;
  if (goalKey) candidate.goalKey = goalKey;
  if (typeof raw.novelScope === 'boolean') candidate.novelScope = raw.novelScope;

  return candidate;
}

/** Pull the first JSON array/object out of an LLM text response (handles ```json fences). */
function parseLlmJson(content: string): unknown {
  const raw = String(content || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(body);
  } catch {
    // Try to isolate the first {...} or [...] block.
    const objMatch = body.match(/[[{][\s\S]*[\]}]/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Propose candidate initiatives from a source.
 * Returns [] on timeout / error / unavailable / empty. NEVER throws, NEVER hangs.
 */
export async function proposeCandidates(input: ProposeInput): Promise<ProposeCandidate[]> {
  const max = Math.min(HARD_CAP, Math.max(1, Number(input.max) || DEFAULT_MAX));
  const text = String(input.text || '').trim();
  if (!text) return [];

  const llm = await getLLMServiceInstance();
  if (!llm || typeof llm.call !== 'function') return [];

  const goalKeysLine =
    Array.isArray(input.goalKeys) && input.goalKeys.length > 0
      ? `Where a candidate clearly serves one of these goal keys, set its "goalKey": ${JSON.stringify(input.goalKeys)}.\n`
      : '';

  const systemPrompt =
    'You are a precise strategy analyst. Extract distinct, actionable INITIATIVE candidates ' +
    'from the provided source text. An initiative is a concrete change effort (project/program), ' +
    'not a vague aspiration. Respond ONLY with strict JSON, no prose, no markdown fences.\n' +
    // USPOJNIENIE C2 — lekka doktryna jakości tytułu/opisu (§A3 LITE), spójna ze
    // schematem kandydata (title+description). Pełny §A3 (KPI/RAID) dotyczy
    // enrichmentu pełnej karty, nie tej ekstrakcji.
    CARD_CONTENT_FORMULA_A3_LITE;

  const userPrompt =
    `From the SOURCE below, extract at most ${max} distinct initiative candidates.\n` +
    `${goalKeysLine}` +
    `Return JSON of the exact shape:\n` +
    `{"candidates":[{"title":"...","description":"...","goalKey":"...","tags":["..."],"novelScope":true}]}\n` +
    `Rules: "title" is required and concise (<= ${TITLE_MAX} chars). "description", "goalKey", "tags", "novelScope" are optional. ` +
    `If nothing actionable is present, return {"candidates":[]}. Detect the source language and keep titles in that language.\n\n` +
    `SOURCE:\n${text.slice(0, 8000)}`;

  let result: any = null;
  try {
    const call = llm.call({
      type: 'text',
      modelConfig: { id: 'budget' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1024,
      temperature: 0.2,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      // Avoid long retry tails — interactive endpoint must fail fast.
      breakerOptions: { maxRetries: 0, timeout: DEFAULT_TIMEOUT_MS },
      cache: true,
      cacheTtl: 600,
    });
    result = await withTimeout(call, DEFAULT_TIMEOUT_MS + 500);
  } catch {
    return [];
  }

  if (!result) return []; // timeout or null

  const content = typeof result?.content === 'string' ? result.content : '';
  const parsed = parseLlmJson(content);
  if (!parsed) return [];

  const raw = extractRawCandidates(parsed);
  if (!raw.length) return [];

  const fallbackGoalKey = input.goalKeys?.[0];
  const mapped = raw
    .map((r) => mapRawCandidate(r, fallbackGoalKey))
    .filter((c): c is ProposeCandidate => c !== null);

  return dedupeAndCap(mapped, max);
}
