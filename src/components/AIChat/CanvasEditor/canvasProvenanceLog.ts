/**
 * canvasProvenanceLog (C6)
 *
 * Foundation for AI-provenance audit per span — the differentiator none of the
 * top-4 (Claude / ChatGPT / Gemini / Antigravity) ships. Every AI edit to the
 * canvas (apply diff, accept, reject) emits a structured event recorded to
 * localStorage so a regulated-industry audit conversation has answers like
 * "which paragraph did Teresa write, with what prompt, when, and was it kept?".
 *
 * Server-side persistence (writing into the draft's provenance_json column) is
 * a richer step left for a future session — this is the client foundation that
 * any future persistence layer can replay.
 */

export type ProvenanceEventKind = 'apply' | 'accept' | 'reject';

export interface ProvenanceEvent {
  kind: ProvenanceEventKind;
  at: number;
  prompt?: string;
  originalExcerpt?: string;
  replacementExcerpt?: string;
  selectionFrom?: number;
  selectionTo?: number;
}

const STORAGE_PREFIX = 'canvas.provenance.';
const MAX_EVENTS_PER_DRAFT = 200;
const EXCERPT_MAX = 480;

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope || 'unknown'}`;
}

export function readProvenanceLog(scope: string): ProvenanceEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS_PER_DRAFT) : [];
  } catch {
    return [];
  }
}

export function recordProvenanceEvent(scope: string, event: ProvenanceEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed: ProvenanceEvent = {
      ...event,
      prompt: event.prompt ? event.prompt.slice(0, EXCERPT_MAX) : undefined,
      originalExcerpt: event.originalExcerpt
        ? event.originalExcerpt.slice(0, EXCERPT_MAX)
        : undefined,
      replacementExcerpt: event.replacementExcerpt
        ? event.replacementExcerpt.slice(0, EXCERPT_MAX)
        : undefined,
    };
    const log = readProvenanceLog(scope);
    log.push(trimmed);
    window.localStorage.setItem(
      storageKey(scope),
      JSON.stringify(log.slice(-MAX_EVENTS_PER_DRAFT))
    );
  } catch {
    /* localStorage quota / SSR — non-fatal */
  }
}

export function clearProvenanceLog(scope: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}
