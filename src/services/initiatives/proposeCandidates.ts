/**
 * proposeCandidates — additive "propose candidates" engine (Faza 2b).
 *
 * Turns a SOURCE (an insight / gap / free text) into candidate initiatives that the
 * Initiative Generator then reconciles against the living grid via
 * `reconcileProposals` (see proposalReconciliation.ts). This module ONLY produces
 * candidates; classification/coverage stays in the reconciliation core.
 *
 * Design: AI-FIRST with a DETERMINISTIC FALLBACK.
 *   1) First we try a backend/AI endpoint (`POST /initiatives/propose`) wrapped in a
 *      timeout (Promise.race) + try/catch. This endpoint is TBD / not guaranteed to
 *      exist yet — every call site is GUARDED so a missing/erroring endpoint is a
 *      no-op, not a crash.
 *   2) If the endpoint errors, times out, or yields nothing, we fall back to a pure,
 *      deterministic text parser that extracts candidate titles from the source text
 *      (lines / sentences that look like problems or recommendations, PL + EN).
 *
 * Because the cheap AI stack frequently times out, the fallback MUST always yield at
 * least one sensible candidate. This function NEVER throws.
 */

import { Api } from '../api';
import type { CandidateInput } from './proposalReconciliation';

export interface ProposeSource {
  text: string;
  label?: string;
  goalKeys?: string[];
}

export interface ProposeOptions {
  maxCandidates?: number;
  timeoutMs?: number;
  projectId?: string;
}

const DEFAULT_MAX = 5;
const DEFAULT_TIMEOUT_MS = 8000;
const TITLE_MAX = 80;

/** Verbs that mark a line as a problem / recommendation (PL + EN). */
const ACTION_VERBS = [
  // EN
  'reduce',
  'improve',
  'standardize',
  'standardise',
  'implement',
  'launch',
  'fix',
  'increase',
  'decrease',
  'eliminate',
  'automate',
  'optimize',
  'optimise',
  'streamline',
  'introduce',
  'build',
  'create',
  'migrate',
  'consolidate',
  'redesign',
  'remove',
  'deploy',
  'integrate',
  // PL
  'zredukować',
  'zmniejszyć',
  'poprawić',
  'usprawnić',
  'ustandaryzować',
  'standaryzować',
  'wdrożyć',
  'uruchomić',
  'naprawić',
  'zwiększyć',
  'wyeliminować',
  'zautomatyzować',
  'zoptymalizować',
  'wprowadzić',
  'zbudować',
  'stworzyć',
  'utworzyć',
  'zmigrować',
  'skonsolidować',
  'przeprojektować',
  'usunąć',
  'zintegrować',
];

interface RawCandidate {
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  goalKey?: unknown;
  novelScope?: unknown;
}

/** A line "looks actionable" if it is a bullet or contains an action verb. */
function looksActionable(line: string): boolean {
  const lower = line.toLowerCase();
  if (/^\s*([-*•·–]|\d+[.)])\s+/.test(line)) return true;
  return ACTION_VERBS.some((v) => lower.includes(v));
}

