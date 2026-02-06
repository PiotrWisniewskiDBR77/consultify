/**
 * Deep Thinking Hint Service
 *
 * Detects whether a user's message looks like a complex/strategic problem
 * that would benefit from Deep Thinking Mode.
 *
 * Used in non-DT chat streams to proactively suggest DT activation.
 * This is the "AI-suggested activation" feature from the original spec.
 */

export type DeepThinkingHint = {
  shouldSuggest: boolean;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
};

// ─── Trigger patterns ───────────────────────────────────────────────

const STRATEGIC_PATTERNS_EN = [
  /how (?:should|do|can) (?:we|i|the team) (?:design|structure|plan|decide|choose|approach|evaluate)/i,
  /what(?:'s| is) the best (?:strategy|approach|way to|plan for)/i,
  /should (?:we|i) (?:invest|hire|restructure|merge|pivot|expand|cut|automate)/i,
  /trade[- ]?off/i,
  /decision (?:between|about|on|regarding)/i,
  /compare (?:options|alternatives|approaches|strategies)/i,
  /risk[s]? (?:of|vs|versus|and|or) (?:reward|benefit|opportunity)/i,
  /what (?:are|would be) the (?:risks?|consequences|implications|impact)/i,
  /(?:strategic|operational|organizational|investment) (?:decision|plan|analysis|review)/i,
  /(?:pros? and cons?|advantages? (?:and|vs) disadvantages?)/i,
  /(?:short[- ]?term|long[- ]?term) (?:vs|versus|and)/i,
  /(?:reversible|irreversible) (?:decision|change|action)/i,
  /(?:scenario|simulation|what if|contingency)/i,
  /how (?:to|should we) (?:prioritize|allocate|optimize)/i,
];

const STRATEGIC_PATTERNS_PL = [
  /jak (?:powinniśmy|zaprojektować|zaplanować|wybrać|podejść|ocenić|zdecydować)/i,
  /jaka (?:jest|byłaby) najlepsza (?:strategia|metoda|droga)/i,
  /czy (?:powinniśmy|warto) (?:inwestować|zatrudnić|restrukturyzować|automatyzować|rozszerzać)/i,
  /kompromis(?:y|ów)?/i,
  /decyzj[aąeę] (?:między|dotycząc[aąeę]|w sprawie)/i,
  /porówna[jćń] (?:opcje|alternatywy|podejścia|strategie)/i,
  /ryzy[kc](?:o|a|iem)? (?:vs|versus|a|i|czy) (?:korzyść|szansa|zysk)/i,
  /jakie (?:są|byłyby) (?:ryzyk[ao]|konsekwencje|implikacje|skutki)/i,
  /(?:strategiczn[aąeę]|operacyjn[aąeę]|organizacyjn[aąeę]|inwestycyjn[aąeę]) (?:decyzj[aąeę]|plan|analiz[aąeę])/i,
  /(?:za i przeciw|wady i zalety)/i,
  /(?:krótkoterminow[oey]|długoterminow[oey]) (?:vs|versus|a|i)/i,
  /(?:odwracaln[aeyo]|nieodwracaln[aeyo]) (?:decyzj[aąeę]|zmian[aąeę])/i,
  /(?:scenariusz|symulacja|co jeśli|co gdyby)/i,
  /jak (?:priorytetyzować|alokować|zoptymalizować)/i,
];

// ─── Complexity signals ─────────────────────────────────────────────

const COMPLEXITY_SIGNALS_EN = [
  'multiple stakeholders',
  'conflicting goals',
  'limited budget',
  'tight deadline',
  'uncertainty',
  'ambiguity',
  'complex',
  'multi-dimensional',
  'cross-functional',
  'enterprise',
  'transformation',
  'migration',
  'restructuring',
  'governance',
];

const COMPLEXITY_SIGNALS_PL = [
  'wielu interesariuszy',
  'sprzeczne cele',
  'ograniczony budżet',
  'napięty termin',
  'niepewność',
  'niejednoznaczność',
  'złożon',
  'wielowymiarow',
  'przekrojow',
  'korporacyj',
  'transformacj',
  'migracj',
  'restrukturyzacj',
  'zarządzani',
];

// ─── Detection ──────────────────────────────────────────────────────

export function detectDeepThinkingIntent(message: string, language?: string): DeepThinkingHint {
  const msg = message.trim();
  if (msg.length < 20) {
    return { shouldSuggest: false, reason: '', confidence: 'low' };
  }

  const isPl = (language || '').startsWith('pl');
  const patterns = isPl
    ? [...STRATEGIC_PATTERNS_PL, ...STRATEGIC_PATTERNS_EN]
    : [...STRATEGIC_PATTERNS_EN, ...STRATEGIC_PATTERNS_PL];

  const signals = isPl
    ? [...COMPLEXITY_SIGNALS_PL, ...COMPLEXITY_SIGNALS_EN]
    : [...COMPLEXITY_SIGNALS_EN, ...COMPLEXITY_SIGNALS_PL];

  let patternMatches = 0;
  let matchedReason = '';
  for (const p of patterns) {
    if (p.test(msg)) {
      patternMatches++;
      if (!matchedReason) {
        matchedReason = 'strategic_question_detected';
      }
    }
  }

  let signalMatches = 0;
  const lower = msg.toLowerCase();
  for (const s of signals) {
    if (lower.includes(s.toLowerCase())) {
      signalMatches++;
    }
  }

  // Multi-axis detection: questions involving time, money, people, risk
  const axes = [
    /\b(?:time|timeline|deadline|termin|czas)\b/i,
    /\b(?:budget|cost|money|pieniądz|budżet|koszt)\b/i,
    /\b(?:people|team|staff|ludzi|zespoł|kadry)\b/i,
    /\b(?:risk|danger|ryzy[kc]|zagro[żz]eni)\b/i,
  ];
  const axisCount = axes.filter((a) => a.test(msg)).length;

  // Scoring
  const score = patternMatches * 2 + signalMatches + axisCount * 1.5;

  if (score >= 5) {
    return {
      shouldSuggest: true,
      reason: matchedReason || 'complex_multi_axis_problem',
      confidence: 'high',
    };
  }

  if (score >= 3) {
    return {
      shouldSuggest: true,
      reason: matchedReason || 'strategic_decision_indicators',
      confidence: 'medium',
    };
  }

  // Length + question mark heuristic for borderline cases
  if (msg.length > 200 && msg.includes('?') && (patternMatches > 0 || axisCount >= 2)) {
    return {
      shouldSuggest: true,
      reason: 'detailed_question_with_complexity',
      confidence: 'low',
    };
  }

  return { shouldSuggest: false, reason: '', confidence: 'low' };
}
