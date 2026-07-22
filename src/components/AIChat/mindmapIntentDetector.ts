/**
 * Detects if a chat message is a mind map / idea map intent.
 * Returns the best matching mm_* action if detected, or null.
 */

const MM_INTENT_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  // EN patterns
  {
    pattern:
      /\b(create|start|build|make|open)\s+(a\s+)?(mind\s*map|idea\s*map|recommendation\s*map|concept\s*map)\b/i,
    action: 'mm_create',
  },
  {
    pattern:
      /\b(expand|explore|branch|decompose|break\s*down)\s+(the\s+)?(idea|node|branch|topic|concept)\b/i,
    action: 'mm_expand_branch',
  },
  {
    pattern: /\b(add|create|insert)\s+(a\s+)?(child|branch|sub-?topic|sub-?node)\b/i,
    action: 'mm_add_child',
  },
  {
    pattern: /\b(add|create|insert)\s+(a\s+)?(sibling|parallel|alternative|neighbor)\b/i,
    action: 'mm_add_sibling',
  },
  {
    pattern: /\b(swot|strengths?\s+and\s+weaknesses|pest|pestle)\b/i,
    action: 'mm_apply_framework',
  },
  {
    pattern: /\b(map|visualize|diagram)\s+(the\s+)?(structure|hierarchy|breakdown|dependencies)\b/i,
    action: 'mm_create',
  },
  // PL patterns
  {
    pattern:
      /\b(stwórz|utwórz|zacznij|zbuduj|otwórz)\s+(mapę\s+(myśli|rekomendacji|pomysłów|koncepcji|idei))\b/i,
    action: 'mm_create',
  },
  {
    pattern:
      /\b(rozwiń|eksploruj|rozgałęź|rozłóż)\s+(pomysł|węzeł|gałąź|temat|koncep)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_expand_branch',
  },
  {
    pattern: /\bdodaj\s+(gałąź|dziecko|pod-?temat|pod-?węzeł)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_add_child',
  },
  {
    pattern: /\bdodaj\s+(sąsiad|rodzeństwo|alternatyw|równoległ)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_add_sibling',
  },
  {
    pattern: /\b(zmapuj|zwizualizuj)\s+(strukturę|hierarchię|zależności)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_create',
  },
];

export function detectMindmapIntent(message: string): string | null {
  for (const { pattern, action } of MM_INTENT_PATTERNS) {
    if (pattern.test(message)) return action;
  }
  return null;
}
