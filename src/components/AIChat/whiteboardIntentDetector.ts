/**
 * Detects if a chat message is a whiteboard/brainstorm/workshop intent.
 * Returns the best matching wb_* action if detected, or null.
 */

const WB_INTENT_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  // EN patterns
  {
    pattern: /\b(create|start|open|make)\s+(a\s+)?(brainstorm|whiteboard|workshop|board)\b/i,
    action: 'wb_add_sticky',
  },
  {
    pattern: /\b(organize|cluster|group)\s+(my\s+)?(notes|ideas|stickies|board)\b/i,
    action: 'wb_add_cluster',
  },
  { pattern: /\b(affinity|affinity\s*map)\b/i, action: 'wb_add_cluster' },
  { pattern: /\badd\s+(sticky|stickies|notes?)\b/i, action: 'wb_add_sticky' },
  { pattern: /\b(identify|extract)\s+(themes?|outcomes?|decisions?)\b/i, action: 'wb_add_theme' },
  // PL patterns
  {
    pattern:
      /\b(stwórz|utwórz|zacznij|otwórz)\s+(burz[eę]|tablicę|warsztat|board)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'wb_add_sticky',
  },
  {
    pattern: /\b(organizuj|grupuj|klasteryzuj)\s+(notatki|pomysły|board)\b/i,
    action: 'wb_add_cluster',
  },
  {
    pattern: /\bdodaj\s+(notatk[ięa]|karteczk[ięa])(?![a-ząćęłńóśźż0-9_])/i,
    action: 'wb_add_sticky',
  },
  { pattern: /\b(wyodrębnij|zidentyfikuj)\s+(temat|wynik|decyzj)\b/i, action: 'wb_add_theme' },
];

export function detectWhiteboardIntent(message: string): string | null {
  for (const { pattern, action } of WB_INTENT_PATTERNS) {
    if (pattern.test(message)) return action;
  }
  return null;
}
