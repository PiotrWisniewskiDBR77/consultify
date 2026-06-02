/**
 * Detects whether a chat message asks Teresa to WRITE INTO the open Canvas
 * document (vs. just chat about it). Returns the streaming mode to use, or null.
 *
 * Gated by the caller on an open canvas (activeCanvasDocument): the dispatched
 * 'canvas-stream-request' event is only meaningful while the rich editor is
 * mounted. Patterns require an explicit write verb + a document/canvas target
 * so ordinary chat ("what do you think about this?") is not hijacked.
 */

export type CanvasStreamMode = 'append' | 'replace' | 'generate';

const PATTERNS: Array<{ pattern: RegExp; mode: CanvasStreamMode }> = [
  // ── Replace the current selection / a specific part ──────────────
  // EN
  {
    pattern:
      /\b(rewrite|replace|revise)\b[^.]*\b(this|the)?\s*(selection|selected|paragraph|section|text|fragment)\b/i,
    mode: 'replace',
  },
  // PL
  {
    pattern:
      /\b(przepisz|zamień|zmień|popraw)\b[^.]*\b(to|zaznaczenie|zaznaczony|akapit|fragment|sekcj|tekst)/i,
    mode: 'replace',
  },

  // ── Write/append into the document ───────────────────────────────
  // EN
  {
    pattern:
      /\b(write|draft|compose|add|append|continue|expand|insert|put|fill)\b[^.]*\b(in|into|to|on)?\s*(the\s+)?(document|canvas|doc|here|page)\b/i,
    mode: 'append',
  },
  {
    pattern:
      /\b(write|draft|generate|compose)\s+(me\s+)?(a\s+|an\s+|the\s+)?(document|draft|section|paragraph|summary|outline|report)\b/i,
    mode: 'append',
  },
  // PL
  {
    pattern:
      /\b(napisz|dopisz|wpisz|dodaj|kontynuuj|rozwiń|uzupełnij|wstaw)\b[^.]*\b(w|do|na)?\s*(dokumen|canvas|kanw|tutaj|stron)/i,
    mode: 'append',
  },
  {
    pattern:
      /\b(napisz|stwórz|utwórz|wygeneruj|przygotuj)\s+(mi\s+)?(dokument|szkic|sekcj|akapit|podsumowanie|raport|konspekt)/i,
    mode: 'append',
  },
];

export function detectCanvasWriteIntent(message: string): CanvasStreamMode | null {
  const text = String(message || '').trim();
  if (!text) return null;
  for (const { pattern, mode } of PATTERNS) {
    if (pattern.test(text)) return mode;
  }
  return null;
}