/** Strip leading bullets/numbering and surrounding whitespace. */
function cleanLine(line: string): string {
  return line
    .replace(/^\s*([-*•·–]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clamp a title to TITLE_MAX chars on a word boundary where possible. */
function toTitle(text: string): string {
  const t = text.trim();
  if (t.length <= TITLE_MAX) return t;
  const slice = t.slice(0, TITLE_MAX);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
}

/** Cap a list of candidates and dedupe by lowercased title. */
function dedupeAndCap(candidates: CandidateInput[], max: number): CandidateInput[] {
  const seen = new Set<string>();
  const out: CandidateInput[] = [];
  for (const c of candidates) {
    const key = c.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** Map a loosely-typed backend candidate into a strict CandidateInput. */
function mapRawCandidate(raw: RawCandidate, fallbackGoalKey?: string): CandidateInput | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const candidate: CandidateInput = { title: toTitle(title) };

  if (typeof raw.description === 'string' && raw.description.trim()) {
    candidate.description = raw.description.trim();
  }
  if (Array.isArray(raw.tags)) {
    const tags = raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    if (tags.length) candidate.tags = tags;
  }
  const goalKey =
    typeof raw.goalKey === 'string' && raw.goalKey.trim() ? raw.goalKey : fallbackGoalKey;
  if (goalKey) candidate.goalKey = goalKey;
  if (typeof raw.novelScope === 'boolean') candidate.novelScope = raw.novelScope;

  return candidate;
}

/** Pull a candidate array out of whatever shape the endpoint returned. */
function extractRawCandidates(payload: unknown): RawCandidate[] {
  if (Array.isArray(payload)) return payload as RawCandidate[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const data = obj.data;
    if (Array.isArray(obj.candidates)) return obj.candidates as RawCandidate[];
    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as Record<string, unknown>).candidates)
    ) {
      return (data as Record<string, unknown>).candidates as RawCandidate[];
    }
    if (Array.isArray(data)) return data as RawCandidate[];
  }
  return [];
}

/** Race a promise against a timeout; resolves to null on timeout. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([p, timeout]).then((v) => {
    clearTimeout(timer);
    return v as T | null;
  });
}

/**
 * AI-first attempt. Returns mapped candidates on success, or null if the endpoint
 * is unavailable / errors / times out / yields nothing. NEVER throws.
 */
async function tryAiPropose(
  source: ProposeSource,
  max: number,
  timeoutMs: number,
  projectId?: string
): Promise<CandidateInput[] | null> {
  try {
    const call = Api.post('/initiatives/propose', {
      text: source.text,
      goalKeys: source.goalKeys,
      max,
      projectId,
    });
    const res = await withTimeout(call, timeoutMs);
    if (!res) return null; // timeout

    const payload = (res as { data?: unknown }).data ?? res;
    const raw = extractRawCandidates(payload);
    if (!raw.length) return null;

    const mapped = raw
      .map((r) => mapRawCandidate(r, source.goalKeys?.[0]))
      .filter((c): c is CandidateInput => c !== null);

    if (!mapped.length) return null;
    return dedupeAndCap(mapped, max);
  } catch {
    return null; // endpoint TBD / network / parse error → fall back
  }
}

/** Deterministic fallback parser — pure, always yields ≥1 candidate. */
function fallbackParse(source: ProposeSource, max: number): CandidateInput[] {
  const text = source.text || '';
  const goalKey = source.goalKeys?.[0];

  // Split on newlines first; if the text is one blob, split on sentence boundaries.
  let segments = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    segments = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const candidates: CandidateInput[] = [];
  for (const seg of segments) {
    if (!looksActionable(seg)) continue;
    const cleaned = cleanLine(seg);
    if (!cleaned) continue;
    const candidate: CandidateInput = {
      title: toTitle(cleaned),
      description: seg.trim(),
    };
    if (goalKey) candidate.goalKey = goalKey;
    candidates.push(candidate);
  }

  const capped = dedupeAndCap(candidates, max);
  if (capped.length) return capped;

  // Nothing parsed → single safe candidate so the caller always has something.
  const fallback: CandidateInput = {
    title: toTitle(source.label || 'New initiative from source'),
    description: text.slice(0, 200),
  };
  if (goalKey) fallback.goalKey = goalKey;
  return [fallback];
}

/**
 * Propose candidate initiatives from a source. AI-first, deterministic fallback.
 * Always resolves to ≥1 candidate; never throws.
 */
export async function proposeCandidates(
  source: ProposeSource,
  opts?: ProposeOptions
): Promise<CandidateInput[]> {
  const max = Math.max(1, opts?.maxCandidates ?? DEFAULT_MAX);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const ai = await tryAiPropose(source, max, timeoutMs, opts?.projectId);
  if (ai && ai.length) return ai;

  return fallbackParse(source, max);
}
