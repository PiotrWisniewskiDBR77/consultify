/**
 * Detects if a chat message is a process flow / workflow intent.
 * Returns the best matching pf_* action if detected, or null.
 */

const PF_INTENT_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  // EN patterns
  {
    pattern:
      /\b(create|build|map|design|draw|model)\s+(a\s+)?(process|workflow|flow|pipeline|procedure)\b/i,
    action: 'pf_create',
  },
  {
    pattern: /\b(add|insert|create)\s+(a\s+)?(step|action|task|activity|stage)\b/i,
    action: 'pf_add_step',
  },
  {
    pattern: /\b(add|insert|create)\s+(a\s+)?(decision|gateway|branch|condition)\b/i,
    action: 'pf_add_decision',
  },
  {
    pattern: /\b(add|insert|create)\s+(a\s+)?(lane|swimlane|swim-lane|department)\b/i,
    action: 'pf_add_lane',
  },
  {
    pattern: /\b(bpmn|value\s*stream|vsm)\b/i,
    action: 'pf_create',
  },
  {
    pattern: /\b(optimize|analyze|bottleneck|improve)\s+(the\s+)?(process|workflow|flow)\b/i,
    action: 'pf_analyze',
  },
  // PL patterns
  {
    pattern:
      /\b(stwórz|utwórz|zacznij|zmapuj|zaprojektuj|narysuj)\s+(proces|przepływ|workflow|procedur)\b/i,
    action: 'pf_create',
  },
  {
    pattern: /\bdodaj\s+(krok|akcj[ęa]|zadanie|czynność|etap)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'pf_add_step',
  },
  {
    pattern: /\bdodaj\s+(decyzj[ęa]|bramk[ęa]|warunek|rozgałęzienie)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'pf_add_decision',
  },
  {
    pattern: /\bdodaj\s+(tor|ścieżk[ęa]|dział)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'pf_add_lane',
  },
  {
    pattern: /\b(optymalizuj|analizuj|wąskie\s*gardło|usprawnij)\s+(proces|przepływ)\b/i,
    action: 'pf_analyze',
  },
];

export function detectProcessFlowIntent(message: string): string | null {
  for (const { pattern, action } of PF_INTENT_PATTERNS) {
    if (pattern.test(message)) return action;
  }
  return null;
}
